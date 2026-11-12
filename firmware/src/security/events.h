#pragma once
#include <Arduino.h>

// Event names must match EVENT_TYPES in backend/main.py.
enum class EventType : uint8_t {
  DoorOpenWhileArmed,
  DoorClosed,
  RepeatedVibration,
  VibrationThenDoorOpen,
  DoorOpenDisarmed,
  DeviceOffline,
  SyncRestored,
  ProximityDetected,
};

enum class Severity : uint8_t { Info, Warning, High };

const char* eventTypeName(EventType t);
const char* severityName(Severity s);

struct Event {
  EventType type;
  Severity severity;
  bool doorOpen;
  bool armed;
  bool vibrationTriggered;
  char clientId[28];   // unique per event so re-sending after an outage never duplicates it
  char timestamp[24];  // ISO-8601 UTC, empty if the clock was not yet synced (device time is approximate)
};

Event makeEvent(EventType type, Severity severity, bool doorOpen, bool armed, bool vibrationTriggered);

/** Writes the current UTC time as ISO-8601; returns false (and an empty string) if NTP has not synced yet. */
bool isoTimestamp(char* out, size_t len);
