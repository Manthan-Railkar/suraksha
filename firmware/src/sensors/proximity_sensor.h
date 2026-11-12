#pragma once
#include <Arduino.h>

/**
 * OPTIONAL HC-SR04. Reports "an object is within range" - it cannot tell a person from a thing.
 * Compiled to a no-op unless ENABLE_PROXIMITY is 1 in config.h.
 */
class ProximitySensor {
 public:
  void begin();
  /** Measures about twice a second. Returns true when a NEW nearby object is detected (with cooldown). */
  bool update(uint32_t now);
  /** Last distance in cm, or a negative value if none/not measured. */
  float lastCm() const { return lastCm_; }

 private:
  float lastCm_ = -1;
  uint32_t lastMeasure_ = 0;
  uint32_t lastEvent_ = 0;
  bool everEvent_ = false;
  bool near_ = false;
};
