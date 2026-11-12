# Suraksha - API Contract

Backend: `backend/main.py` (FastAPI + SQLite). Two audiences, two kinds of auth:

| Prefix | Caller | Auth header |
|---|---|---|
| `/api/device/*` | ESP32 | `X-Device-Token: <DEVICE_TOKEN>` |
| `/api/*` (everything else except `/api/auth/login` and `/api/health`) | Dashboard | `Authorization: Bearer <token>` from `/api/auth/login` |

Timestamps: the backend stamps `created_at` (UTC, `...Z`) when it **receives** an event. `device_timestamp` is the ESP32's own clock (NTP-synced when possible) and should be treated as approximate. The dashboard shows both.

The ESP32 is the source of truth for mode and door state. A dashboard ARM/DISARM request stays **pending** until the device acknowledges it; the dashboard never shows the mode as changed on its own.

## Device endpoints

### `POST /api/device/status` - heartbeat and current state (every ~5 s, and immediately on change)
```json
{ "device_id": "suraksha-esp32-01", "mode": "ARMED", "door_state": "CLOSED",
  "vibration_state": "IDLE", "alarm_active": false, "proximity_cm": 42.0,
  "firmware_version": "suraksha-fw-0.1.0", "device_timestamp": "2026-11-12T13:00:00Z" }
```
`proximity_cm`, `firmware_version`, `device_timestamp` optional. The device counts as offline after `OFFLINE_AFTER_SECONDS` (default 15) without any device request.

### `POST /api/device/events`
```json
{ "device_id": "suraksha-esp32-01", "client_event_id": "9f3a1c2b-12",
  "event_type": "DOOR_OPEN_WHILE_ARMED", "severity": "HIGH",
  "door_state": "OPEN", "mode": "ARMED",
  "sensor_snapshot": { "vibration_triggered": false },
  "device_timestamp": "2026-11-12T13:00:00Z" }
```
`client_event_id` is unique per event; re-sending the same id after an outage returns `{"ok":true,"duplicate":true}` and creates no second row. `message` is optional (a cautious default is filled in).

Event types and severities:

| `event_type` | Severity | Raised when |
|---|---|---|
| `DOOR_OPEN_WHILE_ARMED` | HIGH | Door CLOSED -> OPEN while armed |
| `VIBRATION_THEN_DOOR_OPEN` | HIGH | As above, with vibration in the preceding window. Suspicious activity, **not** a confirmed break-in |
| `REPEATED_VIBRATION` | WARNING | Knock count threshold reached inside the window, door closed and armed |
| `DOOR_OPEN_DISARMED` | INFO | Door opened while disarmed |
| `DOOR_CLOSED` | INFO | Door OPEN -> CLOSED. Earlier alerts stay in history |
| `DEVICE_OFFLINE` | WARNING | Queued by the device when an outage starts; delivered after reconnection |
| `SYNC_RESTORED` | INFO | Sent after reconnection |
| `PROXIMITY_DETECTED` | INFO | Optional HC-SR04: "nearby object detected", never person detection |

### `GET /api/device/commands?device_id=...`
Returns `{"command": null}` or `{"command": {"command_id": 7, "command_type": "ARM", "created_at": "..."}}` - the oldest still-pending command. Pending commands expire after `COMMAND_TTL_SECONDS` (default 60).

### `POST /api/device/commands/{command_id}/ack`
```json
{ "device_id": "suraksha-esp32-01", "success": true, "error": null }
```
`success: false` with an `error` string marks the command **failed** (e.g. "Door is open - close it before arming"). `404` if the command is no longer pending.

## Dashboard endpoints

| Method + path | Purpose |
|---|---|
| `POST /api/auth/login` `{username, password}` | Returns `{token, expires_in}` (12 h) |
| `GET /api/state?device_id=` | Everything the Overview needs: `device` (incl. `is_online`, `seconds_since_seen`), `state`, `latest_alert`, `unacknowledged_alerts`, `last_command`, `server_time` |
| `GET /api/events?device_id=&limit=&before_id=&unacknowledged_only=` | Newest first, `limit` 1-200, `before_id` for paging |
| `POST /api/events/{id}/ack` | Marks an alert acknowledged. The event is never deleted |
| `POST /api/commands` `{command_type: "ARM"\|"DISARM", device_id}` | Creates a pending command (older pending ones become `superseded`) |
| `GET /api/commands/{id}` | Command status: `pending`, `applied`, `failed`, `expired`, `superseded` |
| `GET /api/health` | Liveness probe, no auth |

Unauthenticated or invalid-token requests to any dashboard endpoint return `401` (test T-11).

## Dashboard screens -> endpoints

| Screen | Route | Uses |
|---|---|---|
| Door Overview | `/overview` | `/api/state` (polled every 3 s), `/api/events?limit=6`, `/api/commands`, `/api/events/{id}/ack` |
| Device Health | `/device` | `/api/state` |
| Alerts | `/alerts` | `/api/events?limit=200`, `/api/events/{id}/ack` |
| Event History | `/history` | `/api/events` with `before_id` paging |

## Configuration (`backend/.env`)

`DEVICE_TOKEN`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SECRET_KEY`, `DEFAULT_DEVICE_ID`, optional `OFFLINE_AFTER_SECONDS`, `COMMAND_TTL_SECONDS`, `CORS_ORIGINS`. Change every default before exposing the backend beyond your own machine, and never commit `.env`.
