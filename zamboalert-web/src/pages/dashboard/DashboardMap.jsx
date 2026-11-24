import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Layers,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Signal,
  Compass,
  Box,
  RadioTower,
} from "lucide-react";
import { TUMAGA_BUILDINGS, parseCoordinate, signalBars } from "./dashboardData";
import {
  GATEWAY_RANGE_TIERS,
  POD_RANGE_M,
  POD_RANGE_IS_MEASURED,
  distanceM,
  formatRange,
  radioSummary,
} from "./loraRange";

// Rescuer GPS older than this is drawn greyed out as possibly stale.
const RESCUER_LOCATION_STALE_SEC = 120;

// Pod LoRa range rings: a static dashed boundary plus two staggered "ping"
// rings that sweep from the pod out to the edge of its range.
const POD_RANGE_STATIC_LAYERS = ["pod-range-fill", "pod-range-line"];
const POD_RANGE_PULSE_LAYERS = ["pod-range-pulse-a", "pod-range-pulse-b"];
const POD_RANGE_PULSE_MS = 3200;
const POD_RANGE_FRAME_MS = 33; // ~30 fps is smooth enough for a slow ring

const podRangeLabel = `${POD_RANGE_IS_MEASURED ? "" : "~"}${formatRange(POD_RANGE_M)}`;

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function podHasFix(pod) {
  return !!pod.fix && Number.isFinite(pod.lat) && Number.isFinite(pod.lng);
}

function podHasSos(pod) {
  return pod.msgType === 1 || pod.bleVictims > 0;
}

function podColor(pod) {
  return podHasSos(pod) ? "#dc2626" : "#2563eb";
}

// Citizen phone SOS reports are mirrored as virtual pods under this gateway ID;
// it isn't a real device, so it gets no gateway marker.
const CITIZEN_APP_GATEWAY_ID = "CITIZEN-APP-GATEWAY";
// Default GATEWAY_LAT/LNG in firmware/zamboalert-gateway/include/config.h.
const GATEWAY_PLACEHOLDER = { lat: 6.912345, lng: 122.079876 };

// One entry per LoRa gateway, built from the reports it forwarded. Telemetry
// rows expire after 90 s on the backend, so a gateway is shown only while
// it is actively forwarding.
function getGateways(pods) {
  const byId = new Map();
  pods.forEach((pod) => {
    if (!pod.gatewayId || pod.gatewayId === CITIZEN_APP_GATEWAY_ID) return;
    if (!Number.isFinite(pod.gatewayLat) || !Number.isFinite(pod.gatewayLng)) return;
    const receivedAt = Date.parse(pod.receivedAt) || 0;
    const gw = byId.get(pod.gatewayId) || {
      id: pod.gatewayId,
      lat: pod.gatewayLat,
      lng: pod.gatewayLng,
      lastHeardAt: 0,
      podIds: new Set(),
    };
    gw.podIds.add(pod.nodeId);
    if (receivedAt >= gw.lastHeardAt) {
      gw.lastHeardAt = receivedAt;
      gw.lat = pod.gatewayLat;
      gw.lng = pod.gatewayLng;
    }
    byId.set(pod.gatewayId, gw);
  });
  return [...byId.values()].map((gw) => ({
    ...gw,
    isPlaceholder:
      Math.abs(gw.lat - GATEWAY_PLACEHOLDER.lat) < 1e-6 &&
      Math.abs(gw.lng - GATEWAY_PLACEHOLDER.lng) < 1e-6,
  }));
}

// Mapbox GL draws 512 px tiles, so one pixel at zoom 0 covers this many meters.
function metersPerPixelAtZoom0(lat) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / 512;
}

// Circle-layer radius for a ring at `progress` (0..1) of the pod's range. It
// doubles per zoom level, so the ring keeps its real-world size at every zoom.
function podPulseRadius(progress) {
  return [
    "interpolate", ["exponential", 2], ["zoom"],
    0, ["*", ["get", "radiusZ0"], progress],
    24, ["*", ["get", "radiusZ0"], progress * 2 ** 24],
  ];
}

// Range polygons (static boundary) and center points (animated rings) for
// every pod with a GPS fix.
function getPodRangeGeoJSON(pods) {
  const features = [];
  pods.filter(podHasFix).forEach((pod) => {
    const color = podColor(pod);
    features.push({
      ...createGeoJSONCircle([pod.lng, pod.lat], POD_RANGE_M, 96),
      properties: { color },
    });
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pod.lng, pod.lat] },
      properties: { color, radiusZ0: POD_RANGE_M / metersPerPixelAtZoom0(pod.lat) },
    });
  });
  return { type: "FeatureCollection", features };
}

export function SignalBars({ bars, active }) {
  return (
    <span className="inline-flex items-end gap-0.5 h-3">
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className="w-1 rounded-xs transition-colors"
          style={{
            height: `${b * 3}px`,
            background: b <= bars && active ? "#dc2626" : "#cbd5e1",
          }}
        />
      ))}
    </span>
  );
}

export function PingDot({ active }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
      )}
      <span
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ background: active ? "#10b981" : "#94a3b8" }}
      />
    </span>
  );
}

export function StatusBadge({ status }) {
  const cfg = {
    unassigned: "bg-red-50 text-red-700 border-red-200/80 font-bold",
    assigned: "bg-amber-50 text-amber-700 border-amber-200/80 font-bold",
    resolved: "bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold",
  }[status] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`text-[10px] font-mono tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${cfg}`}
    >
      {status}
    </span>
  );
}

