#pragma once
#include <Arduino.h>

/** Magnetic reed switch. Reports a debounced OPEN/CLOSED state - never the lock state. */
class DoorSensor {
 public:
  void begin();
  /** Call every loop. Returns true once when the debounced state changes. */
  bool update(uint32_t now);
  bool isOpen() const { return open_; }

 private:
  bool readOpen() const;
  bool open_ = false;       // debounced
  bool candidate_ = false;  // last raw reading
  uint32_t candidateSince_ = 0;
};
