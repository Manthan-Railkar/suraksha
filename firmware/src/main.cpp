/*
 * Suraksha - door monitoring and intrusion alerts (ESP32, EDU-ROBO V14 trainer board).
 *
 * Two tasks, so a slow or dead network can never delay sensing or the local alarm:
 *   - Arduino loop() (core 1): sensors -> rules -> buzzer/LEDs. Needs no Wi-Fi.
 *   - netTask (core 0):        Wi-Fi, status heartbeat, event upload with retry, command polling.
 * They only share a small snapshot, an event queue and a one-slot command mailbox.
 *
 * Suraksha only MONITORS the door. It never locks, unlocks or actuates the mechanical lock.
 * UV sensor data is independent environmental telemetry and never interpreted as an intrusion event.
 */
#include <Arduino.h>
#include "config.h"
#include "sensors/door_sensor.h"
#include "sensors/vibration_sensor.h"
#include "sensors/proximity_sensor.h"
#include "sensors/uv_sensor.h"
#include "security/alarm_controller.h"
#include "security/security_state.h"
#include "network/api_client.h"
#include "network/event_queue.h"
#include "network/wifi_manager.h"

// ---- sensing-task objects ------------------------------------------------------------
static DoorSensor door;
static VibrationSensor vibration;
static ProximitySensor proximity;
static UvSensor uvSensor;
static AlarmController alarmCtl;  // not "alarm": that collides with POSIX alarm()
static SecurityState security;
static EventQueue eventQueue;

// ---- state shared between the two tasks (guarded by g_mux) ----------------------------
struct Shared {
  bool armed = false, doorOpen = false, vibration = false, alarm = false;
  float proximityCm = -1;
  float uvIndex = -1;       // Environmental telemetry only
  bool dirty = true;        // something changed -> send a status report now instead of waiting for the heartbeat

  bool cmdPending = false;  // network task -> sensing task
  PendingCommand cmd{};

  bool resultReady = false; // sensing task -> network task
  uint32_t resultId = 0;
  bool resultOk = false;
  char resultError[64] = {0};
};
static Shared g;
static SemaphoreHandle_t g_mux;
#define LOCK() xSemaphoreTake(g_mux, portMAX_DELAY)
#define UNLOCK() xSemaphoreGive(g_mux)

static void onEvent(const Event& e) {
  eventQueue.push(e);
  Serial.printf("[event] %s (%s) queued, %u waiting\n", eventTypeName(e.type), severityName(e.severity), eventQueue.size());
}

// ---------------------------------------------------------------------------------------
//  Sensing side
// ---------------------------------------------------------------------------------------
static void publishSnapshot(uint32_t now) {
  bool vib = security.vibrationWithin(now, 3000);
  LOCK();
  bool changed = g.armed != security.armed() || g.doorOpen != security.doorOpen() || g.vibration != vib || g.alarm != alarmCtl.active();
  g.armed = security.armed();
  g.doorOpen = security.doorOpen();
  g.vibration = vib;
  g.alarm = alarmCtl.active();
  g.proximityCm = proximity.lastCm();
  g.uvIndex = uvSensor.lastUvIndex();
  if (changed) g.dirty = true;
  UNLOCK();
}

/** Applies a dashboard ARM/DISARM/SILENCE that the network task left in the mailbox, then reports the outcome. */
static void handleCommand(uint32_t now) {
  LOCK();
  bool pending = g.cmdPending;
  PendingCommand cmd = g.cmd;
  UNLOCK();
  if (!pending) return;

  bool ok = true;
  const char* err = "";
  if (strcmp(cmd.commandType, "SILENCE") == 0) {
    // User acknowledged/approved alert on dashboard: silence after 5 seconds (5000ms)
    alarmCtl.silenceAfter(5000, now);
    Serial.println("[cmd] SILENCE applied: alarm will stop in 5 seconds");
  } else if (cmd.arm && security.doorOpen()) {
    ok = false;
    err = "Door is open - close it before arming";
    Serial.println("[cmd] ARM rejected: door is open");
  } else {
    security.setArmed(cmd.arm);
    Serial.printf("[cmd] %s applied\n", cmd.arm ? "ARM" : "DISARM");
  }

  LOCK();
  g.cmdPending = false;
  g.resultReady = true;
  g.resultId = cmd.id;
  g.resultOk = ok;
  strlcpy(g.resultError, err, sizeof(g.resultError));
  g.dirty = true;
  UNLOCK();
}

