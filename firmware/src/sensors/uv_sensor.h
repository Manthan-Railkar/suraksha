#pragma once
#include <Arduino.h>

/**
 * Analog UV Sensor (e.g. GUVA-S12SD, MP8511, or analog simulation).
 * Strictly for independent environmental telemetry.
 * NEVER passed to SecurityState or interpreted as an intrusion alert.
 */
class UvSensor {
 public:
  void begin();
  /** Samples the analog pin every 1000 ms and updates the smoothed UV reading. */
  bool update(uint32_t now);
  /** Returns the latest calculated UV Index (0.0 to 15.0). Returns negative if disabled. */
  float lastUvIndex() const { return lastIndex_; }
  /** Returns raw ADC millivolts reading. */
  uint16_t lastMillivolts() const { return lastMv_; }

 private:
  float lastIndex_ = -1.0f;
  uint16_t lastMv_ = 0;
  uint32_t lastSample_ = 0;
};
