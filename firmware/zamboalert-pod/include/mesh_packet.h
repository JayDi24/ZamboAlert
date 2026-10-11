#pragma once
#include <stdint.h>
#include <string.h>

// =====================================================================
// ZamboAlert mesh packet format
//
// The project spec targets Protocol Buffers for ~45-byte telemetry
// payloads. Implementing real protobuf on an ESP32 means adding the
// nanopb library and a .proto schema compiled to C, which is a project
// task in its own right. This header is a pragmatic stand-in: a packed
// C struct that is compact (27 bytes, same ballpark as the spec's
// target), deterministic, and easy to decode on the gateway/server
// side. Swapping it for real protobuf later only touches encodePacket()
// / decodePacket() below - nothing else in pod.cpp or gateway.cpp needs
// to change.
// =====================================================================

#define ZA_MAGIC 0xAA

#define ZA_MSG_TELEMETRY 0   // routine "I'm here" report from a pod
#define ZA_MSG_SOS       1   // a victim BLE beacon was just detected

#define ZA_STATUS_UNCLASSIFIED 0
#define ZA_STATUS_SAFE         1
#define ZA_STATUS_INJURED      2
#define ZA_STATUS_TRAPPED      3
#define ZA_STATUS_LOST         4

#pragma pack(push, 1)
struct MeshPacket {
    uint8_t  magic;         // ZA_MAGIC - cheap frame/corruption check
    uint8_t  msgType;       // ZA_MSG_TELEMETRY or ZA_MSG_SOS
    uint32_t nodeId;        // sending pod's short node ID
    uint32_t seq;           // sender's own sequence number
    int32_t  lat_e6;        // latitude  * 1,000,000 (0 if no fix)
    int32_t  lng_e6;        // longitude * 1,000,000 (0 if no fix)
    uint8_t  sats;          // satellites in view
    uint8_t  gpsFix;        // 0/1
    uint8_t  bleVictims;    // victim beacons currently in range
    int8_t   nearestRssi;   // RSSI of nearest victim beacon (-127 = none)
    char     victimId[8];   // short ID of the NEAREST victim beacon, taken from
                             // its advertised name after VICTIM_BLE_NAME_PREFIX
                             // (zero-filled, not guaranteed null-terminated -
                             // always copy into a 9-byte buffer before printing)
    uint8_t  victimStatus;  // ZA_STATUS_* (set by rescuer app via BLE/companion link; firmware defaults to UNCLASSIFIED)
    uint8_t  hopCount;      // relay TTL - decremented each hop, dropped at 0
    uint32_t uptimeSec;
};
#pragma pack(pop)

static_assert(sizeof(MeshPacket) == 36, "MeshPacket layout changed size unexpectedly");

// LoRa's LoRa.write() sends raw bytes, so encode/decode is just a memcpy.
// Centralized here so both firmwares agree on the wire format.
inline void encodePacket(const MeshPacket& pkt, uint8_t* outBuf) {
    memcpy(outBuf, &pkt, sizeof(MeshPacket));
}

// Returns false if the buffer is too short or the magic byte doesn't match
// (garbage / a foreign LoRa transmission on the same frequency).
inline bool decodePacket(const uint8_t* buf, int len, MeshPacket& out) {
    if (len < (int)sizeof(MeshPacket)) return false;
    memcpy(&out, buf, sizeof(MeshPacket));
    return out.magic == ZA_MAGIC;
}

// ---------------------------------------------------------------------
// Duplicate-suppression cache ("In-Packet Bloom Filter Routing" in the
// spec). This is a small ring buffer of recently-seen (nodeId, seq)
// hashes, NOT a true bit-array Bloom filter - it never gives a false
// "already seen", only ages out old entries once the buffer wraps. For
// a 1-gateway/2-pod pilot this is enough to stop a packet being relayed
// back and forth in a loop. If you need a real bit-array Bloom filter
// later (closer to Meshtastic/Wirepas), this class is the only thing
// you'd replace.
// ---------------------------------------------------------------------
class SeenFilter {
public:
    static const uint8_t SIZE = 32;

    void init() {
        for (uint8_t i = 0; i < SIZE; i++) ids[i] = 0;
        idx = 0;
    }

    // Returns true if this packet was already seen (and records it either way).
    bool seenBefore(uint32_t nodeId, uint32_t seq) {
        uint32_t key = nodeId ^ (seq * 2654435761UL); // Knuth multiplicative hash mix
        for (uint8_t i = 0; i < SIZE; i++) {
            if (ids[i] == key) return true;
        }
        ids[idx] = key;
        idx = (idx + 1) % SIZE;
        return false;
    }

private:
    uint32_t ids[SIZE];
    uint8_t idx;
};
