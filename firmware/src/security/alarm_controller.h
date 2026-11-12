#pragma once
#include <Arduino.h>

enum class AlarmLevel : uint8_t { Off, Warning, Alarm };

/** Non-blocking buzzer + LED patterns. Works entirely without Wi-Fi. */
class AlarmController {
 public:
  void begin();
  void update(uint32_t now);
  /** Never downgrades: a Warning does not interrupt a running Alarm. */
  void trigger(AlarmLevel level, uint32_t now);
  void reset();
  void setArmedIndicator(bool armed);
  /** Short chirps for local feedback (e.g. command refused). Blocks for a few hundred ms at most. */
  void chirp(uint8_t times);
  /** Phase 1 output test: each output once, in turn. */
  void selfTest();

  bool active() const { return level_ != AlarmLevel::Off; }
  AlarmLevel level() const { return level_; }

 private:
  void writeOutputs(bool on);
  AlarmLevel level_ = AlarmLevel::Off;
  uint32_t startedAt_ = 0;
};
