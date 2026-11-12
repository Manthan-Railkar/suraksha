"""Fake Suraksha ESP32. Lets you build/test the backend + dashboard without hardware.

It follows the same rules the real firmware will (blueprint section 8), so treat it
as an executable spec for the C++ later.

Run:  python simulate_device.py
Keys: o = open door   c = close door   v = vibration (knock)
      r = reset local alarm   s = show state   q = quit
"""
import os
import sys
import threading
import time
import uuid
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()  # read DEVICE_TOKEN etc. from backend/.env, same as main.py

BASE = os.getenv("SURAKSHA_URL", "http://localhost:8000")
TOKEN = os.getenv("DEVICE_TOKEN", "dev-device-token")
DEVICE_ID = os.getenv("DEFAULT_DEVICE_ID", "suraksha-esp32-01")
HEADERS = {"X-Device-Token": TOKEN}

VIB_WINDOW_S = 10    # repeated-vibration window
VIB_COUNT = 3        # knocks inside the window that raise a warning
COMBO_WINDOW_S = 10  # vibration -> door open within this window = higher priority event
HEARTBEAT_S = 5
POLL_S = 2

lock = threading.Lock()
state = {"mode": "DISARMED", "door": "CLOSED", "alarm": False}
vib_times: list[float] = []
last_vib = 0.0
outbox: list[dict] = []  # events waiting to be sent (the "buffer" T-08 needs)
running = True


def ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def emit(event_type: str, severity: str) -> None:
    """Called while holding `lock`."""
    outbox.append({
        "device_id": DEVICE_ID,
        "client_event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "severity": severity,
        "door_state": state["door"],
        "mode": state["mode"],
        "sensor_snapshot": {"vibration_triggered": time.time() - last_vib < 3},
        "device_timestamp": ts(),
    })
    log(f"EVENT  {event_type} ({severity})")


def status_payload() -> dict:
    return {
        "device_id": DEVICE_ID,
        "mode": state["mode"],
        "door_state": state["door"],
        "vibration_state": "TRIGGERED" if time.time() - last_vib < 3 else "IDLE",
        "alarm_active": state["alarm"],
        "firmware_version": "sim-0.1",
        "device_timestamp": ts(),
    }


def send_status() -> None:
    with lock:
        payload = status_payload()
    try:
        requests.post(f"{BASE}/api/device/status", json=payload, headers=HEADERS, timeout=3).raise_for_status()
    except requests.RequestException as e:
        log(f"status send failed ({e.__class__.__name__}) - will retry")


def flush_outbox() -> None:
    while True:
        with lock:
            if not outbox:
                return
            ev = outbox[0]
        try:
            requests.post(f"{BASE}/api/device/events", json=ev, headers=HEADERS, timeout=3).raise_for_status()
        except requests.RequestException:
            return  # keep it queued, try again next loop
        with lock:
            outbox.pop(0)


def poll_command() -> None:
    try:
        r = requests.get(f"{BASE}/api/device/commands", params={"device_id": DEVICE_ID}, headers=HEADERS, timeout=3)
        r.raise_for_status()
        cmd = r.json()["command"]
        if not cmd:
            return
        with lock:
            state["mode"] = "ARMED" if cmd["command_type"] == "ARM" else "DISARMED"
            state["alarm"] = False
        log(f"COMMAND {cmd['command_type']} applied")
        requests.post(f"{BASE}/api/device/commands/{cmd['command_id']}/ack",
                      json={"device_id": DEVICE_ID, "success": True}, headers=HEADERS, timeout=3)
        send_status()
    except requests.RequestException:
        pass


def network_loop() -> None:
    last_hb = last_poll = 0.0
    while running:
        now = time.time()
        if now - last_hb >= HEARTBEAT_S:
            send_status()
            last_hb = now
        if now - last_poll >= POLL_S:
            poll_command()
            last_poll = now
        flush_outbox()
        time.sleep(0.3)


def door_open() -> None:
    with lock:
        if state["door"] == "OPEN":
            return
        state["door"] = "OPEN"
        if state["mode"] == "ARMED":
            state["alarm"] = True
            if time.time() - last_vib < COMBO_WINDOW_S:
                emit("VIBRATION_THEN_DOOR_OPEN", "HIGH")
            else:
                emit("DOOR_OPEN_WHILE_ARMED", "HIGH")
        else:
            emit("DOOR_OPEN_DISARMED", "INFO")
    send_status()


def door_close() -> None:
    with lock:
        if state["door"] == "CLOSED":
            return
        state["door"] = "CLOSED"
        emit("DOOR_CLOSED", "INFO")
    send_status()


def vibration() -> None:
    global last_vib
    with lock:
        now = time.time()
        last_vib = now
        if state["mode"] == "ARMED" and state["door"] == "CLOSED":
            vib_times.append(now)
            vib_times[:] = [t for t in vib_times if now - t <= VIB_WINDOW_S]
            if len(vib_times) >= VIB_COUNT:
                emit("REPEATED_VIBRATION", "WARNING")
                vib_times.clear()
    send_status()


def main() -> None:
    global running
    threading.Thread(target=network_loop, daemon=True).start()
    print(__doc__)
    try:
        for line in sys.stdin:
            k = line.strip().lower()
            if k == "o":
                door_open()
            elif k == "c":
                door_close()
            elif k == "v":
                vibration()
            elif k == "r":
                with lock:
                    state["alarm"] = False
                send_status()
            elif k == "s":
                log(str(state))
            elif k == "q":
                break
        else:
            time.sleep(4)  # stdin closed (piped input): let the network thread finish sending
    finally:
        running = False


if __name__ == "__main__":
    main()
