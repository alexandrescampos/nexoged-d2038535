export interface CapturedGeo {
  source: "gps" | "denied" | "unavailable" | "unsupported";
  lat?: number;
  lng?: number;
  accuracy?: number;
}

/**
 * Tenta capturar a geolocalização via GPS do navegador.
 * Em caso de negação ou indisponibilidade, retorna source != "gps"
 * e o servidor faz fallback por IP.
 */
export function captureGeolocation(timeoutMs = 8000): Promise<CapturedGeo> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ source: "unsupported" });
      return;
    }
    let resolved = false;
    const t = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ source: "unavailable" });
      }
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(t);
        resolve({
          source: "gps",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(t);
        resolve({ source: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
