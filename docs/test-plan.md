# Suraksha - MVP Test Plan

Acceptance gate (blueprint section 13): all Must features work in a repeatable demo; **T-01 to T-11 pass**; the local alarm works independent of the network; the dashboard shows accurate mode, door state, connectivity and history; and nothing claims that vibration proves forced entry.

Setup: backend running (`uvicorn main:app --host 0.0.0.0 --port 8000` in `backend/`), dashboard running (`npm run dev` in `dashboard/`, sign in with the `ADMIN_*` values from `backend/.env`), ESP32 flashed per `wiring.md`. No hardware yet? `python simulate_device.py` in `backend/` follows the same rules (keys `o` open, `c` close, `v` knock, `r` reset).

Record **Pass / Fail** and the date for each run.

| ID | Procedure | Expected result | Result |
|---|---|---|---|
| T-01 Normal closed state | Close the door while disarmed | Overview shows DOOR CLOSED, DISARMED, NORMAL; no alarm | |
| T-02 Door opens while disarmed | Open the door while disarmed | Door shows OPEN; a `DOOR_OPEN_DISARMED` INFO event appears in History; no alarm, no alert | |
| T-03 Door opens while armed | Arm (dashboard), then open the door | Buzzer and alarm LED run; HIGH `DOOR_OPEN_WHILE_ARMED` shows as Latest alert and in Alerts; status NORMAL -> ALARM | |
| T-04 Door closes after alert | Close the door after T-03 | Door returns to CLOSED; the original alert is still in History (and Alerts until acknowledged) | |
| T-05 Vibration while closed and armed | Arm, then knock `VIB_COUNT_THRESHOLD` times within `VIB_WINDOW_MS` | `REPEATED_VIBRATION` WARNING event and short buzzer warning; single stray knocks do nothing | |
| T-06 Vibration then door opening | Armed: knock, then open the door within `COMBO_WINDOW_MS` | `VIBRATION_THEN_DOOR_OPEN` HIGH; wording says "suspicious activity ... not a confirmed break-in" | |
| T-07 Disarm | Press Disarm, confirm | Control shows PENDING, then CONFIRMED once the ESP32 acks; mode reads DISARMED; opening the door no longer alarms | |
| T-08 Network loss | Turn Wi-Fi off, open the door while armed, turn Wi-Fi on | Buzzer sounds immediately without Wi-Fi; after reconnect the event arrives (with `DEVICE_OFFLINE` then `SYNC_RESTORED`); buffer holds at most `EVENT_QUEUE_SIZE` events | |
| T-09 Backend unavailable | Stop the backend, keep Wi-Fi on | ESP32 keeps sensing and alarming; restart backend -> events sync; while down, the dashboard shows the backend-unreachable banner / device OFFLINE rather than fresh-looking data | |
| T-10 Restart recovery | Reset the ESP32 with the door closed | Reconnects, reports its real state, mode restored from flash; an old pending command is not reported as applied | |
| T-11 Authentication | `curl -X POST localhost:8000/api/commands -H "Content-Type: application/json" -d "{\"command_type\":\"ARM\"}"` with no token | `401`; with a bad `X-Device-Token` the device endpoints also return `401` | |
| T-12 Proximity (optional) | `ENABLE_PROXIMITY 1`, move an object into range | `PROXIMITY_DETECTED` INFO shown as "Nearby object detected"; no person/intent wording anywhere | |
| T-13 UV Environmental Telemetry | Change UV sensor / pot voltage on GPIO35 (or press `u` in simulator) | UV Index updates on `/api/state` and in Overview / Device cards; NEVER triggers an alarm or intrusion event | |
| T-14 Multi-Device Selection | Switch between physical device (`suraksha-esp32-01`) and simulator (`suraksha-sim-01` / `suraksha-wokwi-01`) | DeviceSelector switches active device context; status, events, alerts and commands are isolated per device | |

## Extra checks worth doing

- **Command that cannot be applied:** open the door and press Arm -> status shows FAILED "Door is open - close it before arming"; mode unchanged.
- **Command not picked up:** unplug the ESP32 and press Arm -> PENDING, then NO RESPONSE after about a minute; mode unchanged.
- **Acknowledge:** acknowledge an alert in Alerts -> it moves to the Acknowledged tab and stays in History with an ACKNOWLEDGED pill.
- **Duplicate protection:** an event re-sent after a failed upload appears once.
- **Theme and layout:** Overview, Device, Alerts and History render in both light and dark mode; status is always readable from text, not colour alone.
- **Idle false positives:** leave the system armed and the door closed for 10 minutes; no events should appear. If they do, tune the sensor and `config.h` thresholds (Phase 3).
