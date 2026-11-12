#include "wifi_manager.h"
#include <WiFi.h>
#include <time.h>
#include "config.h"
#include "secrets.h"

void WifiManager::begin() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastAttempt_ = lastConnected_ = millis();
  configTime(0, 0, NTP_SERVER);  // UTC; SNTP keeps retrying until Wi-Fi is up
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);
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
    Serial.println("[wifi] reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}
