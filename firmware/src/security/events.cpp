#include "events.h"
#include <atomic>
#include <time.h>
#include "esp_system.h"

const char* eventTypeName(EventType t) {
  switch (t) {
    case EventType::DoorOpenWhileArmed: return "DOOR_OPEN_WHILE_ARMED";
    case EventType::DoorClosed: return "DOOR_CLOSED";
    case EventType::RepeatedVibration: return "REPEATED_VIBRATION";
    case EventType::VibrationThenDoorOpen: return "VIBRATION_THEN_DOOR_OPEN";
    case EventType::DoorOpenDisarmed: return "DOOR_OPEN_DISARMED";
    case EventType::DeviceOffline: return "DEVICE_OFFLINE";
    case EventType::SyncRestored: return "SYNC_RESTORED";
    case EventType::ProximityDetected: return "PROXIMITY_DETECTED";
  }
  return "";
}

const char* severityName(Severity s) {
  switch (s) {
    case Severity::Info: return "INFO";
    case Severity::Warning: return "WARNING";
    case Severity::High: return "HIGH";
  }
  return "INFO";
}

bool isoTimestamp(char* out, size_t len) {
  time_t now = time(nullptr);
  if (now < 1700000000) {  // clock still at 1970 -> NTP not synced
    if (len) out[0] = '\0';
    return false;
  }
  struct tm tmv;
  gmtime_r(&now, &tmv);
  strftime(out, len, "%Y-%m-%dT%H:%M:%SZ", &tmv);
  return true;
}

Event makeEvent(EventType type, Severity severity, bool doorOpen, bool armed, bool vibrationTriggered) {
  static const uint32_t bootId = esp_random();  // new every boot
  static std::atomic<uint32_t> counter{0};      // makeEvent is called from both tasks

  Event e{};
  e.type = type;
  e.severity = severity;
  e.doorOpen = doorOpen;
  e.armed = armed;
  e.vibrationTriggered = vibrationTriggered;
  snprintf(e.clientId, sizeof(e.clientId), "%08x-%lu", (unsigned)bootId, (unsigned long)++counter);
  isoTimestamp(e.timestamp, sizeof(e.timestamp));
  return e;
}
