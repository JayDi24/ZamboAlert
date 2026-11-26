import { useEffect, useState } from "react";

export const INITIAL_ALERTS = [];
export const INITIAL_RESCUERS = [];
export const MESH_NODES = [];
export const TUMAGA_BUILDINGS = [];

export function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function fmtTime(d) {
  return d.toLocaleTimeString("en-PH", { hour12: false });
}

// Relative age of an ISO timestamp ("just now", "5 min ago", "2 h ago", "3 d ago"); "--" when missing.
export function formatPing(timestamp, now = new Date()) {
  const ms = timestamp ? Date.parse(timestamp) : NaN;
  if (!Number.isFinite(ms)) return "--";
  const minutes = Math.floor(Math.max(0, now.getTime() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

// "lat, lng" text for an SOS alert, or "Location unavailable" when the phone had no GPS fix.
export function formatAlertLocation(alert) {
  const lat = alert?.lat;
  const lng = alert?.lng;
  const valid = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  return valid(lat) && valid(lng) ? `${lat}, ${lng}` : "Location unavailable";
}

export function signalBars(dbm) {
  if (dbm > -60) return 4;
  if (dbm > -70) return 3;
  if (dbm > -80) return 2;
  return 1;
}

export function parseCoordinate(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^\d.-]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}
