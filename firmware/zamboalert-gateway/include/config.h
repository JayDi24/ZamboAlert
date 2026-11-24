#pragma once
// =====================================================================
// ZamboAlert - Static Barangay Gateway Node - config.h
// Fill in / adjust values below before flashing.
// =====================================================================

// Local values (Wi-Fi, API key, SERVER_URL, and optionally GATEWAY_LAT/LNG)
// live in secrets.h (gitignored). Included first so it can override the
// defaults below.
#include "secrets.h"

// ---------- LoRa radio (SX1278 / Ra-01) ----------
// Must match the pod's config.h exactly, or they won't hear each other.
#define LORA_SCK_PIN   18
#define LORA_MISO_PIN  19
#define LORA_MOSI_PIN  23
#define LORA_NSS_PIN   5
#define LORA_RST_PIN   14
#define LORA_DIO0_PIN  26
#define LORA_FREQ_HZ   433E6
#define LORA_SF        9
#define LORA_BW_HZ     125E3
#define LORA_SYNC_WORD 0x12

// ---------- Fixed, surveyed gateway location ----------
// Set this once at install time (phone GPS or handheld unit at the
// barangay hall). The gateway has no onboard GPS - see earlier discussion
// on why that's correct for a stationary node.
// Put the real coordinates in secrets.h. These defaults are a placeholder,
// and the web map labels a gateway at this spot as "location not set".
#ifndef GATEWAY_LAT
#define GATEWAY_LAT 6.972017
#endif
#ifndef GATEWAY_LNG
#define GATEWAY_LNG 122.144268
#endif

// ---------- Forwarding toggles ----------
// 1 = enabled, 0 = disabled. Both can be on at the same time.
// Serial/UART forwarding (the "JSON:" lines) is ALWAYS on regardless of
// these - that's just Serial.println(), it costs nothing to leave running.
#define FORWARD_VIA_HTTP 1
#define FORWARD_VIA_MQTT 0

// ---------- Wi-Fi (barangay hall local network) ----------
// WIFI_SSID / WIFI_PASSWORD / GATEWAY_API_KEY / SERVER_URL live in secrets.h (gitignored).

// ---------- HTTP target (only used if FORWARD_VIA_HTTP is 1) ----------
// SERVER_URL is set in secrets.h (per-machine LAN IP or Render URL).

// ---------- MQTT target (only used if FORWARD_VIA_MQTT is 1) ----------
#define MQTT_BROKER_HOST "192.168.254.117"
#define MQTT_BROKER_PORT 1883
#define MQTT_TOPIC "zamboalert/telemetry"
