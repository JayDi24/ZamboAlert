/** Barangay admin API (zamboalert-web/backend) — login, rescuers, households, etc. */
const configuredAdminPort = Number(import.meta.env.VITE_API_PORT || 5000);
export const ADMIN_API_PORTS = [...new Set([configuredAdminPort, 5000, 5001, 5002, 5003, 5010])];

/**
 * Pod telemetry lives on root backend :3000.
 * Web backend :5000 also proxies GET /api/telemetry when the gateway backend is up.
 */
const configuredTelemetryPort = Number(import.meta.env.VITE_TELEMETRY_PORT || 3000);
export const TELEMETRY_API_PORTS = [
  ...new Set([configuredTelemetryPort, 3000, ...ADMIN_API_PORTS]),
];

/** @deprecated Use ADMIN_API_PORTS — kept for any older imports */
export const API_PORTS = ADMIN_API_PORTS;

async function fetchAcrossPorts(ports, endpoint, options = {}) {
  const { headers, ...rest } = options;
  let lastError;

  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}${endpoint}`, {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
        },
      });

      // Skip wrong server (route missing) or empty proxy when gateway backend is down
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return fetch(`http://localhost:${ports[0]}${endpoint}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });
}

/** Admin / CRUD calls → web backend (:5000+) */
export async function apiFetch(endpoint, options = {}) {
  return fetchAcrossPorts(ADMIN_API_PORTS, endpoint, options);
}

/** Live pod / SOS telemetry → root :3000, then web proxy on :5000+ */
export async function fetchTelemetry(options = {}) {
  return fetchAcrossPorts(TELEMETRY_API_PORTS, "/api/telemetry", options);
}
