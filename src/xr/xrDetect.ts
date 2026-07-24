export function getXrSystem(): XRSystem | null {
  try {
    return (navigator as Navigator & { xr?: XRSystem | null }).xr ?? null;
  } catch {
    return null;
  }
}

export type XrDiagnostics = {
  secure: boolean;
  hasXr: boolean;
  protocol: string;
  host: string;
  summary: string;
};

/** Snapshot for Settings / notifications (Quest has no console). */
export function getXrDiagnostics(): XrDiagnostics {
  const secure =
    typeof (globalThis as { isSecureContext?: boolean }).isSecureContext === "boolean"
      ? Boolean((globalThis as { isSecureContext?: boolean }).isSecureContext)
      : typeof window !== "undefined"
        ? window.isSecureContext
        : false;
  const hasXr = Boolean(getXrSystem());
  const protocol = typeof location !== "undefined" ? location.protocol : "?";
  const host = typeof location !== "undefined" ? location.host : "?";
  return {
    secure,
    hasXr,
    protocol,
    host,
    summary: `secure=${secure} xr=${hasXr} ${protocol}//${host}`,
  };
}

/** Minimal init for Meta Quest Browser. */
export function buildQuestVrSessionInit(): XRSessionInit {
  return {
    requiredFeatures: ["local-floor"],
    // No hand-tracking optional — we don't use hands and it can add cost on Quest.
    optionalFeatures: ["bounded-floor"],
  };
}

export function formatXrSessionError(err: unknown, fallback = "requestSession failed"): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "Error";
  return `${name}: ${message || fallback} · ${getXrDiagnostics().summary}`;
}
