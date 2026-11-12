#pragma once
#include <Arduino.h>

// =====================================================================================
//  PIN MAP - VERIFY EVERY LINE AGAINST THE REAL EDU-ROBO V14 BOARD BEFORE WIRING
//  (blueprint section 7.2 and Appendix B). Record what you confirmed in docs/wiring.md.
//  Use -1 to disable a pin.
// =====================================================================================
#define PIN_REED_SWITCH   32   // VERIFY: choose a free, input-capable GPIO that reaches a PCB connector
#define PIN_VIBRATION     23   // manual lists GPIO23 - VERIFY the module is fitted and this is its signal
#define PIN_BUZZER        15   // manual lists GPIO15 - VERIFY routing
#define PIN_LED_ARMED     27   // manual lists GPIO27/14/12/13 for LEDs - VERIFY (may be shared with L293D)
#define PIN_LED_ALARM     14   // VERIFY
#define PIN_MODE_BUTTON   -1   // optional local arm/disarm/silence button (active LOW, internal pull-up)

// UV Sensor (physical environmental telemetry on ADC1 pin)
// Strictly for environmental monitoring - NEVER interpreted as an intrusion alert.
#define ENABLE_UV_SENSOR          1
#define PIN_UV_SENSOR             35   // ADC1_CH7 on ESP32 DevKit, safe analog input
#define UV_SAMPLE_INTERVAL_MS     2000 // Sample rate for environmental telemetry

// Optional HC-SR04 (blueprint F-09). The manual's TRIG/ECHO mapping is inconsistent - verify first.
// ECHO is 5 V: put a voltage divider (e.g. 1k + 2k) between ECHO and the ESP32 pin.
#define ENABLE_PROXIMITY  0
#define PIN_PROX_TRIG     -1
#define PIN_PROX_ECHO     -1

// ---- Electrical polarity (match your parts) -----------------------------------------
// Reed switch + magnet: with the magnet next to the switch (door CLOSED) the contact is
// closed and pulls the pin to GND, so the pin reads LOW. Flip if yours is wired the other way.
#define REED_CLOSED_LEVEL   LOW
#define VIB_ACTIVE_LEVEL    HIGH   // SW-420 style modules pulse their digital output on vibration
#define BUZZER_ON_LEVEL     HIGH   // active buzzer
#define LED_ON_LEVEL        HIGH

// ---- Tunables (blueprint section 8: make these adjustable during testing) -----------
#define DOOR_DEBOUNCE_MS          50
#define VIB_MIN_GAP_MS            150     // ignore chatter closer together than this
#define VIB_WINDOW_MS             10000   // repeated-vibration window
#define VIB_COUNT_THRESHOLD       3       // knocks inside the window that raise a warning
#define COMBO_WINDOW_MS           10000   // vibration -> door open inside this = higher priority event
#define PROXIMITY_THRESHOLD_CM    60
#define PROXIMITY_COOLDOWN_MS     10000

#define WARNING_DURATION_MS       3000    // local warning pattern length
#define ALARM_MAX_MS              60000   // alarm silences itself after this (or on reset / disarm)

// ---- Networking ---------------------------------------------------------------------
#define HEARTBEAT_MS              5000    // POST /api/device/status interval (backend marks offline after 15 s)
#define COMMAND_POLL_MS           2000    // GET /api/device/commands interval
#define HTTP_TIMEOUT_MS           3000
#define EVENT_QUEUE_SIZE          20      // events buffered while offline; oldest dropped when full
#define OUTAGE_AFTER_FAILURES     3       // consecutive failed status posts before we call it an outage
#define NTP_SERVER                "pool.ntp.org"

#ifdef WOKWI_SIMULATION
  #define FIRMWARE_VERSION        "suraksha-fw-0.2.0-wokwi"
#else
  #define FIRMWARE_VERSION        "suraksha-fw-0.2.0"
#endif

// Set to 1 for Phase 1 of the build plan: pulse each LED and the buzzer once at boot.
#define RUN_OUTPUT_TEST_ON_BOOT   1
