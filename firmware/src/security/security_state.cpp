#include "security_state.h"
#include <Preferences.h>
#include "config.h"

static Preferences prefs;

void SecurityState::begin(AlarmController* alarm, EventSink sink, bool doorOpen) {
  alarm_ = alarm;
  sink_ = sink;
  doorOpen_ = doorOpen;
  prefs.begin("suraksha", false);
  armed_ = prefs.getBool("armed", false);
  alarm_->setArmedIndicator(armed_);
}

void SecurityState::setArmed(bool armed) {
  if (armed != armed_) {
    armed_ = armed;
    prefs.putBool("armed", armed_);
  }
  knockCount_ = 0;
  alarm_->reset();  // arming/disarming always starts from a quiet state
  alarm_->setArmedIndicator(armed_);
}

void SecurityState::emit(EventType type, Severity severity) {
  if (sink_) sink_(makeEvent(type, severity, doorOpen_, armed_, anyVibration_));
}

void SecurityState::onDoorChanged(bool open, uint32_t now) {
  doorOpen_ = open;
  if (open) {
    if (armed_) {
      alarm_->trigger(AlarmLevel::Alarm, now);
      // Vibration shortly before the door opened: higher priority, but still only "suspicious".
      if (vibrationWithin(now, COMBO_WINDOW_MS)) emit(EventType::VibrationThenDoorOpen, Severity::High);
      else emit(EventType::DoorOpenWhileArmed, Severity::High);
    } else {
      emit(EventType::DoorOpenDisarmed, Severity::Info);  // no intrusion alarm while disarmed
    }
  } else {
    emit(EventType::DoorClosed, Severity::Info);  // earlier alerts stay in history; the alarm is not silently cleared
  }
}

void SecurityState::onVibration(uint32_t now) {
  anyVibration_ = true;
  lastVibration_ = now;
  if (doorOpen_) return;

  // Keep only the knocks inside the window, then add this one.
  uint8_t kept = 0;
  for (uint8_t i = 0; i < knockCount_; i++)
    if (now - knocks_[i] <= VIB_WINDOW_MS) knocks_[kept++] = knocks_[i];
  knockCount_ = kept;
  if (knockCount_ < (sizeof(knocks_) / sizeof(knocks_[0]))) knocks_[knockCount_++] = now;

  if (knockCount_ >= VIB_COUNT_THRESHOLD) {
    knockCount_ = 0;
    if (armed_) {
      alarm_->trigger(AlarmLevel::Warning, now);
      emit(EventType::RepeatedVibration, Severity::Warning);
    } else {
      // Disarmed continuous/repeated vibration: recorded in event history as INFO
      emit(EventType::RepeatedVibration, Severity::Info);
    }
  }
}

void SecurityState::onProximity() {
  emit(EventType::ProximityDetected, Severity::Info);  // proximity only - no identity or intent is inferred
}
