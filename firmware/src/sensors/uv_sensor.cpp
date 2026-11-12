#include "uv_sensor.h"
#include "config.h"

void UvSensor::begin() {
#if ENABLE_UV_SENSOR
  if (PIN_UV_SENSOR >= 0) {
    pinMode(PIN_UV_SENSOR, INPUT);
    // Initial sample
    uint32_t sum = 0;
    for (int i = 0; i < 8; i++) {
      sum += analogRead(PIN_UV_SENSOR);
      delay(2);
    }
    float raw = sum / 8.0f;
    lastMv_ = (uint16_t)((raw * 3300.0f) / 4095.0f);
    lastIndex_ = (float)lastMv_ / 100.0f;
    if (lastIndex_ < 0.0f) lastIndex_ = 0.0f;
    if (lastIndex_ > 15.0f) lastIndex_ = 15.0f;
    Serial.printf("[uv] sensor initialized on GPIO%d: %.1f index (%u mV)\n", PIN_UV_SENSOR, lastIndex_, lastMv_);
  }
#else
  lastIndex_ = -1.0f;
#endif
}

bool UvSensor::update(uint32_t now) {
#if ENABLE_UV_SENSOR
  if (PIN_UV_SENSOR < 0) return false;
  if (now - lastSample_ < UV_SAMPLE_INTERVAL_MS) return false;
  lastSample_ = now;

  uint32_t sum = 0;
  for (int i = 0; i < 8; i++) {
    sum += analogRead(PIN_UV_SENSOR);
    delayMicroseconds(100);
  }
  float raw = sum / 8.0f;
  uint16_t mv = (uint16_t)((raw * 3300.0f) / 4095.0f);
  float index = (float)mv / 100.0f;
  if (index < 0.0f) index = 0.0f;
  if (index > 15.0f) index = 15.0f;

  bool changed = fabs(index - lastIndex_) >= 0.2f;
  lastMv_ = mv;
  lastIndex_ = index;
  return changed;
#else
  (void)now;
  return false;
#endif
}

