#include "vibration_sensor.h"
#include "config.h"

void VibrationSensor::begin() { pinMode(PIN_VIBRATION, INPUT); }

bool VibrationSensor::update(uint32_t now) {
  bool active = digitalRead(PIN_VIBRATION) == VIB_ACTIVE_LEVEL;
  bool fired = false;
  if (active && !prevActive_ && (!everTriggered_ || now - lastTrigger_ >= VIB_MIN_GAP_MS)) {
    lastTrigger_ = now;
    everTriggered_ = true;
    fired = true;
  }
  prevActive_ = active;
  return fired;
}
