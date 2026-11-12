import os
import tempfile
import pytest
from fastapi.testclient import TestClient

# Use an isolated test database
os.environ["DB_PATH"] = os.path.join(tempfile.gettempdir(), "test_suraksha.db")
os.environ["DEVICE_TOKEN"] = "test-device-token"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "testpass123"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["DEFAULT_DEVICE_ID"] = "suraksha-esp32-01"

from main import app, db, SCHEMA


@pytest.fixture(autouse=True)
def clean_db():
    if os.path.exists(os.environ["DB_PATH"]):
        try:
            os.remove(os.environ["DB_PATH"])
        except OSError:
            pass
    with db() as conn:
        conn.executescript(SCHEMA)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "testpass123"})
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def device_headers():
    return {"X-Device-Token": "test-device-token"}


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_auth_rejections(client):
    # Unauthenticated dashboard access
    assert client.get("/api/state").status_code == 401
    assert client.get("/api/events").status_code == 401
    assert client.get("/api/devices").status_code == 401
    assert client.post("/api/commands", json={"command_type": "ARM"}).status_code == 401

    # Bad device token
    bad_dev = {"X-Device-Token": "wrong-token"}
    assert client.post("/api/device/status", json={"device_id": "test", "mode": "DISARMED", "door_state": "CLOSED"}, headers=bad_dev).status_code == 401
    assert client.get("/api/device/commands?device_id=test", headers=bad_dev).status_code == 401


def test_device_status_and_uv_telemetry(client, auth_headers, device_headers):
    # Post status from physical device with UV telemetry
    status_payload = {
        "device_id": "suraksha-esp32-01",
        "mode": "DISARMED",
        "door_state": "CLOSED",
        "vibration_state": "IDLE",
        "alarm_active": False,
        "proximity_cm": 45.2,
        "uv_index": 3.4,
        "firmware_version": "suraksha-fw-0.2.0",
        "device_timestamp": "2026-11-12T10:00:00Z",
    }
    res = client.post("/api/device/status", json=status_payload, headers=device_headers)
    assert res.status_code == 200
    assert res.json()["ok"] is True

    # Check dashboard state
    state_res = client.get("/api/state?device_id=suraksha-esp32-01", headers=auth_headers)
    assert state_res.status_code == 200
    data = state_res.json()
    assert data["device"]["is_online"] is True
    assert data["device"]["device_id"] == "suraksha-esp32-01"
    assert data["state"]["door_state"] == "CLOSED"
    assert data["state"]["mode"] == "DISARMED"
    assert data["state"]["uv_index"] == 3.4
    assert data["state"]["proximity_cm"] == 45.2


def test_devices_list_multi_device(client, auth_headers, device_headers):
    # Post from physical device
    client.post("/api/device/status", json={
        "device_id": "suraksha-esp32-01",
        "mode": "ARMED",
        "door_state": "CLOSED",
        "uv_index": 2.1,
    }, headers=device_headers)

    # Post from simulated Wokwi device
    client.post("/api/device/status", json={
        "device_id": "suraksha-wokwi-01",
        "mode": "DISARMED",
        "door_state": "OPEN",
        "uv_index": 0.0,
    }, headers=device_headers)

    res = client.get("/api/devices", headers=auth_headers)
    assert res.status_code == 200
    devices = res.json()["devices"]
    assert len(devices) == 2
    dev_ids = {d["device_id"] for d in devices}
    assert "suraksha-esp32-01" in dev_ids
    assert "suraksha-wokwi-01" in dev_ids


def test_event_ingestion_and_deduplication(client, auth_headers, device_headers):
    ev = {
        "device_id": "suraksha-esp32-01",
        "client_event_id": "unique-client-uuid-1",
        "event_type": "DOOR_OPEN_WHILE_ARMED",
        "severity": "HIGH",
        "door_state": "OPEN",
        "mode": "ARMED",
        "sensor_snapshot": {"vibration_triggered": True},
        "device_timestamp": "2026-11-12T10:05:00Z",
    }
    res1 = client.post("/api/device/events", json=ev, headers=device_headers)
    assert res1.status_code == 200
    assert res1.json()["duplicate"] is False
    event_id = res1.json()["event_id"]

    # Re-send duplicate
    res2 = client.post("/api/device/events", json=ev, headers=device_headers)
    assert res2.status_code == 200
    assert res2.json()["duplicate"] is True
    assert res2.json()["event_id"] == event_id

    # Check event appears once in list
    events_res = client.get("/api/events?device_id=suraksha-esp32-01", headers=auth_headers)
    assert len(events_res.json()["events"]) == 1

    # Acknowledge event
    ack_res = client.post(f"/api/events/{event_id}/ack", headers=auth_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["acknowledged"] is True


def test_command_roundtrip_arm_ack(client, auth_headers, device_headers):
    # 1. Dashboard requests ARM
    cmd_res = client.post("/api/commands", json={"command_type": "ARM", "device_id": "suraksha-esp32-01"}, headers=auth_headers)
    assert cmd_res.status_code == 200
    cmd_id = cmd_res.json()["command_id"]
    assert cmd_res.json()["status"] == "pending"

    # 2. Device polls command
    poll_res = client.get("/api/device/commands?device_id=suraksha-esp32-01", headers=device_headers)
    assert poll_res.status_code == 200
    assert poll_res.json()["command"]["command_id"] == cmd_id
    assert poll_res.json()["command"]["command_type"] == "ARM"

    # 3. Device acknowledges success
    ack_res = client.post(f"/api/device/commands/{cmd_id}/ack", json={"device_id": "suraksha-esp32-01", "success": True}, headers=device_headers)
    assert ack_res.status_code == 200
    assert ack_res.json()["ok"] is True

    # 4. Check command status is applied
    check_res = client.get(f"/api/commands/{cmd_id}", headers=auth_headers)
    assert check_res.status_code == 200
    assert check_res.json()["status"] == "applied"


def test_command_failed_ack(client, auth_headers, device_headers):
    # Dashboard requests ARM
    cmd_res = client.post("/api/commands", json={"command_type": "ARM", "device_id": "suraksha-esp32-01"}, headers=auth_headers)
    cmd_id = cmd_res.json()["command_id"]

    # Device acknowledges failure (e.g. door is currently open)
    ack_res = client.post(f"/api/device/commands/{cmd_id}/ack", json={
        "device_id": "suraksha-esp32-01",
        "success": False,
        "error": "Door is open - close it before arming"
    }, headers=device_headers)
    assert ack_res.status_code == 200

    check_res = client.get(f"/api/commands/{cmd_id}", headers=auth_headers)
    assert check_res.status_code == 200
    assert check_res.json()["status"] == "failed"
    assert check_res.json()["error"] == "Door is open - close it before arming"
