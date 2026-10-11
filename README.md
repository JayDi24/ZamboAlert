ZamboAlert
An IoT-based emergency communication system for barangay disaster response in Zamboanga City. ZamboAlert uses a LoRa mesh network with a Bluetooth fallback to let citizens send SOS signals and help rescuers locate them, even when cellular networks and power are down.


The Problem
During typhoons, floods, and storm surges, Zamboanga City frequently loses cellular and power service. This leaves trapped citizens unable to call for help and leaves rescuers with no way to locate them.


What It Does
Citizen Mobile App – broadcasts an offline SOS signal via Bluetooth
Rescuer Mobile App – shows nearby distress signals and guides rescuers to victims using GPS and signal strength
Barangay Web Dashboard – lets officials monitor incoming alerts and dispatch rescuers in real time


How It Works
A citizen's phone broadcasts a Bluetooth SOS signal.
A rescuer's wearable device (ESP32 + LoRa) picks up the signal and estimates the victim's location.
The data is relayed across the LoRa mesh, node to node, back to the barangay gateway.
The web dashboard displays the alert in real time, and officials dispatch help.


Tech Stack
App: React Native
Backend: Node.js, Express
Database: SQLite (mobile), PostgreSQL (gateway)
Hardware: ESP32, LoRa SX1278 (433MHz), NEO-6M GPS Module


Capstone Project, College of Computing Studies, Western Mindanao State University


## LoRa gateway and pod integration

The ESP32 firmware for the gateway and rescuer pod is in [`firmware/`](./firmware).
The merged backend stores authenticated gateway reports in its JSON database at
`POST /api/telemetry`
and returns reports received in the last 90 seconds from `GET /api/telemetry`.
The web dashboard polls that endpoint every three seconds and shows GPS-fixed
pods on the Tactical Map; a pod is shown as SOS when an SOS packet or a nearby
BLE victim is reported.

For a local hardware test:

1. From `backend/`, create a private `.env` based on
   [`backend/.env.example`](./backend/.env.example), set a long random
   `GATEWAY_API_KEY`, then run `npm install` and `npm start`. The server listens
   on port 3000 and binds to the LAN, so allow inbound TCP 3000 on the backend
   computer's private-network firewall.
2. Set the same API key and your backend computer's LAN IP in
   [`firmware/zamboalert-gateway/include/config.h`](./firmware/zamboalert-gateway/include/config.h),
   along with the gateway Wi-Fi credentials and surveyed gateway coordinates.
   Rebuild and flash the gateway. Never set its URL to `localhost`.
3. Configure and flash the pod. Install the Citizen app dependencies with
   `npm --prefix zamboalert-app install`, then build/install its native Android
   app with `npm --prefix zamboalert-app run android` on a machine with Android
   SDK tools and a connected device. Expo Go cannot advertise BLE.
4. Open the web dashboard and verify the pod appears after it sends a GPS-fixed
   LoRa packet. The marker uses the pod's GPS fix, not the citizen phone's GPS.

The backend can run locally; public deployment is not required for this LAN
test. Avoid exposing the HTTP endpoint or shared key to the public Internet.
