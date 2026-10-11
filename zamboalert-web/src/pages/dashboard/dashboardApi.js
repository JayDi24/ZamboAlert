const configuredPort = Number(import.meta.env.VITE_API_PORT || 3000);
export const API_PORTS = [...new Set([configuredPort, 3000, 5000, 5001, 5002, 5003, 5010])];

export async function apiFetch(endpoint, options = {}) {
  const { headers, ...rest } = options;
  let lastError;

  for (const port of API_PORTS) {
    try {
      const response = await fetch(`http://localhost:${port}${endpoint}`, {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
        },
      });

      if (response.status !== 404) {
        return response;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return fetch(`http://localhost:${API_PORTS[0]}${endpoint}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
  });
}
