#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <TinyGPSPlus.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include "mesh_packet.h"
#include "config.h"

// =====================================================================
// ZamboAlert - Portable Rescuer Signal Pod
// ESP32 + SX1278 (LoRa) + NEO-6M (GPS) + BLE scan + buzzer + LED
// =====================================================================

// ---------- Pin defaults (override in config.h) ----------
#ifndef GPS_BAUD
#define GPS_BAUD 9600
#endif
#ifndef GPS_RX_PIN
#define GPS_RX_PIN 16
#endif
#ifndef GPS_TX_PIN
#define GPS_TX_PIN 17
#endif

#ifndef LORA_SCK_PIN
#define LORA_SCK_PIN 18
#endif
#ifndef LORA_MISO_PIN
#define LORA_MISO_PIN 19
#endif
#ifndef LORA_MOSI_PIN
#define LORA_MOSI_PIN 23
#endif
#ifndef LORA_NSS_PIN
#define LORA_NSS_PIN 5
#endif
#ifndef LORA_RST_PIN
#define LORA_RST_PIN 14
#endif
#ifndef LORA_DIO0_PIN
#define LORA_DIO0_PIN 26
#endif
#ifndef LORA_FREQ_HZ
#define LORA_FREQ_HZ 433E6
#endif
#ifndef LORA_TX_POWER_DBM
#define LORA_TX_POWER_DBM 17
#endif
#ifndef LORA_SF
#define LORA_SF 9
#endif
#ifndef LORA_BW_HZ
#define LORA_BW_HZ 125E3
#endif
#ifndef LORA_SYNC_WORD
#define LORA_SYNC_WORD 0x12
#endif

#ifndef BUZZER_PIN
#define BUZZER_PIN 25
#endif
#ifndef LED_PIN
#define LED_PIN 27
#endif

// How often this pod sends its own routine telemetry packet.
#ifndef TELEMETRY_INTERVAL_MS
#define TELEMETRY_INTERVAL_MS 10000
#endif
// How often to run a BLE scan for victim beacons.
#ifndef BLE_SCAN_INTERVAL_MS
#define BLE_SCAN_INTERVAL_MS 5000
#endif
#ifndef BLE_SCAN_DURATION_SEC
#define BLE_SCAN_DURATION_SEC 3
#endif
// The citizen app must advertise a BLE device name starting with this
// prefix for the pod to recognize it as an SOS beacon. Coordinate this
// string with whoever implements the Citizen role in the mobile app.
#ifndef VICTIM_BLE_NAME_PREFIX
#define VICTIM_BLE_NAME_PREFIX "ZA-SOS"
#endif
// RSSI threshold (dBm) at which the pod considers itself "close" to a
// victim and sounds the buzzer/LED. Less negative = closer.
#ifndef PROXIMITY_RSSI_THRESHOLD
#define PROXIMITY_RSSI_THRESHOLD -65
#endif
// Starting hop count for packets this pod originates.
#ifndef MESH_TTL
#define MESH_TTL 4
#endif

HardwareSerial GPSserial(2);
TinyGPSPlus gps;
BLEScan* bleScan = nullptr;
SeenFilter seenFilter;

uint32_t nodeId;
uint32_t txSeq = 0;

unsigned long lastGpsReport = 0;
unsigned long lastTelemetryTx = 0;
unsigned long lastBleScan = 0;
unsigned long telemetryInterval = TELEMETRY_INTERVAL_MS;

// Latest BLE victim-scan summary, read by the telemetry packet builder.
int victimCount = 0;
int nearestVictimRssi = -127;
char nearestVictimId[9] = {0}; // 8 bytes + null terminator for local use
bool proximityActive = false;

// ---------- LoRa RX queue (filled by ISR, drained in loop) ----------
#define LORA_RX_QUEUE_SIZE 6
struct LoraRx {
    uint8_t data[sizeof(MeshPacket)];
    int len;
    int rssi;
    float snr;
};
volatile LoraRx rxQueue[LORA_RX_QUEUE_SIZE];
volatile uint8_t rxHead = 0;
volatile uint8_t rxTail = 0;

