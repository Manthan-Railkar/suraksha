#pragma once
#include <Arduino.h>
#include "events.h"
#include "alarm_controller.h"

/**
 * Mode (ARMED/DISARMED) plus the explicit rules from blueprint section 8.
 * Deterministic and rule-based; mirrors backend/simulate_device.py. Runs on the sensing task only.
 */
class SecurityState {
 public:
  using EventSink = void (*)(const Event&);

  /** Loads the saved mode (so a reboot while armed stays armed). `doorOpen` is the initial reading. */
  void begin(AlarmController* alarm, EventSink sink, bool doorOpen);

  bool armed() const { return armed_; }
  bool doorOpen() const { return doorOpen_; }
  void setArmed(bool armed);

  void onDoorChanged(bool open, uint32_t now);
  void onVibration(uint32_t now);
  void onProximity();
  /** True if the vibration sensor fired within the last `ms`. */
  bool vibrationWithin(uint32_t now, uint32_t ms) const { return anyVibration_ && now - lastVibration_ <= ms; }

 private:
  void emit(EventType type, Severity severity);

  AlarmController* alarm_ = nullptr;
  EventSink sink_ = nullptr;
  bool armed_ = false;
  bool doorOpen_ = false;
  bool anyVibration_ = false;
  uint32_t lastVibration_ = 0;
  uint32_t knocks_[8] = {0};
  uint8_t knockCount_ = 0;
};
