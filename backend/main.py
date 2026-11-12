"""Suraksha backend (MVP).

Two audiences, two kinds of auth:
  /api/device/*  -> the ESP32.        Header:  X-Device-Token: <DEVICE_TOKEN>
  /api/*         -> the dashboard.    Header:  Authorization: Bearer <token from /api/auth/login>

The ESP32 is the source of truth for mode/door state. The backend only stores
what the device reports; an ARM/DISARM command stays "pending" until the device
acknowledges it.
"""
import base64
import hashlib
import hmac
import json
import os
import sqlite3
import time
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

# ---------------------------------------------------------------- config ----
DB_PATH = os.getenv("DB_PATH", "suraksha.db")
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN", "dev-device-token")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "suraksha123")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
DEFAULT_DEVICE_ID = os.getenv("DEFAULT_DEVICE_ID", "suraksha-esp32-01")
OFFLINE_AFTER_SECONDS = int(os.getenv("OFFLINE_AFTER_SECONDS", "15"))
COMMAND_TTL_SECONDS = int(os.getenv("COMMAND_TTL_SECONDS", "60"))
TOKEN_TTL_SECONDS = 12 * 3600
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

EVENT_TYPES = Literal[
    "DOOR_OPEN_WHILE_ARMED",
    "DOOR_CLOSED",
    "REPEATED_VIBRATION",
    "VIBRATION_THEN_DOOR_OPEN",
    "DOOR_OPEN_DISARMED",
    "DEVICE_OFFLINE",
    "SYNC_RESTORED",
    "PROXIMITY_DETECTED",
]

# Wording is deliberately cautious (blueprint section 8 / 15): suspicious, never "confirmed".
DEFAULT_MESSAGES = {
    "DOOR_OPEN_WHILE_ARMED": "Door opened while the system was armed.",
    "DOOR_CLOSED": "Door closed.",
    "REPEATED_VIBRATION": "Repeated vibration detected near the door while armed.",
    "VIBRATION_THEN_DOOR_OPEN": "Vibration followed by door opening while armed - suspicious activity (not a confirmed break-in).",
    "DOOR_OPEN_DISARMED": "Door opened while disarmed.",
    "DEVICE_OFFLINE": "Device went offline.",
    "SYNC_RESTORED": "Device reconnected and synced queued events.",
    "PROXIMITY_DETECTED": "Nearby object detected (not person detection).",
}


