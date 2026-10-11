#pragma once
// =====================================================================
// ZamboAlert - Portable Rescuer Signal Pod - config.h
// Fill in / adjust values below as needed for your hardware and build.
// =====================================================================

// ---------- GPS (NEO-6M) ----------
#define GPS_BAUD 9600
#define GPS_RX_PIN 16   // ESP32 pin wired to GPS TX
#define GPS_TX_PIN 17   // ESP32 pin wired to GPS RX

// ---------- LoRa radio (SX1278 / Ra-01) ----------
// Must match the gateway's config.h exactly, or they won't hear each other.
#define LORA_SCK_PIN   18
#define LORA_MISO_PIN  19
#define LORA_MOSI_PIN  23
#define LORA_NSS_PIN   5
#define LORA_RST_PIN   14
#define LORA_DIO0_PIN  26
#define LORA_FREQ_HZ   433E6
#define LORA_TX_POWER_DBM 17
#define LORA_SF        9
#define LORA_BW_HZ     125E3
#define LORA_SYNC_WORD 0x12

// ---------- Buzzer / LED ----------
#define BUZZER_PIN 25
#define LED_PIN    27

// ---------- BLE SOS detection ----------
// The Citizen app advertises this service UUID when an SOS is active.
// The name prefix remains supported for older beacon implementations.
#define VICTIM_BLE_NAME_PREFIX "ZA-SOS"
#define SOS_SERVICE_UUID "fef10001-7b82-4b93-b2c2-0f81ea3300a1"
// RSSI (dBm) at which the pod considers itself "close enough" to buzz/light.
// Less negative = stricter (must be closer). More negative = more lenient.
#define PROXIMITY_RSSI_THRESHOLD -65
// How many times a mesh packet can be relayed before it's dropped.
#define MESH_TTL 4
