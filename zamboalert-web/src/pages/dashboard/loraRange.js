// Estimated LoRa coverage radius of a pod, for the range rings on the map.
//
// The pod's packet doesn't carry its radio settings, so POD_RADIO mirrors
// firmware/zamboalert-pod/include/config.h. Change both together.
export const POD_RADIO = {
  freqHz: 433e6,      // LORA_FREQ_HZ
  txPowerDbm: 2,      // LORA_TX_POWER_DBM (bench-test value; 17 for deployment)
  spreadingFactor: 9, // LORA_SF
  bandwidthHz: 125e3, // LORA_BW_HZ
};

// Link assumptions for the model below.
const LINK = {
  antennaGainDbi: 0,     // per end: stock Ra-01 spring / short whip antennas
  noiseFigureDb: 6,      // SX1278 receiver noise figure
  fadeMarginDb: 10,      // headroom for people, vehicles, rain and fading
  pathLossExponent: 3.3, // suburban houses, antennas near the ground (2 = free space)
};

// After a walk test (move a pod away until the gateway stops hearing it), put
// the measured distance in meters here. It replaces the model's estimate.
const MEASURED_POD_RANGE_M = null;

// Minimum SNR the SX127x can demodulate at each spreading factor (datasheet).
const SNR_LIMIT_DB = { 6: -5, 7: -7.5, 8: -10, 9: -12.5, 10: -15, 11: -17.5, 12: -20 };

// Receiver sensitivity = thermal noise floor + bandwidth + noise figure + SNR limit.
// SF9 at 125 kHz gives about -129.5 dBm.
export function receiverSensitivityDbm(radio = POD_RADIO) {
  return (
    -174 +
    10 * Math.log10(radio.bandwidthHz) +
    LINK.noiseFigureDb +
    SNR_LIMIT_DB[radio.spreadingFactor]
  );
}

function lossAt1mDb(radio) {
  const wavelengthM = 299792458 / radio.freqHz;
  return 20 * Math.log10((4 * Math.PI) / wavelengthM);
}

// Largest distance where path loss still leaves `marginDb` of headroom above
// the receiver's sensitivity, using the log-distance model
// PL(d) = PL(1 m) + 10 * n * log10(d).
export function estimateLoraRangeM(radio = POD_RADIO, marginDb = LINK.fadeMarginDb) {
  const budgetDb =
    radio.txPowerDbm + 2 * LINK.antennaGainDbi - receiverSensitivityDbm(radio) - marginDb;
  return 10 ** ((budgetDb - lossAt1mDb(radio)) / (10 * LINK.pathLossExponent));
}

// Gateway coverage rings. Pods only transmit to the gateway, so its coverage
// is limited by the pods' transmit power (POD_RADIO). Each tier is the
// distance where the signal still has that much headroom.
export const GATEWAY_RANGE_TIERS = [
  { id: "strong", label: "Strong", marginDb: 20 },
  { id: "reliable", label: "Reliable", marginDb: LINK.fadeMarginDb },
  { id: "edge", label: "Edge", marginDb: 0 },
].map((tier) => ({
  ...tier,
  radiusM:
    tier.id === "reliable" && MEASURED_POD_RANGE_M != null
      ? MEASURED_POD_RANGE_M
      : Math.round(estimateLoraRangeM(POD_RADIO, tier.marginDb) / 10) * 10,
}));

// Great-circle distance in meters.
export function distanceM(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

export const POD_RANGE_IS_MEASURED = MEASURED_POD_RANGE_M != null;

export const POD_RANGE_M = POD_RANGE_IS_MEASURED
  ? MEASURED_POD_RANGE_M
  : Math.round(estimateLoraRangeM() / 10) * 10;

export function formatRange(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

// e.g. "SF9 · 125 kHz · 2 dBm"
export function radioSummary(radio = POD_RADIO) {
  return `SF${radio.spreadingFactor} · ${radio.bandwidthHz / 1e3} kHz · ${radio.txPowerDbm} dBm`;
}
