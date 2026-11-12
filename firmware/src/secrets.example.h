#pragma once
// Copy this file to secrets.h (git-ignored) and fill it in. Never commit secrets.h.

#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// Address of the FastAPI backend as reachable FROM THE ESP32 (not "localhost").
// Find your PC's LAN IP with `ipconfig`, and start the backend with --host 0.0.0.0.
#define BACKEND_URL "http://192.168.1.50:8000"

// Must equal DEVICE_TOKEN in backend/.env
#define DEVICE_TOKEN "change-me-device-token"

// Must equal DEFAULT_DEVICE_ID in backend/.env (the dashboard shows this device).
#define DEVICE_ID "suraksha-esp32-01"
