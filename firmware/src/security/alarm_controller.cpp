#include "alarm_controller.h"
#include "config.h"

static inline void put(int pin, bool on, int onLevel) {
  if (pin < 0) return;
  digitalWrite(pin, on ? onLevel : !onLevel);
}

void AlarmController::begin() {
  if (PIN_BUZZER >= 0) pinMode(PIN_BUZZER, OUTPUT);
  if (PIN_LED_ARMED >= 0) pinMode(PIN_LED_ARMED, OUTPUT);
  if (PIN_LED_ALARM >= 0) pinMode(PIN_LED_ALARM, OUTPUT);
  put(PIN_BUZZER, false, BUZZER_ON_LEVEL);
  put(PIN_LED_ARMED, false, LED_ON_LEVEL);
  put(PIN_LED_ALARM, false, LED_ON_LEVEL);
}

void AlarmController::writeOutputs(bool on) {
  put(PIN_BUZZER, on, BUZZER_ON_LEVEL);
  put(PIN_LED_ALARM, on, LED_ON_LEVEL);
}

void AlarmController::trigger(AlarmLevel level, uint32_t now) {
  if (level == AlarmLevel::Off) return;
  if (level_ == AlarmLevel::Alarm && level == AlarmLevel::Warning) return;
  if (level != level_) {
    level_ = level;
    startedAt_ = now;
  }
}

void AlarmController::reset() {
  level_ = AlarmLevel::Off;
  silenceAt_ = 0;
  writeOutputs(false);
}

void AlarmController::silenceAfter(uint32_t ms, uint32_t now) {
  if (level_ == AlarmLevel::Off) return;
  silenceAt_ = now + ms;
}

void AlarmController::setArmedIndicator(bool armed) { put(PIN_LED_ARMED, armed, LED_ON_LEVEL); }

void AlarmController::update(uint32_t now) {
  if (level_ == AlarmLevel::Off) return;
  if (silenceAt_ != 0 && (int32_t)(now - silenceAt_) >= 0) {
    return reset();
  }
  uint32_t elapsed = now - startedAt_;

  if (level_ == AlarmLevel::Warning) {
    if (elapsed >= WARNING_DURATION_MS) return reset();
    writeOutputs((elapsed % 300) < 150);  // quick beeps
  } else {
    if (elapsed >= ALARM_MAX_MS) return reset();
    writeOutputs((elapsed % 1000) < 500);  // 1 Hz on/off
  }
}

void AlarmController::chirp(uint8_t times) {
  for (uint8_t i = 0; i < times; i++) {
    put(PIN_BUZZER, true, BUZZER_ON_LEVEL);
    delay(80);
    put(PIN_BUZZER, false, BUZZER_ON_LEVEL);
    delay(80);
  }
}

void AlarmController::selfTest() {
  Serial.println("[test] armed LED");
  put(PIN_LED_ARMED, true, LED_ON_LEVEL);
  delay(400);
  put(PIN_LED_ARMED, false, LED_ON_LEVEL);
  Serial.println("[test] alarm LED");
  put(PIN_LED_ALARM, true, LED_ON_LEVEL);
  delay(400);
  put(PIN_LED_ALARM, false, LED_ON_LEVEL);
  Serial.println("[test] buzzer");
  put(PIN_BUZZER, true, BUZZER_ON_LEVEL);
  delay(200);
  put(PIN_BUZZER, false, BUZZER_ON_LEVEL);
}
