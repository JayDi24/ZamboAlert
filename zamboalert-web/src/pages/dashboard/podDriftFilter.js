// Steadies pod positions on the map against GPS drift.
//
// A stationary GPS (especially indoors) wanders by several meters, sometimes
// 10-30 m. Instead of moving the marker on every report, each pod keeps its
// last few fixes; the marker sits on their median and only moves once that
// median is more than DRIFT_THRESHOLD_M away from where it is drawn. A pod
// that is really carried still moves, roughly 2-3 reports (20-30 s) behind.
import { useMemo, useRef } from "react";
import { distanceM } from "./loraRange";

export const DRIFT_THRESHOLD_M = 15;
const WINDOW_SIZE = 5;              // fixes kept per pod (pods report every 10 s)
const WINDOW_MAX_AGE_MS = 60_000;   // ...and none older than this
const FORGET_AFTER_MS = 5 * 60_000; // drop a pod's history after it goes quiet

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function hasFix(pod) {
  return !!pod.fix && Number.isFinite(pod.lat) && Number.isFinite(pod.lng);
}

// Returns `pods` with lat/lng replaced by the steadied position. The raw fix
// stays available as rawLat/rawLng, and gpsJitterM is how far the recent
// fixes spread around the median. `tracks` (nodeId -> track) carries each
// pod's history between calls.
export function steadyPodPositions(tracks, pods, now = Date.now()) {
  const steadied = pods.map((pod) => {
    if (!hasFix(pod)) return pod;

    let track = tracks.get(pod.nodeId);
    if (!track) {
      track = { samples: [], shown: null, lastSeenAt: 0 };
      tracks.set(pod.nodeId, track);
    }

    // The dashboard polls every 3 s but a pod reports every 10 s, so the
    // same report arrives several times; count it once.
    const id = `${pod.seq}|${pod.receivedAt}`;
    if (!track.samples.some((s) => s.id === id)) {
      track.samples.push({
        id,
        t: Date.parse(pod.receivedAt) || now,
        lat: pod.lat,
        lng: pod.lng,
      });
    }
    // Age is measured against the newest fix (both are server timestamps),
    // so a skewed browser clock can't empty the window.
    const newestT = Math.max(...track.samples.map((s) => s.t));
    track.samples = track.samples
      .filter((s) => newestT - s.t <= WINDOW_MAX_AGE_MS)
      .slice(-WINDOW_SIZE);

    const center = {
      lat: median(track.samples.map((s) => s.lat)),
      lng: median(track.samples.map((s) => s.lng)),
    };
    if (
      !track.shown ||
      distanceM(track.shown.lat, track.shown.lng, center.lat, center.lng) > DRIFT_THRESHOLD_M
    ) {
      track.shown = center;
    }
    track.lastSeenAt = now;

    const jitterM = Math.max(
      ...track.samples.map((s) => distanceM(s.lat, s.lng, center.lat, center.lng))
    );

    return {
      ...pod,
      lat: track.shown.lat,
      lng: track.shown.lng,
      rawLat: pod.lat,
      rawLng: pod.lng,
      gpsJitterM: Math.round(jitterM),
      gpsSamples: track.samples.length,
    };
  });

  tracks.forEach((track, nodeId) => {
    if (now - track.lastSeenAt > FORGET_AFTER_MS) tracks.delete(nodeId);
  });

  return steadied;
}

export function useSteadyPodPositions(pods) {
  const tracksRef = useRef(new Map()); // nodeId -> { samples, shown, lastSeenAt }
  return useMemo(() => steadyPodPositions(tracksRef.current, pods), [pods]);
}
