#pragma once
#include <Arduino.h>
#include "security/events.h"

struct ApiResult {
  bool ok = false;     // 2xx
  int httpCode = 0;    // <=0 means the request never completed (no network / backend down)
  /** 4xx other than auth/rate-limit: the backend will never accept this payload, so retrying is pointless. */
  bool permanentRejection() const { return httpCode >= 400 && httpCode < 500 && httpCode != 401 && httpCode != 408 && httpCode != 429; }
};

struct StatusReport {
  bool armed;
  bool doorOpen;
  bool vibrationTriggered;
  bool alarmActive;
  float proximityCm;  // negative = not available
  float uvIndex;      // negative = not available (environmental telemetry)
};

struct PendingCommand {
  uint32_t id;
  char commandType[16]; // "ARM", "DISARM", "SILENCE"
  bool arm;
};

/** Talks to the FastAPI backend (see docs/api-contract.md). Blocking - only call from the network task. */
class ApiClient {
 public:
  ApiResult postStatus(const StatusReport& s);
  ApiResult postEvent(const Event& e);
  /** `found` is set when the backend returned a pending command. */
  ApiResult pollCommand(bool& found, PendingCommand& cmd);
  ApiResult ackCommand(uint32_t id, bool success, const char* error);

 private:
  ApiResult send(const char* method, const String& path, const String& body, String* response);
};
