#include "door_sensor.h"
#include "config.h"

bool DoorSensor::readOpen() const { return digitalRead(PIN_REED_SWITCH) != REED_CLOSED_LEVEL; }

void DoorSensor::begin() {
  pinMode(PIN_REED_SWITCH, INPUT_PULLUP);
  open_ = candidate_ = readOpen();
  candidateSince_ = millis();
}

bool DoorSensor::update(uint32_t now) {
  bool raw = readOpen();
  if (raw != candidate_) {  // reading moved: restart the stability timer
    candidate_ = raw;
    candidateSince_ = now;
    return false;
  }
  if (candidate_ != open_ && now - candidateSince_ >= DOOR_DEBOUNCE_MS) {
    open_ = candidate_;
    return true;
  }
  return false;
}