const char* rssiQuality(int rssi) {
    if (rssi >= -50) return "Strong";
    if (rssi >= -70) return "Medium";
    return "Weak";
}

// =====================================================================
// GPS
// =====================================================================
void readGps() {
    while (GPSserial.available()) gps.encode(GPSserial.read());
}

void printGpsStatus() {
    Serial.println();
    Serial.println("---------- GPS ----------");
    if (gps.location.isValid()) {
        Serial.print("Lat: "); Serial.print(gps.location.lat(), 6);
        Serial.print("  Lng: "); Serial.println(gps.location.lng(), 6);
        Serial.print("Sats: ");
        Serial.println(gps.satellites.isValid() ? String(gps.satellites.value()) : "?");
    } else {
        Serial.println("Searching for fix...");
    }
    Serial.println("--------------------------");
}

// =====================================================================
// BLE victim-beacon scanning
// =====================================================================
class VictimBLECallbacks : public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) override {} // unused, we poll results after scan
};

void scanForVictims() {
    Serial.println();
    Serial.println("---------- BLE victim scan ----------");

    BLEScanResults results = bleScan->start(BLE_SCAN_DURATION_SEC, false);
    int count = results.getCount();

    victimCount = 0;
    nearestVictimRssi = -127;
    memset(nearestVictimId, 0, sizeof(nearestVictimId));

    for (int i = 0; i < count; i++) {
        BLEAdvertisedDevice device = results.getDevice(i);
        bool isSosBeacon = device.isAdvertisingService(BLEUUID(SOS_SERVICE_UUID));
        std::string name;
        if (device.haveName()) {
            name = device.getName();
            isSosBeacon = isSosBeacon || name.rfind(VICTIM_BLE_NAME_PREFIX, 0) == 0;
        }
        if (!isSosBeacon) continue;

        int rssi = device.getRSSI();
        victimCount++;
        if (rssi > nearestVictimRssi) {
            nearestVictimRssi = rssi;
            // BLE privacy addresses can rotate; this short ID is for the current scan only.
            std::string address = device.getAddress().toString();
            std::string suffix;
            for (size_t j = 0; j < address.length() && suffix.length() < 8; j++) {
                char c = address[j];
                if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f')) {
                    suffix += c;
                }
            }
            if (suffix.empty() && name.rfind(VICTIM_BLE_NAME_PREFIX, 0) == 0) {
                suffix = name.substr(strlen(VICTIM_BLE_NAME_PREFIX));
                if (!suffix.empty() && suffix[0] == '-') suffix = suffix.substr(1);
            }
            memset(nearestVictimId, 0, sizeof(nearestVictimId));
            strncpy(nearestVictimId, suffix.c_str(), 8);
        }

        Serial.print("  [VICTIM] ");
        Serial.print(name.empty() ? "ZamboAlert SOS service" : name.c_str());
        Serial.print("  RSSI=");
        Serial.print(rssi);
        Serial.print(" [");
        Serial.print(rssiQuality(rssi));
        Serial.println("]");
    }

    Serial.print("Victim beacons in range: ");
    Serial.println(victimCount);

    bleScan->clearResults();
    Serial.println("--------------------------------------");

    // Trigger proximity cue + immediate SOS relay packet on new detection.
    bool wasActive = proximityActive;
    proximityActive = (victimCount > 0 && nearestVictimRssi >= PROXIMITY_RSSI_THRESHOLD);
    digitalWrite(LED_PIN, proximityActive ? HIGH : LOW);
    if (BUZZER_PIN >= 0) digitalWrite(BUZZER_PIN, proximityActive ? HIGH : LOW);

    if (proximityActive && !wasActive) {
        // Send an out-of-cycle SOS packet immediately, don't wait for the
        // next routine telemetry interval.
        extern void sendPacket(uint8_t msgType);
        sendPacket(ZA_MSG_SOS);
    }
}

void setupBle() {
    BLEDevice::init("ZamboAlert-Pod");
    bleScan = BLEDevice::getScan();
    bleScan->setAdvertisedDeviceCallbacks(new VictimBLECallbacks());
    bleScan->setActiveScan(true);   // active scan needed to reliably read device names
    bleScan->setInterval(100);
    bleScan->setWindow(80);
}

