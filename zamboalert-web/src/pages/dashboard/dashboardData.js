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