/** Optional local button: silences a running alarm, otherwise toggles armed/disarmed. */
static void handleButton(uint32_t now) {
  if (PIN_MODE_BUTTON < 0) return;
  static bool prev = HIGH;
  static uint32_t lastChange = 0;
  bool level = digitalRead(PIN_MODE_BUTTON);
  if (level != prev && now - lastChange > 50) {
    lastChange = now;
    prev = level;
    if (level == LOW) {
      if (alarmCtl.active()) {
        alarmCtl.reset();
      } else if (!security.armed() && security.doorOpen()) {
        alarmCtl.chirp(3);  // refuse: arming with the door open
      } else {
        security.setArmed(!security.armed());
        alarmCtl.chirp(security.armed() ? 2 : 1);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------
//  Network side
// ---------------------------------------------------------------------------------------
static void pushOutageEvent(EventType type, Severity sev) {
  LOCK();
  Event e = makeEvent(type, sev, g.doorOpen, g.armed, g.vibration);
  UNLOCK();
  onEvent(e);
}

static void netTask(void*) {
  WifiManager wifi;
  ApiClient api;
  wifi.begin();

  uint32_t lastHeartbeat = 0, lastPoll = 0, nextFlushAt = 0;
  int failures = 0;
  bool outage = false;

  auto enterOutage = [&]() {
    if (outage) return;
    outage = true;
    Serial.println("[net] outage - local sensing and alarm continue; events are queued");
    pushOutageEvent(EventType::DeviceOffline, Severity::Warning);  // delivered after reconnection
  };

  for (;;) {
    uint32_t now = millis();
    wifi.loop(now);

    if (!wifi.connected()) {
      if (wifi.downForMs(now) > 15000) enterOutage();
      vTaskDelay(pdMS_TO_TICKS(200));
      continue;
    }

    // 1) Heartbeat + current state (including UV environmental telemetry)
    LOCK();
    bool sendNow = g.dirty;
    StatusReport rep{g.armed, g.doorOpen, g.vibration, g.alarm, g.proximityCm, g.uvIndex};
    UNLOCK();
    if (sendNow || now - lastHeartbeat >= HEARTBEAT_MS) {
      lastHeartbeat = now;
      LOCK();
      g.dirty = false;
      UNLOCK();
      ApiResult r = api.postStatus(rep);
      if (r.ok) {
        failures = 0;
        if (outage) {
          outage = false;
          Serial.println("[net] back online");
          pushOutageEvent(EventType::SyncRestored, Severity::Info);
        }
      } else if (++failures >= OUTAGE_AFTER_FAILURES) {
        enterOutage();
      }
    }

    // 2) Upload queued events, oldest first. A failure keeps the event for the next attempt.
    if (now >= nextFlushAt) {
      Event e;
      while (eventQueue.peek(e)) {
        ApiResult r = api.postEvent(e);
        if (r.ok || r.permanentRejection()) {  // duplicate (200) is fine; a rejected payload would block the queue forever
          if (!r.ok) Serial.printf("[net] backend rejected %s (HTTP %d) - dropping it\n", eventTypeName(e.type), r.httpCode);
          eventQueue.pop();
        } else {
          nextFlushAt = now + 5000;
          break;
        }
      }
    }

    // 3) Report the outcome of the last command first, then look for a new one
    LOCK();
    bool resultReady = g.resultReady;
    uint32_t resultId = g.resultId;
    bool resultOk = g.resultOk;
    char resultErr[64];
    strlcpy(resultErr, g.resultError, sizeof(resultErr));
    bool busy = g.cmdPending;
    UNLOCK();

    if (resultReady) {
      ApiResult r = api.ackCommand(resultId, resultOk, resultErr);
      if (r.ok || r.permanentRejection()) {  // 404 = it already expired/was replaced; nothing left to confirm
        LOCK();
        g.resultReady = false;
        UNLOCK();
      }
    } else if (!busy && now - lastPoll >= COMMAND_POLL_MS) {
      lastPoll = now;
      bool found = false;
      PendingCommand cmd{};
      ApiResult r = api.pollCommand(found, cmd);
      if (r.ok && found) {
        LOCK();
        g.cmd = cmd;
        g.cmdPending = true;
        UNLOCK();
      }
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ---------------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.printf("\nSuraksha %s starting\n", FIRMWARE_VERSION);
  Serial.printf("pins: reed=%d vib=%d buzzer=%d ledArmed=%d ledAlarm=%d uv=%d button=%d\n",
                PIN_REED_SWITCH, PIN_VIBRATION, PIN_BUZZER,
                PIN_LED_ARMED, PIN_LED_ALARM, PIN_UV_SENSOR, PIN_MODE_BUTTON);

  g_mux = xSemaphoreCreateMutex();

  alarmCtl.begin();
#if RUN_OUTPUT_TEST_ON_BOOT
  alarmCtl.selfTest();
#endif
  if (PIN_MODE_BUTTON >= 0) pinMode(PIN_MODE_BUTTON, INPUT_PULLUP);
  door.begin();
  vibration.begin();
  proximity.begin();
  uvSensor.begin();
  security.begin(&alarmCtl, onEvent, door.isOpen());
  publishSnapshot(millis());

  Serial.printf("door=%s mode=%s uv=%.1f\n", door.isOpen() ? "OPEN" : "CLOSED", security.armed() ? "ARMED" : "DISARMED", uvSensor.lastUvIndex());

  xTaskCreatePinnedToCore(netTask, "net", 12288, nullptr, 1, nullptr, 0);
}

void loop() {
  uint32_t now = millis();

  if (door.update(now)) {
    Serial.printf("[door] %s\n", door.isOpen() ? "OPEN" : "CLOSED");
    security.onDoorChanged(door.isOpen(), now);
  }
  if (vibration.update(now)) {
    Serial.println("[vibration] trigger");
    security.onVibration(now);
  }
  if (proximity.update(now)) {
    Serial.printf("[proximity] object at %.0f cm\n", proximity.lastCm());
    security.onProximity();
  }
  if (uvSensor.update(now)) {
    // Environmental telemetry updated - will be sent with heartbeat
    publishSnapshot(now);
  }

  handleButton(now);
  handleCommand(now);
  alarmCtl.update(now);
  publishSnapshot(now);
  delay(2);
}
