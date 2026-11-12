#include "api_client.h"
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include "config.h"
#include "secrets.h"

static const char* activeDeviceId() {
#ifdef WOKWI_SIMULATION
  return "suraksha-wokwi-01";
#else
  return DEVICE_ID;
#endif
}

ApiResult ApiClient::send(const char* method, const String& path, const String& body, String* response) {
  ApiResult r;
  String url = String(BACKEND_URL) + path;

  WiFiClient plain;
  WiFiClientSecure secure;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.setConnectTimeout(HTTP_TIMEOUT_MS);

  bool begun;
  if (url.startsWith("https://")) {
    secure.setInsecure();
    begun = http.begin(secure, url);
  } else {
    begun = http.begin(plain, url);
  }
  if (!begun) return r;

  http.addHeader("X-Device-Token", DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");

  r.httpCode = (strcmp(method, "GET") == 0) ? http.GET() : http.POST(body);
  r.ok = r.httpCode >= 200 && r.httpCode < 300;
  if (response && r.httpCode > 0) *response = http.getString();
  if (r.httpCode == 401) Serial.println("[api] 401 - DEVICE_TOKEN does not match backend/.env");
  http.end();
  return r;
}

ApiResult ApiClient::postStatus(const StatusReport& s) {
  JsonDocument doc;
  doc["device_id"] = activeDeviceId();
  doc["mode"] = s.armed ? "ARMED" : "DISARMED";
  doc["door_state"] = s.doorOpen ? "OPEN" : "CLOSED";
  doc["vibration_state"] = s.vibrationTriggered ? "TRIGGERED" : "IDLE";
  doc["alarm_active"] = s.alarmActive;
  if (s.proximityCm >= 0) doc["proximity_cm"] = s.proximityCm;
  if (s.uvIndex >= 0) doc["uv_index"] = s.uvIndex;
  doc["firmware_version"] = FIRMWARE_VERSION;
  char ts[24];
  if (isoTimestamp(ts, sizeof(ts))) doc["device_timestamp"] = ts;

  String body;
  serializeJson(doc, body);
  return send("POST", "/api/device/status", body, nullptr);
}

ApiResult ApiClient::postEvent(const Event& e) {
  JsonDocument doc;
  doc["device_id"] = activeDeviceId();
  doc["client_event_id"] = e.clientId;
  doc["event_type"] = eventTypeName(e.type);
  doc["severity"] = severityName(e.severity);
  doc["door_state"] = e.doorOpen ? "OPEN" : "CLOSED";
  doc["mode"] = e.armed ? "ARMED" : "DISARMED";
  doc["sensor_snapshot"]["vibration_triggered"] = e.vibrationTriggered;
  if (e.timestamp[0]) doc["device_timestamp"] = e.timestamp;

  String body;
  serializeJson(doc, body);
  return send("POST", "/api/device/events", body, nullptr);
}

ApiResult ApiClient::pollCommand(bool& found, PendingCommand& cmd) {
  found = false;
  String resp;
  ApiResult r = send("GET", String("/api/device/commands?device_id=") + activeDeviceId(), "", &resp);
  if (!r.ok) return r;

  JsonDocument doc;
  if (deserializeJson(doc, resp)) return r;
  JsonObject c = doc["command"];
  if (c.isNull()) return r;

  const char* type = c["command_type"] | "";
  cmd.id = c["command_id"] | 0;
  strlcpy(cmd.commandType, type, sizeof(cmd.commandType));
  cmd.arm = strcmp(type, "ARM") == 0;
  found = cmd.id != 0 && (cmd.arm || strcmp(type, "DISARM") == 0 || strcmp(type, "SILENCE") == 0);
  return r;
}

ApiResult ApiClient::ackCommand(uint32_t id, bool success, const char* error) {
  JsonDocument doc;
  doc["device_id"] = activeDeviceId();
  doc["success"] = success;
  if (!success && error) doc["error"] = error;

  String body;
  serializeJson(doc, body);
  return send("POST", String("/api/device/commands/") + id + "/ack", body, nullptr);
}