# -------------------------------------------------------------- database ----
def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_ts(ts: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")) if ts else None


@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS devices (
    device_id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    firmware_version TEXT,
    last_seen_at TEXT
);
CREATE TABLE IF NOT EXISTS device_state (
    device_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    door_state TEXT NOT NULL,
    vibration_state TEXT NOT NULL,
    alarm_active INTEGER NOT NULL DEFAULT 0,
    proximity_cm REAL,
    uv_index REAL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    client_event_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    door_state TEXT,
    mode TEXT,
    sensor_snapshot TEXT,
    device_timestamp TEXT,
    created_at TEXT NOT NULL,
    acknowledged_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe ON events (device_id, client_event_id);
CREATE INDEX IF NOT EXISTS idx_events_device_time ON events (device_id, event_id DESC);
CREATE TABLE IF NOT EXISTS device_commands (
    command_id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    command_type TEXT NOT NULL,
    requested_by TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL,
    applied_at TEXT
);
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    with db() as conn:
        conn.executescript(SCHEMA)
        # Migrate schema dynamically if uv_index column does not exist
        cols = [c["name"] for c in conn.execute("PRAGMA table_info(device_state)").fetchall()]
        if "uv_index" not in cols:
            conn.execute("ALTER TABLE device_state ADD COLUMN uv_index REAL")
    yield


app = FastAPI(title="Suraksha API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ auth ----
def _sign(body: str) -> str:
    return hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()


def make_token(username: str) -> str:
    payload = {"u": username, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    return f"{body}.{_sign(body)}"


def require_user(authorization: str = Header(default="")) -> str:
    scheme, _, token = authorization.partition(" ")
    body, _, sig = token.partition(".")
    if scheme.lower() != "bearer" or not body or not hmac.compare_digest(sig, _sign(body)):
        raise HTTPException(401, "Invalid or missing token")
    try:
        payload = json.loads(base64.urlsafe_b64decode(body))
    except Exception:
        raise HTTPException(401, "Invalid token")
    if payload.get("exp", 0) < time.time():
        raise HTTPException(401, "Token expired")
    return payload["u"]


def require_device(x_device_token: str = Header(default="")) -> None:
    if not hmac.compare_digest(x_device_token, DEVICE_TOKEN):
        raise HTTPException(401, "Invalid device token")


# --------------------------------------------------------------- schemas ----
class LoginIn(BaseModel):
    username: str
    password: str


class StatusIn(BaseModel):
    device_id: str
    mode: Literal["ARMED", "DISARMED"]
    door_state: Literal["OPEN", "CLOSED"]
    vibration_state: Literal["IDLE", "TRIGGERED"] = "IDLE"
    alarm_active: bool = False
    proximity_cm: Optional[float] = None
    uv_index: Optional[float] = None
    firmware_version: Optional[str] = None
    device_timestamp: Optional[str] = None


class EventIn(BaseModel):
    device_id: str
    event_type: EVENT_TYPES
    severity: Literal["INFO", "WARNING", "HIGH"]
    door_state: Optional[Literal["OPEN", "CLOSED"]] = None
    mode: Optional[Literal["ARMED", "DISARMED"]] = None
    sensor_snapshot: dict = Field(default_factory=dict)
    message: Optional[str] = None
    device_timestamp: Optional[str] = None
    # Unique per event on the device. Lets the ESP32 safely re-send queued
    # events after an outage without creating duplicates.
    client_event_id: Optional[str] = None


class CommandIn(BaseModel):
    command_type: Literal["ARM", "DISARM"]
    device_id: str = DEFAULT_DEVICE_ID


class AckIn(BaseModel):
    device_id: str
    success: bool = True
    error: Optional[str] = None


# --------------------------------------------------------------- helpers ----
def touch_device(conn, device_id: str, firmware_version: Optional[str] = None) -> None:
    conn.execute(
        "INSERT INTO devices (device_id, device_name, firmware_version, last_seen_at) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT(device_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, "
        "firmware_version = COALESCE(excluded.firmware_version, devices.firmware_version)",
        (device_id, device_id, firmware_version, now_utc()),
    )


def expire_old_commands(conn) -> None:
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=COMMAND_TTL_SECONDS)).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn.execute(
        "UPDATE device_commands SET status = 'expired' WHERE status = 'pending' AND created_at < ?",
        (cutoff,),
    )


def event_row(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["sensor_snapshot"] = json.loads(d["sensor_snapshot"] or "{}")
    d["acknowledged"] = d["acknowledged_at"] is not None
    return d


# ---------------------------------------------------------- device routes ----
@app.post("/api/device/status", dependencies=[Depends(require_device)])
def device_status(body: StatusIn):
    """Heartbeat + current state. The ESP32 calls this every few seconds."""
    with db() as conn:
        touch_device(conn, body.device_id, body.firmware_version)
        conn.execute(
            "INSERT INTO device_state (device_id, mode, door_state, vibration_state, alarm_active, proximity_cm, uv_index, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(device_id) DO UPDATE SET mode=excluded.mode, door_state=excluded.door_state, "
            "vibration_state=excluded.vibration_state, alarm_active=excluded.alarm_active, "
            "proximity_cm=excluded.proximity_cm, uv_index=excluded.uv_index, updated_at=excluded.updated_at",
            (body.device_id, body.mode, body.door_state, body.vibration_state,
             int(body.alarm_active), body.proximity_cm, body.uv_index, now_utc()),
        )
    return {"ok": True, "server_time": now_utc()}


@app.post("/api/device/events", dependencies=[Depends(require_device)])
def device_event(body: EventIn):
    with db() as conn:
        touch_device(conn, body.device_id)
        if body.client_event_id:
            dup = conn.execute(
                "SELECT event_id FROM events WHERE device_id = ? AND client_event_id = ?",
                (body.device_id, body.client_event_id),
            ).fetchone()
            if dup:
                return {"ok": True, "event_id": dup["event_id"], "duplicate": True}
        cur = conn.execute(
            "INSERT INTO events (device_id, client_event_id, event_type, severity, message, door_state, mode, "
            "sensor_snapshot, device_timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (body.device_id, body.client_event_id, body.event_type, body.severity,
             body.message or DEFAULT_MESSAGES[body.event_type], body.door_state, body.mode,
             json.dumps(body.sensor_snapshot), body.device_timestamp, now_utc()),
        )
    return {"ok": True, "event_id": cur.lastrowid, "duplicate": False}


@app.get("/api/device/commands", dependencies=[Depends(require_device)])
def device_get_command(device_id: str):
    """ESP32 polls this. Returns the oldest still-pending command (or null)."""
    with db() as conn:
        touch_device(conn, device_id)
        expire_old_commands(conn)
        row = conn.execute(
            "SELECT command_id, command_type, created_at FROM device_commands "
            "WHERE device_id = ? AND status = 'pending' ORDER BY command_id LIMIT 1",
            (device_id,),
        ).fetchone()
    return {"command": dict(row) if row else None}


@app.post("/api/device/commands/{command_id}/ack", dependencies=[Depends(require_device)])
def device_ack_command(command_id: int, body: AckIn):
    with db() as conn:
        cur = conn.execute(
            "UPDATE device_commands SET status = ?, error = ?, applied_at = ? "
            "WHERE command_id = ? AND device_id = ? AND status = 'pending'",
            ("applied" if body.success else "failed", body.error, now_utc(), command_id, body.device_id),
        )
    if cur.rowcount == 0:
        raise HTTPException(404, "No pending command with that id for this device")
    return {"ok": True}


# ------------------------------------------------------- dashboard routes ----
@app.post("/api/auth/login")
def login(body: LoginIn):
    ok_user = hmac.compare_digest(body.username, ADMIN_USERNAME)
    ok_pass = hmac.compare_digest(body.password, ADMIN_PASSWORD)
    if not (ok_user and ok_pass):
        raise HTTPException(401, "Wrong username or password")
    return {"token": make_token(body.username), "expires_in": TOKEN_TTL_SECONDS}


@app.get("/api/devices")
def list_devices(_: str = Depends(require_user)):
    """Lists all registered physical and simulated devices and their live status."""
    with db() as conn:
        expire_old_commands(conn)
        rows = conn.execute(
            "SELECT d.device_id, d.device_name, d.firmware_version, d.last_seen_at, "
            "s.mode, s.door_state, s.vibration_state, s.alarm_active, s.proximity_cm, s.uv_index, s.updated_at "
            "FROM devices d LEFT JOIN device_state s ON d.device_id = s.device_id "
            "ORDER BY d.last_seen_at DESC"
        ).fetchall()

    result = []
    now = datetime.now(timezone.utc)
    for r in rows:
        d = dict(r)
        seen = parse_ts(d["last_seen_at"])
        age = (now - seen).total_seconds() if seen else None
        d["is_online"] = age is not None and age <= OFFLINE_AFTER_SECONDS
        d["seconds_since_seen"] = round(age) if age is not None else None
        d["alarm_active"] = bool(d.get("alarm_active", 0))
        result.append(d)
    return {"devices": result}


@app.get("/api/state")
def get_state(device_id: str = DEFAULT_DEVICE_ID, _: str = Depends(require_user)):
    """Everything the Overview page needs in one call."""
    with db() as conn:
        expire_old_commands(conn)
        dev = conn.execute("SELECT * FROM devices WHERE device_id = ?", (device_id,)).fetchone()
        state = conn.execute("SELECT * FROM device_state WHERE device_id = ?", (device_id,)).fetchone()
        alert = conn.execute(
            "SELECT * FROM events WHERE device_id = ? AND acknowledged_at IS NULL AND severity IN ('WARNING','HIGH') "
            "ORDER BY event_id DESC LIMIT 1",
            (device_id,),
        ).fetchone()
        unacked = conn.execute(
            "SELECT COUNT(*) AS n FROM events WHERE device_id = ? AND acknowledged_at IS NULL AND severity IN ('WARNING','HIGH')",
            (device_id,),
        ).fetchone()["n"]
        cmd = conn.execute(
            "SELECT * FROM device_commands WHERE device_id = ? ORDER BY command_id DESC LIMIT 1", (device_id,)
        ).fetchone()

    device = None
    if dev:
        seen = parse_ts(dev["last_seen_at"])
        age = (datetime.now(timezone.utc) - seen).total_seconds() if seen else None
        device = {
            **dict(dev),
            "is_online": age is not None and age <= OFFLINE_AFTER_SECONDS,
            "seconds_since_seen": round(age) if age is not None else None,
        }
    st = dict(state) if state else None
    if st:
        st["alarm_active"] = bool(st["alarm_active"])
    return {
        "device": device,
        "state": st,
        "latest_alert": event_row(alert) if alert else None,
        "unacknowledged_alerts": unacked,
        "last_command": dict(cmd) if cmd else None,
        "server_time": now_utc(),
    }


@app.get("/api/events")
def list_events(
    device_id: str = DEFAULT_DEVICE_ID,
    limit: int = Query(50, ge=1, le=200),
    before_id: Optional[int] = None,
    unacknowledged_only: bool = False,
    _: str = Depends(require_user),
):
    sql = "SELECT * FROM events WHERE device_id = ?"
    params: list = [device_id]
    if before_id:
        sql += " AND event_id < ?"
        params.append(before_id)
    if unacknowledged_only:
        sql += " AND acknowledged_at IS NULL"
    sql += " ORDER BY event_id DESC LIMIT ?"
    params.append(limit)
    with db() as conn:
        rows = conn.execute(sql, params).fetchall()
    return {"events": [event_row(r) for r in rows]}


@app.post("/api/events/{event_id}/ack")
def ack_event(event_id: int, user: str = Depends(require_user)):
    """Marks an alert as acknowledged. The event itself is never deleted."""
    with db() as conn:
        cur = conn.execute(
            "UPDATE events SET acknowledged_at = COALESCE(acknowledged_at, ?) WHERE event_id = ?",
            (now_utc(), event_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Event not found")
        row = conn.execute("SELECT * FROM events WHERE event_id = ?", (event_id,)).fetchone()
    return event_row(row)


@app.post("/api/commands")
def create_command(body: CommandIn, user: str = Depends(require_user)):
    """Dashboard requests ARM/DISARM. Stays 'pending' until the ESP32 acknowledges it."""
    with db() as conn:
        # Only the newest request matters; older pending ones are superseded.
        conn.execute(
            "UPDATE device_commands SET status = 'superseded' WHERE device_id = ? AND status = 'pending'",
            (body.device_id,),
        )
        cur = conn.execute(
            "INSERT INTO device_commands (device_id, command_type, requested_by, status, created_at) "
            "VALUES (?, ?, ?, 'pending', ?)",
            (body.device_id, body.command_type, user, now_utc()),
        )
        row = conn.execute("SELECT * FROM device_commands WHERE command_id = ?", (cur.lastrowid,)).fetchone()
    return dict(row)


@app.get("/api/commands/{command_id}")
def get_command(command_id: int, _: str = Depends(require_user)):
    with db() as conn:
        expire_old_commands(conn)
        row = conn.execute("SELECT * FROM device_commands WHERE command_id = ?", (command_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Command not found")
    return dict(row)


@app.get("/api/health")
def health():
    return {"ok": True, "server_time": now_utc()}
