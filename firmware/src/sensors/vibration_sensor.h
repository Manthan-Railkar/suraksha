#pragma once
#include <Arduino.h>

/** Digital vibration module. Reports a vibration/impact - not forced entry. */
class VibrationSensor {
 public:
  void begin();
  /** Call every loop. Returns true once per new trigger (rising edge, chatter filtered). */
  bool update(uint32_t now);
  /** True if a trigger happened within the last `ms` milliseconds. */
  bool triggeredWithin(uint32_t now, uint32_t ms) const { return everTriggered_ && now - lastTrigger_ <= ms; }

 private:
  bool prevActive_ = false;
  bool everTriggered_ = false;
  uint32_t lastTrigger_ = 0;
};