// =====================================================================
// LoRa
// =====================================================================
void onLoraReceive(int packetSize) {
    uint8_t next = (rxHead + 1) % LORA_RX_QUEUE_SIZE;
    if (next == rxTail) { // queue full, drop
        while (LoRa.available()) LoRa.read();
        return;
    }
    int len = 0;
    while (LoRa.available() && len < (int)sizeof(MeshPacket)) {
        rxQueue[rxHead].data[len++] = (uint8_t)LoRa.read();
    }
    rxQueue[rxHead].len = len;
    rxQueue[rxHead].rssi = LoRa.packetRssi();
    rxQueue[rxHead].snr = LoRa.packetSnr();
    rxHead = next;
}

bool setupLora() {
    SPI.begin(LORA_SCK_PIN, LORA_MISO_PIN, LORA_MOSI_PIN, LORA_NSS_PIN);
    LoRa.setPins(LORA_NSS_PIN, LORA_RST_PIN, LORA_DIO0_PIN);
    if (!LoRa.begin(LORA_FREQ_HZ)) return false;

    LoRa.setSpreadingFactor(LORA_SF);
    LoRa.setSignalBandwidth(LORA_BW_HZ);
    LoRa.setCodingRate4(5);
    LoRa.setSyncWord(LORA_SYNC_WORD);
    LoRa.setTxPower(LORA_TX_POWER_DBM);
    LoRa.enableCrc();
    LoRa.onReceive(onLoraReceive);
    LoRa.receive();
    return true;
}

void transmitPacket(const MeshPacket& pkt) {
    uint8_t buf[sizeof(MeshPacket)];
    encodePacket(pkt, buf);
    LoRa.beginPacket();
    LoRa.write(buf, sizeof(buf));
    LoRa.endPacket();
    LoRa.receive(); // back to RX after TX
}

// Builds and sends this pod's own telemetry/SOS packet.
void sendPacket(uint8_t msgType) {
    MeshPacket pkt;
    pkt.magic = ZA_MAGIC;
    pkt.msgType = msgType;
    pkt.nodeId = nodeId;
    pkt.seq = txSeq++;

    bool fix = gps.location.isValid() && gps.location.age() <= 10000UL;
    pkt.gpsFix = fix ? 1 : 0;
    pkt.lat_e6 = fix ? (int32_t)(gps.location.lat() * 1e6) : 0;
    pkt.lng_e6 = fix ? (int32_t)(gps.location.lng() * 1e6) : 0;
    pkt.sats = gps.satellites.isValid() ? (uint8_t)gps.satellites.value() : 0;

    pkt.bleVictims = (uint8_t)victimCount;
    pkt.nearestRssi = (int8_t)nearestVictimRssi;
    memset(pkt.victimId, 0, sizeof(pkt.victimId));
    memcpy(pkt.victimId, nearestVictimId, sizeof(pkt.victimId));
    pkt.victimStatus = ZA_STATUS_UNCLASSIFIED; // set by rescuer app, not firmware
    pkt.hopCount = MESH_TTL;
    pkt.uptimeSec = millis() / 1000;

    transmitPacket(pkt);
    seenFilter.seenBefore(pkt.nodeId, pkt.seq); // mark our own packet as seen so we never re-relay it

    Serial.println();
    Serial.print(msgType == ZA_MSG_SOS ? "[LoRa TX: SOS] " : "[LoRa TX: telemetry] ");
    Serial.print("seq="); Serial.print(pkt.seq);
    Serial.print(" fix="); Serial.print(pkt.gpsFix);
    Serial.print(" victims="); Serial.print(pkt.bleVictims);
    if (pkt.victimId[0] != 0) {
        char idBuf[9] = {0};
        memcpy(idBuf, pkt.victimId, 8);
        Serial.print(" nearestId="); Serial.println(idBuf);
    } else {
        Serial.println();
    }
}

