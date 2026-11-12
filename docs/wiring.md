# Suraksha - Wiring and Pin Verification

Suraksha is an **add-on monitor** for an ordinary door. It does not lock, unlock or actuate the mechanical lock, and the relay on the trainer board is **not used**. Power it from USB only - no mains wiring.

The board is an already-assembled **EDU-ROBO V14** trainer PCB with an ESP32-WROOM-32 DevKit V1. Do not assume a generic ESP32 pin is free: confirm each pin below on the real board (labels, continuity, schematic) and write the result in the "Verified" column. The firmware takes its pins from `firmware/src/config.h`.

## Pin map

| Function | `config.h` name | Default | Source | Verified on board? |
|---|---|---|---|---|
| Reed switch input | `PIN_REED_SWITCH` | GPIO32 | **Not in the manual** - pick a free, input-capable pin that reaches a connector | [ ] |
| Vibration sensor | `PIN_VIBRATION` | GPIO23 | Manual lists GPIO23 | [ ] module fitted? [ ] pin |
| Buzzer | `PIN_BUZZER` | GPIO15 | Manual lists GPIO15 | [ ] |
| LED - armed indicator | `PIN_LED_ARMED` | GPIO27 | Manual lists GPIO27/14/12/13 | [ ] shared with L293D? |
| LED - alarm indicator | `PIN_LED_ALARM` | GPIO14 | as above | [ ] |
| Local button (optional) | `PIN_MODE_BUTTON` | disabled (-1) | any free pin, active LOW | [ ] |
| HC-SR04 TRIG / ECHO (optional) | `PIN_PROX_TRIG` / `PIN_PROX_ECHO` | disabled (-1) | Manual is **inconsistent** | [ ] |

### Cautions (from the blueprint)

- **LEDs may share pins with the L293D motor driver.** Check the fitted IC before relying on them.
- **GPIO3 is UART RX** and the manual lists it for the relay. Do not reuse it.
- **GPIO34-39 are input-only with no internal pull-up.** Do not put the reed switch there unless you add an external pull-up (the firmware uses `INPUT_PULLUP`).
- **ESP32 GPIO is 3.3 V.** The HC-SR04 ECHO pin is usually 5 V - put a divider (e.g. 1 kOhm in series, 2 kOhm to GND) between ECHO and the ESP32 pin.
- The manual shows the HC-SR04 trigger/echo mapping differently in different sections. Verify physically before enabling `ENABLE_PROXIMITY`.

## Reed switch

Wire the reed switch between the chosen GPIO and GND. Mount the switch on the door frame and the magnet on the door so they are within a few millimetres when the door is closed.

- Magnet near (door closed) -> contact closed -> pin reads **LOW**. This is `REED_CLOSED_LEVEL LOW` in `config.h`. If your switch behaves the other way round, flip that define.
- A reed switch reports door **position** only. It cannot tell whether the lock is locked.

## Vibration sensor

SW-420 style modules pulse their digital output when shaken (`VIB_ACTIVE_LEVEL HIGH`). Adjust the module's potentiometer and the thresholds in `config.h` (`VIB_COUNT_THRESHOLD`, `VIB_WINDOW_MS`) after measuring idle noise (Phase 3). A vibration is a disturbance, not proof of forced entry.

## Bring-up order

Follow blueprint section 12. For each phase, tick it off here:

- [ ] 0. Board and toolchain: upload the firmware, Serial Monitor shows `Suraksha ... starting`
- [ ] 1. Outputs: with `RUN_OUTPUT_TEST_ON_BOOT 1`, the armed LED, alarm LED and buzzer each pulse once at boot
- [ ] 2. Door sensor: Serial prints `[door] OPEN/CLOSED` cleanly with no extra flips
- [ ] 3. Vibration: knocks print `[vibration] trigger`; idle shows none
- [ ] 4. Local logic works with Wi-Fi off (see test-plan.md T-01..T-06)
- [ ] 5. Wi-Fi + API: events reach the backend
- [ ] 6. Dashboard shows state and history
- [ ] 7. Full acceptance run (T-01..T-11)
- [ ] 8. Optional: proximity

## Firmware configuration

1. Copy `firmware/src/secrets.example.h` to `firmware/src/secrets.h` and fill in Wi-Fi, `BACKEND_URL`, `DEVICE_TOKEN`, `DEVICE_ID`. `secrets.h` is git-ignored.
2. `DEVICE_TOKEN` must equal `DEVICE_TOKEN` in `backend/.env`; `DEVICE_ID` must equal `DEFAULT_DEVICE_ID`.
3. `BACKEND_URL` is the address of the backend **as seen from the ESP32** (your PC's LAN IP, not `localhost`). Start the backend with `uvicorn main:app --host 0.0.0.0 --port 8000`.
4. Build and upload with PlatformIO: `cd firmware && pio run -t upload && pio device monitor`.
