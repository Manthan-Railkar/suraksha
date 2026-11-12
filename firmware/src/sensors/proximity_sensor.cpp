#include "proximity_sensor.h"
#include "config.h"

#if ENABLE_PROXIMITY

void ProximitySensor::begin() {
  pinMode(PIN_PROX_TRIG, OUTPUT);
  pinMode(PIN_PROX_ECHO, INPUT);
  digitalWrite(PIN_PROX_TRIG, LOW);
}

bool ProximitySensor::update(uint32_t now) {
  if (now - lastMeasure_ < 500) return false;
  lastMeasure_ = now;

  digitalWrite(PIN_PROX_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_PROX_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_PROX_TRIG, LOW);

  unsigned long us = pulseIn(PIN_PROX_ECHO, HIGH, 12000);  // ~2 m max; keeps the loop responsive
  if (us == 0) {
    lastCm_ = -1;
    near_ = false;
    return false;
  }
  lastCm_ = us / 58.0f;

  bool nowNear = lastCm_ <= PROXIMITY_THRESHOLD_CM;
  bool fire = nowNear && !near_ && (!everEvent_ || now - lastEvent_ >= PROXIMITY_COOLDOWN_MS);
  near_ = nowNear;
  if (fire) {
    lastEvent_ = now;
    everEvent_ = true;
  }
  return fire;
}

#else

void ProximitySensor::begin() {}
bool ProximitySensor::update(uint32_t) { return false; }

#endif
