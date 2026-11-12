#pragma once
#include <Arduino.h>

/** Connects, reconnects after loss, and starts NTP. Runs on the network task. */
class WifiManager {
 public:
  void begin();
  void loop(uint32_t now);
  bool connected() const;
  /** Milliseconds since Wi-Fi was last connected (0 while connected). */
  uint32_t downForMs(uint32_t now) const;

 private:
  uint32_t lastAttempt_ = 0;
  uint32_t lastConnected_ = 0;
};
