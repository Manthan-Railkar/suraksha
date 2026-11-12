#include "wifi_manager.h"
#include <WiFi.h>
#include <time.h>
#include "config.h"
#include "secrets.h"

static const char* activeSsid() {
#ifdef WOKWI_SIMULATION
  return "Wokwi-GUEST";
#else
  return WIFI_SSID;
#endif
}

static const char* activePass() {
#ifdef WOKWI_SIMULATION
  return "";
#else
  return WIFI_PASSWORD;
#endif
}

void WifiManager::begin() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(activeSsid(), activePass());
  lastAttempt_ = lastConnected_ = millis();
  configTime(0, 0, NTP_SERVER);  // UTC; SNTP keeps retrying until Wi-Fi is up
  Serial.printf("[wifi] connecting to %s\n", activeSsid());
}

bool WifiManager::connected() const { return WiFi.status() == WL_CONNECTED; }

uint32_t WifiManager::downForMs(uint32_t now) const { return connected() ? 0 : now - lastConnected_; }

void WifiManager::loop(uint32_t now) {
  if (connected()) {
    lastConnected_ = now;
    return;
  }
  if (now - lastAttempt_ >= 8000) {  // still down: kick a fresh attempt
    lastAttempt_ = now;
    Serial.printf("[wifi] reconnecting to %s...\n", activeSsid());
    WiFi.disconnect();
    WiFi.begin(activeSsid(), activePass());
  }
}