// Relays a packet this pod received from another node, after a short
// random backoff (reduces collisions when several pods hear the same
// transmission and all try to relay it at once).
void relayPacket(MeshPacket pkt) {
    if (pkt.hopCount == 0) return; // TTL expired, drop silently
    pkt.hopCount--;

    delay(random(50, 400)); // small jittered backoff before retransmitting
    transmitPacket(pkt);

    Serial.print("[LoRa RELAY] from node=");
    Serial.print(pkt.nodeId, HEX);
    Serial.print(" seq="); Serial.print(pkt.seq);
    Serial.print(" hopsLeft="); Serial.println(pkt.hopCount);
}

void handleLoraRx() {
    while (rxTail != rxHead) {
        uint8_t data[sizeof(MeshPacket)];
        int len = rxQueue[rxTail].len;
        memcpy(data, (const void*)rxQueue[rxTail].data, len);
        int rssi = rxQueue[rxTail].rssi;
        float snr = rxQueue[rxTail].snr;
        rxTail = (rxTail + 1) % LORA_RX_QUEUE_SIZE;

        MeshPacket pkt;
        if (!decodePacket(data, len, pkt)) {
            Serial.println("[LoRa RX] bad/foreign packet, ignored");
            continue;
        }
        if (pkt.nodeId == nodeId) continue; // our own packet looped back, ignore

        Serial.println();
        Serial.print("[LoRa RX] node=");
        Serial.print(pkt.nodeId, HEX);
        Serial.print(" seq="); Serial.print(pkt.seq);
        Serial.print(" type="); Serial.print(pkt.msgType == ZA_MSG_SOS ? "SOS" : "telemetry");
        Serial.print(" RSSI="); Serial.print(rssi);
        Serial.print(" SNR="); Serial.println(snr, 1);

        if (seenFilter.seenBefore(pkt.nodeId, pkt.seq)) {
            Serial.println("  (duplicate, already relayed - suppressed)");
            continue;
        }
        relayPacket(pkt);
    }
}

// =====================================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    nodeId = (uint32_t)ESP.getEfuseMac();

    Serial.println();
    Serial.println("========================================");
    Serial.println("   ZAMBOALERT - PORTABLE RESCUER SIGNAL POD");
    Serial.println("========================================");
    Serial.print("Node ID: "); Serial.println(nodeId, HEX);
    Serial.println();

    GPSserial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    Serial.println("GPS UART started.");

    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);
    if (BUZZER_PIN >= 0) {
        pinMode(BUZZER_PIN, OUTPUT);
        digitalWrite(BUZZER_PIN, LOW);
    }

    seenFilter.init();
    if (!setupLora()) {
        Serial.println("LoRa init FAILED - check SX1278 wiring/power. Halting.");
        while (true) delay(1000);
    }
    Serial.println("LoRa mesh radio ready.");

    setupBle();
    Serial.print("BLE scanning for victim beacons named \"");
    Serial.print(VICTIM_BLE_NAME_PREFIX);
    Serial.println("*\".");

    Serial.println();
    Serial.println("Wiring:");
    Serial.println("GPS    -> 3V3/GND, TX->GPIO16, RX->GPIO17");
    Serial.println("SX1278 -> 3V3/GND, SCK18 MISO19 MOSI23 NSS5 RST14 DIO0 26");
    Serial.print("Buzzer -> GPIO"); Serial.println(BUZZER_PIN);
    Serial.print("LED    -> GPIO"); Serial.println(LED_PIN);
}

void loop() {
    readGps();
    const unsigned long now = millis();

    if (now - lastGpsReport >= 30000) {
        lastGpsReport = now;
        printGpsStatus();
    }

    if (now - lastBleScan >= BLE_SCAN_INTERVAL_MS) {
        lastBleScan = now;
        scanForVictims();
    }

    handleLoraRx();

    if ((uint32_t)(now - lastTelemetryTx) >= telemetryInterval) {
        lastTelemetryTx = now;
        telemetryInterval = TELEMETRY_INTERVAL_MS + random(0, 1500); // jitter to avoid synchronized transmissions
        sendPacket(ZA_MSG_TELEMETRY);
    }

    delay(10);
}