export function RescuerBadge({ status }) {
  const cfg = {
    available: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    "en-route": "bg-amber-50 text-amber-700 border-amber-200/80",
    "on-scene": "bg-red-50 text-red-700 border-red-200/80",
    offline: "bg-slate-100 text-slate-500 border-slate-200",
  }[status] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span
      className={`text-[10px] font-mono font-semibold tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${cfg}`}
    >
      {status}
    </span>
  );
}

function getBuildingColor(type) {
  if (type === "gov") return "#0284c7";     // Sky Blue
  if (type === "medical") return "#dc2626"; // Alert Red
  if (type === "school") return "#d97706";  // Amber Gold
  if (type === "court") return "#059669";   // Emerald Green
  if (type === "chapel") return "#7c3aed";  // Violet
  if (type === "comm") return "#2563eb";    // Blue Commercial
  return "#64748b";                         // Slate
}

function getBuildingBorderColor(type) {
  if (type === "gov") return "#0284c7";
  if (type === "medical") return "#dc2626";
  if (type === "school" || type === "court") return "#d97706";
  if (type === "chapel") return "#7c3aed";
  return "#475569";
}

function getBuildingSvgIcon(type) {
  if (type === "gov") {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M9 10v11M15 10v11M4 10l8-7 8 7"/></svg>`;
  }
  if (type === "medical") {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19 10.5h-5.5V5h-3v5.5H5v3h5.5V19h3v-5.5H19v-3z"/></svg>`;
  }
  if (type === "school") {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>`;
  }
  if (type === "court") {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a4 4 0 0 1 4 4v3H8V6a4 4 0 0 1 4-4z"/></svg>`;
  }
  if (type === "chapel") {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M11 2h2v5h5v2h-5v12h-2V9H6V7h5V2z"/></svg>`;
  }
  if (type === "comm") {
    return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
}

function getTumagaBuildingsGeoJSON() {
  const features = TUMAGA_BUILDINGS.map((b) => {
    const dLat = (b.d / 2) / 110540;
    const dLng = (b.w / 2) / (111320 * Math.cos((b.lat * Math.PI) / 180));

    const polygon = [
      [b.lng - dLng, b.lat - dLat],
      [b.lng + dLng, b.lat - dLat],
      [b.lng + dLng, b.lat + dLat],
      [b.lng - dLng, b.lat + dLat],
      [b.lng - dLng, b.lat - dLat],
    ];

    return {
      type: "Feature",
      id: b.id,
      geometry: {
        type: "Polygon",
        coordinates: [polygon],
      },
      properties: {
        id: b.id,
        name: b.name,
        type: b.type,
        height: Math.max((b.h || 20) * 1.6, 24),
        base_height: 0,
        color: getBuildingColor(b.type),
        width: b.w,
        depth: b.d,
        orig_h: b.h,
        lat: b.lat,
        lng: b.lng,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

function createGeoJSONCircle(centerLngLat, radiusInMeters, points = 64) {
  const [lng, lat] = centerLngLat;
  const coords = [];
  const distanceX = radiusInMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInMeters / 110540;

  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
    properties: { radius: radiusInMeters },
  };
}

// Gateway coverage radar: one ring per range tier around each online gateway,
// plus a label point on the north edge of each ring.
const RADAR_TIER_COLORS = { strong: "#059669", reliable: "#d97706", edge: "#dc2626" };
const RADAR_LAYERS = ["radar-fill", "radar-lines", "radar-labels"];

function getGatewayRadarGeoJSON(gateways) {
  const features = [];
  gateways.forEach((gw) => {
    GATEWAY_RANGE_TIERS.forEach((tier) => {
      const color = RADAR_TIER_COLORS[tier.id];
      features.push({
        ...createGeoJSONCircle([gw.lng, gw.lat], tier.radiusM, 128),
        properties: { tier: tier.id, color },
      });
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [gw.lng, gw.lat + tier.radiusM / 110540] },
        properties: { color, label: `${tier.label} · ${formatRange(tier.radiusM)}` },
      });
    });
  });
  return { type: "FeatureCollection", features };
}

// [[west, south], [east, north]] around a gateway's outermost ring.
function getGatewayRadarBounds(gw) {
  const edgeM = Math.max(...GATEWAY_RANGE_TIERS.map((t) => t.radiusM));
  const dLat = edgeM / 110540;
  const dLng = edgeM / (111320 * Math.cos((gw.lat * Math.PI) / 180));
  return [
    [gw.lng - dLng, gw.lat - dLat],
    [gw.lng + dLng, gw.lat + dLat],
  ];
}

// Which coverage tier a distance from the gateway falls in.
function gatewayTierAt(meters) {
  return GATEWAY_RANGE_TIERS.find((t) => meters <= t.radiusM) || null;
}

// Gateway popup: what it hears, and for each pod how far away it is, which
// ring it's in and the measured signal. Carrying a pod away while this is open
// works as a live range walk test.
function fillGatewayPopup(container, gw, pods) {
  const line = (text, style = "") => {
    const div = document.createElement("div");
    div.textContent = text;
    if (style) div.style.cssText = style;
    return div;
  };
  const title = document.createElement("strong");
  title.textContent = `Gateway ${gw.id}`;
  const ageSec = Math.max(0, Math.round((Date.now() - gw.lastHeardAt) / 1000));
  const rows = [
    title,
    line(`Coverage (est., pods at ${radioSummary()}):`, "color:#64748b;margin-top:2px"),
    line(GATEWAY_RANGE_TIERS.map((t) => `${t.label} ${formatRange(t.radiusM)}`).join(" · ")),
  ];

  const heard = pods
    .filter((p) => p.gatewayId === gw.id)
    .sort((a, b) => String(a.nodeId).localeCompare(String(b.nodeId)));
  rows.push(line(`Hearing ${heard.length} pod${heard.length === 1 ? "" : "s"}:`, "color:#64748b;margin-top:2px"));
  heard.forEach((p) => {
    const rssi = Number.isFinite(p.loraRssi) ? `RSSI ${p.loraRssi} dBm` : "RSSI ?";
    if (!podHasFix(p)) {
      rows.push(line(`${p.nodeId} · no GPS fix · ${rssi}`));
      return;
    }
    const meters = distanceM(gw.lat, gw.lng, p.lat, p.lng);
    const tier = gatewayTierAt(meters);
    rows.push(
      line(`${p.nodeId} · ${formatRange(meters)} · ${tier ? tier.label : "Beyond edge"} · ${rssi}`)
    );
  });
  rows.push(line(`Last packet ${ageSec}s ago`, "color:#64748b"));

  if (gw.isPlaceholder) {
    rows.push(
      line(
        "Location not set: placeholder from firmware config (set GATEWAY_LAT/LNG in secrets.h).",
        "color:#b45309;font-weight:600;margin-top:2px"
      )
    );
  }
  container.replaceChildren(...rows);
}

export function TacticalMap({
  alerts = [],
  rescuers = [],
  casualties = [],
  pods = [],
  selected,
  onSelect,
  selectedCasualtyId,
  onSelectCasualty,
  onDispatchToTarget,
}) {
  const [is3D, setIs3D] = useState(true);
  const [pitchAngle, setPitchAngle] = useState(58);
  const [showDetectionWeb, setShowDetectionWeb] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [showPodRange, setShowPodRange] = useState(true);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const podMarkersRef = useRef([]);
  const gatewayMarkersRef = useRef(new Map()); // gatewayId -> { marker, popupContent }
  // Read by setup3DLayers, which runs once on style load, after the pods may
  // already have arrived.
  const podRangeDataRef = useRef(getPodRangeGeoJSON(pods));
  const showPodRangeRef = useRef(showPodRange);
  const hasRangePods = pods.some(podHasFix);
  const gateways = getGateways(pods);
  const radarDataRef = useRef(getGatewayRadarGeoJSON(gateways));
  const showDetectionWebRef = useRef(showDetectionWeb);

  const mapboxToken =
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

  const setup3DLayers = useCallback((map) => {
    // 1. Standard Mapbox OSM 3D Buildings
    if (map.getSource("composite") && !map.getLayer("3d-buildings-osm")) {
      const layers = map.getStyle().layers;
      const labelLayerId = layers.find(
        (layer) => layer.type === "symbol" && layer.layout && layer.layout["text-field"]
      )?.id;

      map.addLayer(
        {
          id: "3d-buildings-osm",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#cbd5e1",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              14,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.72,
            "fill-extrusion-vertical-gradient": true,
          },
        },
        labelLayerId
      );
    }

    // 2. Custom Tumaga 3D Building Models
    if (!map.getSource("tumaga-buildings-src")) {
      map.addSource("tumaga-buildings-src", {
        type: "geojson",
        data: getTumagaBuildingsGeoJSON(),
      });
    }

    if (!map.getLayer("tumaga-3d-buildings")) {
      map.addLayer({
        id: "tumaga-3d-buildings",
        type: "fill-extrusion",
        source: "tumaga-buildings-src",
        paint: {
          "fill-extrusion-color": ["get", "color"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-base": ["get", "base_height"],
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        },
      });

      map.on("click", "tumaga-3d-buildings", (e) => {
        if (!e.features || !e.features[0]) return;
        const p = e.features[0].properties;
        new mapboxgl.Popup({ offset: [0, -10], closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-family: sans-serif; font-size: 11px; padding: 6px; min-width: 170px;">
              <div style="font-weight: 800; font-size: 12px; color: #0f172a; margin-bottom: 2px;">${p.name}</div>
              <div style="font-size: 9.5px; text-transform: uppercase; font-weight: 700; color: ${p.color}; margin-bottom: 6px;">
                Type: ${p.type} · Tactical 3D Model
              </div>
              <div style="font-size: 10px; color: #475569; border-top: 1px solid #f1f5f9; padding-top: 5px; display: flex; flex-direction: column; gap: 2px;">
                <div>Footprint: <strong>${p.width}m × ${p.depth}m</strong></div>
                <div>Extrusion Height: <strong>${Math.round(p.height)}m</strong></div>
                <div>Coordinates: <strong>${Number(p.lat).toFixed(4)}°N, ${Number(p.lng).toFixed(4)}°E</strong></div>
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on("mouseenter", "tumaga-3d-buildings", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "tumaga-3d-buildings", () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // 3. Gateway coverage radar (data is kept current by the pods effect)
    if (!map.getSource("radar-src")) {
      map.addSource("radar-src", {
        type: "geojson",
        data: radarDataRef.current,
      });
    }

    const radarVisibility = showDetectionWebRef.current ? "visible" : "none";

    if (!map.getLayer("radar-fill")) {
      map.addLayer({
        id: "radar-fill",
        type: "fill",
        source: "radar-src",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          // Rings stack, so the center reads darkest where the signal is best.
          "fill-color": ["get", "color"],
          "fill-opacity": 0.04,
        },
        layout: { visibility: radarVisibility },
      });
    }

    if (!map.getLayer("radar-lines")) {
      map.addLayer({
        id: "radar-lines",
        type: "line",
        source: "radar-src",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.75,
          "line-dasharray": [3, 3],
          "line-opacity": 0.75,
        },
        layout: { visibility: radarVisibility },
      });
    }

    if (!map.getLayer("radar-labels")) {
      map.addLayer({
        id: "radar-labels",
        type: "symbol",
        source: "radar-src",
        filter: ["==", ["geometry-type"], "Point"],
        layout: {
          visibility: radarVisibility,
          "text-field": ["get", "label"],
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
          "text-size": 11,
          "text-anchor": "bottom",
          "text-offset": [0, -0.3],
          "text-allow-overlap": true,
          "text-pitch-alignment": "viewport",
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });
    }

    // 4. Pod LoRa range rings (data is kept current by the pods effect)
    if (!map.getSource("pod-range-src")) {
      map.addSource("pod-range-src", {
        type: "geojson",
        data: podRangeDataRef.current,
      });
    }

    const rangeVisibility = showPodRangeRef.current ? "visible" : "none";
    const pulseVisibility =
      showPodRangeRef.current && !prefersReducedMotion() ? "visible" : "none";

    if (!map.getLayer("pod-range-fill")) {
      map.addLayer({
        id: "pod-range-fill",
        type: "fill",
        source: "pod-range-src",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.07,
        },
        layout: { visibility: rangeVisibility },
      });
    }

    if (!map.getLayer("pod-range-line")) {
      map.addLayer({
        id: "pod-range-line",
        type: "line",
        source: "pod-range-src",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.65,
        },
        layout: { visibility: rangeVisibility },
      });
    }

    POD_RANGE_PULSE_LAYERS.forEach((id) => {
      if (map.getLayer(id)) return;
      map.addLayer({
        id,
        type: "circle",
        source: "pod-range-src",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": podPulseRadius(0),
          "circle-color": ["get", "color"],
          "circle-opacity": 0,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0,
          // Lie flat on the ground and shrink with distance in 3D view.
          "circle-pitch-alignment": "map",
          "circle-pitch-scale": "map",
        },
        layout: { visibility: pulseVisibility },
      });
    });

    // 5. Rescuer Dispatch Routes Layer
    if (!map.getSource("rescuer-routes-src")) {
      map.addSource("rescuer-routes-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getLayer("rescuer-routes-lines")) {
      map.addLayer({
        id: "rescuer-routes-lines",
        type: "line",
        source: "rescuer-routes-src",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      });
    }
  }, []); // runs once on style load; current toggle state comes from refs

  // Initialize Mapbox map with clean vector style (no satellite raster photo)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    mapboxgl.accessToken = mapboxToken;

    const initialPitch = is3D ? 58 : 0;
    const initialBearing = is3D ? -22 : 0;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [122.0790, 6.9214],
      zoom: 15.3,
      pitch: initialPitch,
      bearing: initialBearing,
      antialias: true,
      pitchWithRotate: true,
      dragRotate: true,
    });

    mapRef.current = map;

    map.on("pitch", () => {
      setPitchAngle(Math.round(map.getPitch()));
    });

    map.on("style.load", () => {
      setup3DLayers(map);
    });

    // Keep the canvas aligned when the container resizes (e.g. sidebar collapse/expand)
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update camera smoothly between 2D Top-Down and 3D Model Perspective
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.easeTo({
      pitch: is3D ? 58 : 0,
      bearing: is3D ? -22 : 0,
      duration: 1000,
    });
  }, [is3D]);

  // Update Radar Layer Visibility
  useEffect(() => {
    showDetectionWebRef.current = showDetectionWeb;
    const map = mapRef.current;
    if (!map) return;

    const vis = showDetectionWeb ? "visible" : "none";
    RADAR_LAYERS.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    });
  }, [showDetectionWeb]);

  // Turning the radar on frames the gateway's whole coverage area, since the
  // default view (Tumaga) may be kilometers away from it.
  const handleToggleRadar = () => {
    const next = !showDetectionWeb;
    setShowDetectionWeb(next);
    const gw = gateways[0];
    if (next && gw && mapRef.current) {
      mapRef.current.fitBounds(getGatewayRadarBounds(gw), {
        padding: 60,
        pitch: is3D ? 45 : 0,
        bearing: is3D ? -22 : 0,
        duration: 1200,
      });
    }
  };

  // Target Focus / Selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let targetCoords = null;

    if (selected) {
      const a = alerts.find((x) => x.id === selected);
      if (a) {
        const lat = parseCoordinate(a.lat || a.latitude);
        const lng = parseCoordinate(a.lng || a.longitude);
        if (lat && lng) targetCoords = [lng, lat];
      }
    } else if (selectedCasualtyId) {
      const c = casualties.find((x) => x.id === selectedCasualtyId);
      if (c) {
        const lat = parseCoordinate(c.latitude || c.lat);
        const lng = parseCoordinate(c.longitude || c.lng);
        if (lat && lng) targetCoords = [lng, lat];
      }
    }

    if (targetCoords) {
      map.flyTo({
        center: targetCoords,
        zoom: 16.5,
        pitch: is3D ? 60 : 0,
        speed: 1.2,
        curve: 1.42,
        essential: true,
      });
    }
  }, [selected, selectedCasualtyId, alerts, casualties, is3D]);

  // Render Markers (Buildings, Alerts, Rescuers, Victims) & Dispatch Routes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing DOM markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // 1. Tumaga Building Landmark Badges
    TUMAGA_BUILDINGS.forEach((b) => {
      const el = document.createElement("div");
      el.className = "custom-building-marker cursor-pointer group";
      el.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background-color: ${getBuildingColor(b.type)}25;
          border: 2px solid ${getBuildingBorderColor(b.type)};
          border-radius: 8px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          color: ${getBuildingBorderColor(b.type)};
          backdrop-filter: blur(4px);
        " class="hover:scale-125 transition-transform bg-white/90">
          ${getBuildingSvgIcon(b.type)}
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: [0, -14], closeButton: false }).setHTML(`
        <div style="font-family: sans-serif; font-size: 11px; padding: 3px;">
          <strong>${b.name}</strong><br/>
          <span style="font-size: 9px; opacity: 0.8; text-transform: uppercase;">3D Model · ${b.type} (${b.h}m)</span>
        </div>
      `);

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([b.lng, b.lat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener("mouseenter", () => marker.togglePopup());
      el.addEventListener("mouseleave", () => marker.togglePopup());
      el.addEventListener("click", () => {
        map.flyTo({ center: [b.lng, b.lat], zoom: 17, pitch: 62, duration: 1000 });
      });

      markersRef.current.push(marker);
    });

    // 2. SOS Distress Alerts
    alerts.forEach((a) => {
      const lat = parseCoordinate(a.lat || a.latitude);
      const lng = parseCoordinate(a.lng || a.longitude);
      if (lat && lng) {
        const isSel = selected === a.id;
        const isUnassigned = a.status === "unassigned";

        const el = document.createElement("div");
        el.className = "relative flex flex-col items-center justify-center cursor-pointer";
        el.innerHTML = `
          ${isUnassigned ? '<span class="absolute w-9 h-9 rounded-full border-2 border-red-600 animate-ping opacity-75" style="margin-top:-6px;"></span>' : ""}
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full border-2 text-[9px] font-bold font-mono transition-transform shadow-lg ${
            isSel
              ? "scale-125 border-white bg-red-900 text-white shadow-xl ring-2 ring-red-500"
              : "bg-red-600 border-white text-white"
          } ${a.status === "assigned" ? "bg-amber-500 border-white text-white" : ""}">
            SOS
          </div>
          <span class="absolute top-8 bg-slate-900/90 backdrop-blur-xs text-white text-[9px] px-2 py-0.5 rounded-md border border-slate-700 font-semibold whitespace-nowrap shadow-lg z-50">
            ${a.name}
          </span>
        `;

        el.addEventListener("click", () => {
          onSelect(a.id);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);

        markersRef.current.push(marker);
      }
    });

    // 3. Rescuer Units
    rescuers.forEach((r) => {
      const lat = parseCoordinate(r.lat || r.latitude);
      const lng = parseCoordinate(r.lng || r.longitude);
      if (lat && lng) {
        const updatedMs = r.locationUpdatedAt ? Date.parse(r.locationUpdatedAt) : NaN;
        const ageSec = Number.isFinite(updatedMs) ? Math.max(0, Math.round((Date.now() - updatedMs) / 1000)) : null;
        const isStale = ageSec !== null && ageSec > RESCUER_LOCATION_STALE_SEC;
        const lastUpdateText =
          ageSec === null ? "unknown" : ageSec < 60 ? `${ageSec}s ago` : `${Math.floor(ageSec / 60)} min ago`;

        const el = document.createElement("div");
        el.className = "relative flex flex-col items-center justify-center cursor-pointer";
        // Mapbox writes opacity on the marker element itself, so dim the children instead.
        const dimStyle = isStale ? ' style="opacity: 0.5;"' : "";
        el.innerHTML = `
          <div${dimStyle} class="relative flex items-center justify-center w-6 h-6 rounded-lg border-2 border-white text-[9px] font-bold font-mono shadow-md ${
            isStale
              ? "bg-slate-500 text-white"
              : r.status === "available"
              ? "bg-emerald-600 text-white"
              : r.status === "en-route"
              ? "bg-amber-500 text-white"
              : "bg-red-600 text-white"
          }">
            R
          </div>
          <span${dimStyle} class="absolute top-7 bg-slate-900/90 text-slate-100 text-[8px] px-1.5 py-px rounded border border-slate-700 font-mono whitespace-nowrap shadow-xs">
            ${r.id}
          </span>
        `;

        const popup = new mapboxgl.Popup({ offset: [0, -14], closeButton: false }).setHTML(`
          <div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
            <strong>${r.name}</strong><br/>
            <span style="font-size: 9px; opacity: 0.8; text-transform: uppercase;">Status: ${r.status}</span><br/>
            <span style="font-size: 9px; opacity: 0.8;">Last update: ${lastUpdateText}</span>
          </div>
        `);

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("mouseenter", () => marker.togglePopup());
        el.addEventListener("mouseleave", () => marker.togglePopup());

        markersRef.current.push(marker);
      }
    });

    // 4. Victims / Casualties with Interactive Dispatch Popup
    casualties.forEach((c) => {
      const lat = parseCoordinate(c.latitude || c.lat);
      const lng = parseCoordinate(c.longitude || c.lng);
      if (lat && lng) {
        const isSel = selectedCasualtyId === c.id;
        const statusColors = {
          Injured: "bg-amber-500 border-white text-white",
          Deceased: "bg-purple-800 border-white text-white",
          Missing: "bg-red-600 border-white text-white animate-pulse",
          Rescued: "bg-emerald-600 border-white text-white",
        }[c.status] || "bg-slate-500 border-white text-white";

        const disasterEmoji = {
          Flood: "🌊",
          Landslide: "🪨",
          Earthquake: "🫨",
          "Storm Surge": "💨",
        }[c.disaster_type] || "🪨";

        const el = document.createElement("div");
        el.className = "relative flex flex-col items-center justify-center cursor-pointer";
        el.innerHTML = `
          ${isSel ? '<span class="absolute w-9 h-9 rounded-full border-2 border-dashed border-red-600 animate-spin" style="margin-top:-2px;"></span>' : ""}
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full border-2 text-[12px] ${statusColors} shadow-md" title="${c.disaster_type || "Unknown"} Area">
            ${disasterEmoji}
          </div>
          <span class="absolute top-8 bg-white/95 text-slate-900 text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap shadow-md z-[1000]">
            ${c.victim_name}
          </span>
        `;

        const popupDiv = document.createElement("div");
        popupDiv.className = "p-3 font-sans text-xs text-slate-800 min-w-[220px]";

        const assignedRescuer = rescuers.find(
          (r) =>
            r.status === "en-route" &&
            r.assignedTargetType === "victim" &&
            String(r.assignedTargetId) === String(c.id)
        );

        popupDiv.innerHTML = `
          <div class="font-bold text-slate-900 border-b border-slate-100 pb-1.5 mb-2 flex items-center justify-between">
            <span>VICTIM LOG</span>
            <span class="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">VIC-${c.id}</span>
          </div>
          <div class="space-y-1 mb-3 text-[11px]">
            <div><strong>Name:</strong> ${c.victim_name}</div>
            <div><strong>Status:</strong> <span class="font-bold text-red-700 uppercase">${c.status}</span></div>
            <div><strong>Disaster:</strong> <span class="font-semibold text-slate-700">${c.disaster_type || "Unknown"}</span></div>
            <div><strong>Age / Gender:</strong> ${c.age || "--"} / ${c.gender || "--"}</div>
            <div><strong>Injury:</strong> <span class="italic text-slate-600">${c.injury_details || "None listed"}</span></div>
          </div>
          <div class="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
            ${
              assignedRescuer
                ? `<div class="text-[10px] text-emerald-700 font-bold bg-emerald-50 p-1.5 border border-emerald-200 rounded-lg text-center">Dispatched: ${assignedRescuer.name}</div>`
                : `<label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Assign Rescuer Unit</label>
                   <select id="popup-select-${c.id}" class="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 outline-none">${
                     rescuers.filter((r) => r.isVerified && r.status === "available").length === 0
                       ? '<option value="">No rescuers available</option>'
                       : rescuers
                           .filter((r) => r.isVerified && r.status === "available")
                           .map((r) => `<option value="${r.id}">${r.name}</option>`)
                           .join("")
                   }</select>
                   <button id="popup-btn-${c.id}" class="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-[10px] py-2 rounded-lg transition-colors uppercase tracking-wider cursor-pointer mt-1" ${
                     rescuers.filter((r) => r.isVerified && r.status === "available").length === 0
                       ? "disabled"
                       : ""
                   }>
                     Dispatch Unit
                   </button>`
            }
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: [0, -14], closeButton: true }).setDOMContent(
          popupDiv
        );

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener("click", () => {
          if (onSelectCasualty) onSelectCasualty(c.id);
        });

        const btn = popupDiv.querySelector(`#popup-btn-${c.id}`);
        if (btn) {
          btn.onclick = () => {
            const select = popupDiv.querySelector(`#popup-select-${c.id}`);
            const rescuerId = select ? select.value : "";
            if (rescuerId) {
              if (onDispatchToTarget) onDispatchToTarget(rescuerId, "victim", c.id, c.victim_name);
              popup.remove();
            }
          };
        }

        markersRef.current.push(marker);
      }
    });

    // 5. Update Rescuer Routes in GeoJSON Source
    const routeFeatures = [];
    rescuers
      .filter((r) => r.assignedAlert || r.assignedTargetType)
      .forEach((r) => {
        let tLat = null;
        let tLng = null;
        let pulseColor = "#dc2626";

        if (r.assignedAlert) {
          const alert = alerts.find((a) => a.id === r.assignedAlert);
          if (alert) {
            tLat = parseCoordinate(alert.lat || alert.latitude);
            tLng = parseCoordinate(alert.lng || alert.longitude);
          }
        } else if (r.assignedTargetType === "victim") {
          const victim = casualties.find((c) => String(c.id) === String(r.assignedTargetId));
          if (victim) {
            tLat = parseCoordinate(victim.latitude || victim.lat);
            tLng = parseCoordinate(victim.longitude || victim.lng);
            pulseColor = "#f59e0b";
          }
        }

        const rLat = parseCoordinate(r.lat || r.latitude);
        const rLng = parseCoordinate(r.lng || r.longitude);

        if (rLat && rLng && tLat && tLng) {
          routeFeatures.push({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [rLng, rLat],
                [tLng, tLat],
              ],
            },
            properties: { color: pulseColor },
          });
        }
      });

    if (map.getSource("rescuer-routes-src")) {
      map.getSource("rescuer-routes-src").setData({
        type: "FeatureCollection",
        features: routeFeatures,
      });
    }
  }, [alerts, rescuers, casualties, selected, selectedCasualtyId, onSelect, onSelectCasualty, onDispatchToTarget]);

  useEffect(() => {
    const map = mapRef.current;
    podMarkersRef.current.forEach((marker) => marker.remove());
    podMarkersRef.current = [];
    if (!map) return;

    pods.forEach((pod) => {
      if (!podHasFix(pod)) return;

      const activeSos = podHasSos(pod);
      const color = podColor(pod);
      const el = document.createElement("div");
      el.className = "relative flex flex-col items-center justify-center";
      el.innerHTML = `
        <div style="
          display:flex;align-items:center;justify-content:center;
          width:28px;height:28px;border-radius:9px;
          background:${color};border:2px solid white;color:white;
          font:bold 10px monospace;box-shadow:0 3px 10px rgba(15,23,42,.35)
        ">${activeSos ? "SOS" : "POD"}</div>
      `;
      el.setAttribute("aria-label", `${activeSos ? "SOS " : ""}Pod ${pod.nodeId}`);

      const popupContent = document.createElement("div");
      popupContent.style.cssText = "font:11px sans-serif;line-height:1.6;padding:3px";
      const title = document.createElement("strong");
      title.textContent = `Pod ${pod.nodeId}`;
      const details = document.createElement("div");
      details.textContent = `${activeSos ? "SOS detected" : "Telemetry"} · ${pod.bleVictims} BLE victim(s)`;
      const signal = document.createElement("div");
      signal.textContent = `LoRa RSSI ${pod.loraRssi} dBm · ${pod.sats} satellites`;
      const range = document.createElement("div");
      range.textContent = `LoRa range ${podRangeLabel} (${POD_RANGE_IS_MEASURED ? "measured" : "est."}, ${radioSummary()})`;
      range.style.color = "#64748b";
      popupContent.append(title, details, signal, range);

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([pod.lng, pod.lat])
        .setPopup(new mapboxgl.Popup({ offset: 16, closeButton: false }).setDOMContent(popupContent))
        .addTo(map);
      podMarkersRef.current.push(marker);
    });

    return () => {
      podMarkersRef.current.forEach((marker) => marker.remove());
      podMarkersRef.current = [];
    };
  }, [pods]);

  // LoRa gateway markers (fixed position from the gateway's firmware config),
  // plus the coverage radar around them. Markers are updated in place so an
  // open popup survives the 3 s telemetry refresh.
  useEffect(() => {
    radarDataRef.current = getGatewayRadarGeoJSON(gateways);
    const map = mapRef.current;
    if (!map) return;
    map.getSource("radar-src")?.setData(radarDataRef.current);

    const live = new Set(gateways.map((gw) => gw.id));
    gatewayMarkersRef.current.forEach((entry, id) => {
      if (!live.has(id)) {
        entry.marker.remove();
        gatewayMarkersRef.current.delete(id);
      }
    });

    gateways.forEach((gw) => {
      let entry = gatewayMarkersRef.current.get(gw.id);
      if (!entry) {
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="
            display:flex;align-items:center;justify-content:center;
            width:32px;height:32px;border-radius:10px;
            background:#0f172a;border:2px solid #f59e0b;color:#fbbf24;
            font:bold 10px monospace;box-shadow:0 3px 10px rgba(15,23,42,.45)
          ">GW</div>
        `;
        el.setAttribute("aria-label", `LoRa gateway ${gw.id}`);
        const popupContent = document.createElement("div");
        popupContent.style.cssText = "font:11px sans-serif;line-height:1.6;padding:3px;max-width:250px";
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([gw.lng, gw.lat])
          .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: false }).setDOMContent(popupContent))
          .addTo(map);
        entry = { marker, popupContent };
        gatewayMarkersRef.current.set(gw.id, entry);
      }
      entry.marker.setLngLat([gw.lng, gw.lat]);
      fillGatewayPopup(entry.popupContent, gw, pods);
    });
  }, [pods]); // `gateways` is derived from `pods`

  useEffect(
    () => () => {
      gatewayMarkersRef.current.forEach((entry) => entry.marker.remove());
      gatewayMarkersRef.current.clear();
    },
    []
  );

  // Keep the range rings on the pods' latest positions.
  useEffect(() => {
    podRangeDataRef.current = getPodRangeGeoJSON(pods);
    mapRef.current?.getSource("pod-range-src")?.setData(podRangeDataRef.current);
  }, [pods]);

  // Range ring visibility and the ping animation. The animation only runs
  // while rings are shown and at least one pod has a fix; with reduced motion
  // turned on, only the static boundary is drawn.
  useEffect(() => {
    showPodRangeRef.current = showPodRange;
    const map = mapRef.current;
    if (!map) return undefined;

    const animate = showPodRange && hasRangePods && !prefersReducedMotion();
    const setVisibility = (ids, visible) =>
      ids.forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      });
    setVisibility(POD_RANGE_STATIC_LAYERS, showPodRange);
    setVisibility(POD_RANGE_PULSE_LAYERS, animate);
    if (!animate) return undefined;

    let frameId;
    let lastFrame = 0;
    const tick = (now) => {
      frameId = requestAnimationFrame(tick);
      if (now - lastFrame < POD_RANGE_FRAME_MS) return;
      lastFrame = now;
      POD_RANGE_PULSE_LAYERS.forEach((id, i) => {
        // The layers may not exist yet if the style is still loading.
        if (!map.getLayer(id)) return;
        const progress = (now / POD_RANGE_PULSE_MS + i / POD_RANGE_PULSE_LAYERS.length) % 1;
        const fade = 1 - progress;
        map.setPaintProperty(id, "circle-radius", podPulseRadius(progress));
        map.setPaintProperty(id, "circle-opacity", 0.12 * fade);
        map.setPaintProperty(id, "circle-stroke-opacity", 0.75 * fade);
      });
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [showPodRange, hasRangePods]);

  // Controls Handlers
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetZoom = () => {
    mapRef.current?.flyTo({
      center: [122.0790, 6.9214],
      zoom: 15.3,
      pitch: is3D ? 58 : 0,
      bearing: is3D ? -22 : 0,
      duration: 1000,
    });
  };

  const handleToggle3DTilt = () => {
    const map = mapRef.current;
    if (!map) return;
    const currentPitch = map.getPitch();
    const nextPitch = currentPitch > 20 ? 0 : 60;
    map.easeTo({
      pitch: nextPitch,
      bearing: nextPitch > 20 ? -22 : 0,
      duration: 1000,
    });
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

      {/* Top Left: 2D Plan / 3D Model & Radar Toggles */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        <div className="flex bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200/80 gap-1">
          <button
            onClick={() => setIs3D(false)}
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-lg transition-all cursor-pointer ${
              !is3D ? "bg-red-700 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            2D PLAN
          </button>
          <button
            onClick={() => setIs3D(true)}
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              is3D ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Box size={13} className={is3D ? "text-amber-400" : ""} />
            3D MODEL
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleToggleRadar}
            aria-pressed={showDetectionWeb}
            title={
              gateways.length > 0
                ? "Show the gateway's LoRa coverage (strong / reliable / edge)"
                : "Gateway coverage appears once a gateway is forwarding pod reports"
            }
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md border ${
              showDetectionWeb
                ? "bg-white/95 backdrop-blur-md text-red-700 border-red-200"
                : "bg-white/95 backdrop-blur-md text-slate-500 border-slate-200 hover:text-slate-800"
            }`}
          >
            <Signal size={13} className={showDetectionWeb ? "text-red-600 animate-pulse" : "text-slate-400"} />
            <span>RADAR: {showDetectionWeb ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={() => setShowPodRange(!showPodRange)}
            aria-pressed={showPodRange}
            title={`Show each pod's ${POD_RANGE_IS_MEASURED ? "measured" : "estimated"} LoRa range (${radioSummary()})`}
            className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md border ${
              showPodRange
                ? "bg-white/95 backdrop-blur-md text-blue-700 border-blue-200"
                : "bg-white/95 backdrop-blur-md text-slate-500 border-slate-200 hover:text-slate-800"
            }`}
          >
            <RadioTower size={13} className={showPodRange ? "text-blue-600" : "text-slate-400"} />
            <span>POD RANGE: {showPodRange ? "ON" : "OFF"}</span>
          </button>

          {is3D && (
            <button
              onClick={handleToggle3DTilt}
              className="px-3 py-1.5 text-xs font-bold font-mono rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md border bg-white/95 backdrop-blur-md text-slate-700 border-slate-200 hover:text-slate-900"
              title="Toggle 3D View Angle"
            >
              <Compass size={13} className="text-red-600" />
              <span>{pitchAngle > 20 ? "TILT: 3D" : "TILT: FLAT"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Right: Location & Tactical Status */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-md text-xs font-mono text-slate-700 flex items-center gap-2">
        <MapPin size={13} className="text-red-600" />
        <span>6.9214° N, 122.0790° E · Tumaga</span>
        {is3D && (
          <span className="text-[10px] bg-slate-900 text-amber-400 px-1.5 py-0.5 rounded font-bold">
            3D MODELS
          </span>
        )}
      </div>

      {/* Bottom Left: Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-md p-3 text-xs">
        <div
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="flex items-center justify-between gap-4 font-bold text-slate-900 cursor-pointer select-none"
        >
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-slate-600" />
            <span className="text-[11px] uppercase tracking-wider font-mono">Map Legend</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{isLegendOpen ? "▲" : "▼"}</span>
        </div>

        {isLegendOpen && (
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-2 font-medium text-slate-700 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[8px] font-bold">
                SOS
              </span>
              <span>Distress Alert</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">
                R
              </span>
              <span>Rescuer Unit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[7px] font-bold">
                POD
              </span>
              <span>LoRa Rescuer Pod</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-md bg-slate-900 border border-amber-500 text-amber-400 flex items-center justify-center text-[7px] font-bold">
                GW
              </span>
              <span>LoRa Gateway</span>
            </div>
            {showDetectionWeb && (
              <div className="flex flex-col gap-1 pl-0.5">
                <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500">
                  Gateway coverage (est.)
                </span>
                {GATEWAY_RANGE_TIERS.map((tier) => (
                  <div key={tier.id} className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border-[1.5px] border-dashed"
                      style={{ borderColor: RADAR_TIER_COLORS[tier.id] }}
                    />
                    <span>
                      {tier.label} · {formatRange(tier.radiusM)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {showPodRange && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-[1.5px] border-dashed border-blue-600 bg-blue-600/10" />
                <span>
                  Pod LoRa range {podRangeLabel}
                  <span className="text-slate-400"> ({POD_RANGE_IS_MEASURED ? "measured" : "est."})</span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-bold">
                V
              </span>
              <span>Reported Victim</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-lg bg-sky-100 border border-sky-600 text-sky-700 flex items-center justify-center text-[8px] font-bold">
                🏛️
              </span>
              <span>Barangay Key Facility (3D Model)</span>
            </div>
            {is3D && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500 border-t border-slate-100 pt-1.5 font-mono">
                <Box size={12} className="text-amber-500" />
                <span>Right click + drag to pitch/rotate</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Right: Tactical Map Controls */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer font-bold"
          title="Zoom In"
        >
          <Plus size={15} />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer font-bold"
          title="Zoom Out"
        >
          <Minus size={15} />
        </button>
        <button
          onClick={handleResetZoom}
          className="w-8 h-8 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer"
          title="Reset View"
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  );
}

export { signalBars };
