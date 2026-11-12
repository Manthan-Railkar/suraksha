# Suraksha (सुरक्षा) - Smart Door Security & Intrusion Detection System

Suraksha is an open-source, hybrid IoT smart door security and intrusion detection system. It connects physical ESP32 hardware and virtual simulated devices (via Wokwi and a Python software simulator) to a unified FastAPI backend and a Next.js 14 dashboard.

---

## 🌟 Key Features

1. **Hybrid Device Architecture**:
   - **Physical ESP32**: Reed switch (GPIO32), SW-420 vibration sensor (GPIO23), active buzzer (GPIO15), armed LED (GPIO27), alarm LED (GPIO14), and an analog UV sensor (GPIO35) for environmental telemetry.
   - **Wokwi Circuit Simulation**: Full virtual circuit with slide switch (door), push-button with pulldown (vibration), potentiometer (UV sensor), LEDs, buzzer, and `Wokwi-GUEST` WiFi.
   - **Software Device Simulator**: Interactive CLI device (`backend/simulate_device.py`) to test events, arming, door trips, and UV changes.

2. **Decoupled Environmental Telemetry**:
   - Integrated analog UV photodiode sensor mapped to WHO UV Index (0.0 to 15.0).
   - Strictly isolated from the intrusion detection state machine — UV index fluctuations **never** cause false alarms.

3. **Intelligent Intrusion Detection**:
   - **Instant Door Breach Alert**: `DOOR_OPEN_WHILE_ARMED` (Severity: HIGH) triggers local siren and alarm LED immediately.
   - **Multi-Knock / Tampering Alert**: `REPEATED_VIBRATION` (Severity: WARNING) filters transient bumps while detecting persistent knocking.
   - **Suspicious Entry Alert**: `VIBRATION_THEN_DOOR_OPEN` (Severity: HIGH) tracks vibrations preceding a door open within a configurable time window.
   - **Local Autonomy**: All alarm logic executes locally on the ESP32 in under 10 ms — alarms sound even if Wi-Fi or backend is offline. Offline events are queued in circular RAM and delivered upon reconnect.

4. **Bidirectional Command Dispatch**:
   - Dashboard ARM/DISARM requests travel through FastAPI to the specific target device.
   - Device validates conditions (e.g. refuses to arm if the door is open) and posts an ACK with status.
   - Multi-device selector allows seamless switching between physical and simulated devices on all dashboard views.

---

## 📁 Repository Structure

```
suraksha/
├── backend/            # FastAPI + SQLite backend & Python CLI simulator
│   ├── main.py         # REST API server & database schema
│   ├── simulate_device.py # Interactive CLI device simulator
│   ├── test_api.py     # Comprehensive automated test suite
│   ├── requirements.txt
│   └── .env.example
├── dashboard/          # Next.js 14 + React + TypeScript + Tailwind CSS dashboard
│   ├── src/
│   │   ├── app/        # App router (/overview, /device, /alerts, /history, /settings)
│   │   ├── components/ # View components, DeviceSelector, ArmControl, Live cards
│   │   └── lib/        # API client, DeviceContext, theme provider
│   └── package.json
├── firmware/           # PlatformIO ESP32 firmware (C++ / Arduino)
│   ├── src/            # main.cpp, sensors (door, vibration, UV), network, security
│   ├── diagram.json    # Wokwi simulation circuit diagram
│   ├── wokwi.toml      # Wokwi simulator configuration
│   └── platformio.ini  # Environments for [esp32dev] and [wokwi]
├── docs/               # Architecture, API contract, wiring guide, test plan
└── diagram.json        # Root-level Wokwi simulation circuit diagram
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment configuration
copy .env.example .env

# Run automated tests
pytest test_api.py -v

# Start the backend server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend API documentation is available at `http://localhost:8000/docs`.

### 2. Frontend Dashboard Setup

```bash
cd dashboard

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit `http://localhost:3000` and sign in with:
- **Username**: `admin`
- **Password**: `suraksha2026` (or the credentials set in `backend/.env`)

### 3. ESP32 Firmware & Wokwi Simulation

#### Wokwi Simulation:
1. Open the project in VS Code with the Wokwi extension, or upload `firmware/diagram.json` and compiled binary to [wokwi.com](https://wokwi.com).
2. Build the simulation target using PlatformIO:
   ```bash
   cd firmware
   pio run -e wokwi
   ```
3. Run the simulation. The simulated ESP32 connects to `Wokwi-GUEST` and registers as `suraksha-wokwi-01`.

#### Physical ESP32 Hardware:
1. Configure credentials in `firmware/src/secrets.h`:
   ```c
   #define WIFI_SSID "Your-SSID"
   #define WIFI_PASSWORD "Your-Password"
   #define BACKEND_URL "http://<YOUR_PC_LAN_IP>:8000"
   #define DEVICE_TOKEN "dev_token_change_in_production"
   #define DEVICE_ID "suraksha-esp32-01"
   ```
2. Build and flash:
   ```bash
   cd firmware
   pio run -e esp32dev -t upload
   pio device monitor
   ```

### 4. Software Device Simulator (No Hardware Needed)

You can also simulate a connected device directly via Python:

```bash
cd backend
python simulate_device.py --device-id suraksha-sim-01
```

**Interactive Controls**:
- `o` : Open door
- `c` : Close door
- `v` : Knock / trigger vibration
- `u` : Cycle UV Index level (0.0 -> 2.5 -> 5.8 -> 8.2 -> 11.5)
- `r` : Disarm / reset alarm
- `q` : Quit

---

## 🔒 Hardware Pinout Reference (ESP32)

| Component | Pin | Notes |
|---|---|---|
| Reed Switch | **GPIO32** | Active LOW, internal pull-up enabled |
| Vibration Sensor (SW-420) | **GPIO23** | Active HIGH digital output |
| Buzzer | **GPIO15** | Active HIGH / PWM drive |
| Armed Indicator LED | **GPIO27** | Green LED (active HIGH) |
| Alarm Indicator LED | **GPIO14** | Red LED (active HIGH) |
| UV Sensor (Analog Out) | **GPIO35** | ADC1 Channel 7 (0-3.3V mapped to UV Index) |

---

## 🧪 Testing and Verification

Run the automated backend test suite:
```bash
cd backend
pytest test_api.py -v
```

All 7 test suites verify:
- Ingestion of UV telemetry and device status.
- Door open rejection when attempting to ARM.
- Event deduplication via `client_event_id`.
- Multi-device listing and isolation.
- Bidirectional ARM/DISARM command lifecycle.

---

## 📄 License
MIT License. See [LICENSE](LICENSE) for details.

