# ZamboAlert firmware

This folder contains the ESP32 LoRa gateway and rescuer pod firmware used by
the merged ZamboAlert backend and dashboard.

## Configure and flash

1. Install PlatformIO and open either firmware project.
2. In `zamboalert-pod/include/config.h`, confirm the GPS, LoRa, BLE service UUID,
   and indicator pins match your hardware and Citizen app.
3. In `zamboalert-gateway/include/config.h`, set the same LoRa settings, the
   actual gateway coordinates, Wi-Fi credentials, backend computer's LAN IP,
   and the same private `GATEWAY_API_KEY` configured for the backend.
4. Build and flash the pod and gateway. The pod needs a GPS fix to appear on the
   map. The gateway prints received packets to Serial and forwards them over
   HTTP to `POST /api/telemetry`.

The Citizen Android app must be built as a native development/production build
to advertise BLE; Expo Go cannot load its native BLE advertiser. Keep the
gateway/backend on a trusted LAN and do not expose the shared-key HTTP endpoint
directly to the public Internet.

See the repository README for backend startup, API checks, and LAN firewall
requirements.
