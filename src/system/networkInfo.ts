/** Browser-reachable network diagnostics (no real NIC / router / MAC access). */

export type NetworkSnapshot = {
  online: boolean;
  /** Network Information API type, or "unknown". */
  connectionType: string;
  /** Network Information API effectiveType (slow-2g…4g), or "unknown". */
  effectiveType: string;
  /** Browser estimate Mbps (Network Information API). */
  downlinkMbps: number | null;
  /** Browser estimate RTT ms (Network Information API). */
  rttMs: number | null;
  /** Measured RTT to a public endpoint (ms), best-effort. */
  measuredRttMs: number | null;
  saveData: boolean;
  /** Current page host (location.hostname). */
  pageHost: string;
  /** location.protocol without trailing colon. */
  pageProtocol: string;
  /** Public IPv4/IPv6 if reachable. */
  publicIp: string | null;
  /** IP lookup provider label when publicIp is set. */
  publicIpSource: string | null;
  /** Candidate addresses from WebRTC ICE (host / srflx / etc.). */
  localIps: string[];
  /** Host / private addresses preferred as LAN. */
  lanIps: string[];
  /** mDNS hostnames when browser hides real host IPs. */
  mdnsHosts: string[];
  /** STUN reflexive addresses (often equal to public IP). */
  reflexiveIps: string[];
  /**
   * WebRTC gather result:
   * - ok: got usable addresses
   * - mdns: only mDNS host names (privacy)
   * - empty: gathering finished with nothing useful
   * - fail: API missing or error
   */
  webrtcStatus: "ok" | "mdns" | "empty" | "fail";
  updatedAt: number;
};

type NavConnection = {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type IceHit = {
  address: string;
  type: "host" | "srflx" | "prflx" | "relay" | "unknown";
  mdns?: boolean;
};

const PUBLIC_IP_ENDPOINTS: { url: string; source: string; parse: (text: string) => string | null }[] = [
  {
    url: "https://api.ipify.org?format=json",
    source: "ipify",
    parse: (text) => {
      try {
        const data = JSON.parse(text) as { ip?: string };
        return data.ip?.trim() || null;
      } catch {
        return null;
      }
    },
  },
  {
    url: "https://api64.ipify.org?format=json",
    source: "ipify64",
    parse: (text) => {
      try {
        const data = JSON.parse(text) as { ip?: string };
        return data.ip?.trim() || null;
      } catch {
        return null;
      }
    },
  },
  {
    url: "https://cloudflare.com/cdn-cgi/trace",
    source: "cloudflare",
    parse: (text) => {
      const line = text.split("\n").find((row) => row.startsWith("ip="));
      return line?.slice(3).trim() || null;
    },
  },
  {
    url: "https://1.1.1.1/cdn-cgi/trace",
    source: "cloudflare-1.1.1.1",
    parse: (text) => {
      const line = text.split("\n").find((row) => row.startsWith("ip="));
      return line?.slice(3).trim() || null;
    },
  },
];

function readConnection(): NavConnection | undefined {
  const nav = navigator as Navigator & {
    connection?: NavConnection;
    mozConnection?: NavConnection;
    webkitConnection?: NavConnection;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function isPrivateOrLocal(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("127.") || ip.startsWith("0.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) return true;
  return false;
}

function isLikelyIp(value: string): boolean {
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) {
    return value.split(".").every((part) => {
      const n = Number(part);
      return n >= 0 && n <= 255;
    });
  }
  return value.includes(":") && /^[a-fA-F0-9:.]+$/.test(value) && value.length >= 3;
}

function isMdnsHost(value: string): boolean {
  return /\.local\.?$/i.test(value);
}

function normalizeAddress(value: string): string {
  return value.replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function parseIceType(raw: string): IceHit["type"] {
  const m = raw.match(/\btyp\s+(host|srflx|prflx|relay)\b/i);
  if (!m) return "unknown";
  return m[1].toLowerCase() as IceHit["type"];
}

/** Parse one ICE candidate line or RTCIceCandidate fields into hits. */
export function parseIceCandidate(
  raw: string,
  fields?: { address?: string | null; type?: string | null; relatedAddress?: string | null },
): IceHit[] {
  const hits: IceHit[] = [];
  const type = (fields?.type as IceHit["type"] | undefined) || parseIceType(raw);

  const push = (address: string | null | undefined, hitType: IceHit["type"]) => {
    if (!address) return;
    const value = normalizeAddress(address);
    if (!value || value === "0.0.0.0" || value === "::") return;
    if (isMdnsHost(value)) {
      hits.push({ address: value, type: hitType, mdns: true });
      return;
    }
    if (!isLikelyIp(value)) return;
    if (value.startsWith("127.") || value === "::1") return;
    hits.push({ address: value, type: hitType, mdns: false });
  };

  push(fields?.address ?? undefined, type);
  push(fields?.relatedAddress ?? undefined, type === "srflx" ? "host" : type);

  // Foundation line: foundation component protocol priority address port typ …
  // address is usually the 5th token (index 4) for classic form starting with "candidate:"
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length >= 5) {
    // Skip foundation (may be "candidate:xxx" or just foundation id)
    const maybeAddr = tokens[4];
    if (maybeAddr && (isLikelyIp(normalizeAddress(maybeAddr)) || isMdnsHost(maybeAddr))) {
      push(maybeAddr, type);
    }
  }

  for (const token of tokens) {
    const cleaned = normalizeAddress(token);
    if (isMdnsHost(cleaned) || isLikelyIp(cleaned)) push(cleaned, type);
  }

  // IPv4 fallback
  const v4 = raw.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/g);
  if (v4) {
    for (const ip of v4) {
      if (ip !== "0.0.0.0") push(ip, type);
    }
  }

  // mDNS hostnames
  const mdns = raw.match(/\b([a-zA-Z0-9-]+\.local)\b/g);
  if (mdns) {
    for (const host of mdns) push(host, type === "unknown" ? "host" : type);
  }

  // Deduplicate by address+type
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = `${hit.type}:${hit.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseSdpCandidates(sdp: string | undefined): IceHit[] {
  if (!sdp) return [];
  const hits: IceHit[] = [];
  for (const line of sdp.split(/\r?\n/)) {
    if (!line.startsWith("a=candidate:")) continue;
    hits.push(...parseIceCandidate(line.slice(2)));
  }
  return hits;
}

export function formatConnectionType(type: string): string {
  const map: Record<string, string> = {
    bluetooth: "Bluetooth",
    cellular: "Cellular",
    ethernet: "Ethernet",
    none: "None",
    wifi: "Wi‑Fi",
    wimax: "WiMAX",
    other: "Other",
    unknown: "—",
    "—": "—",
  };
  return map[type] ?? type;
}

export function formatEffectiveType(value: string): string {
  const map: Record<string, string> = {
    "slow-2g": "Slow 2G",
    "2g": "2G",
    "3g": "3G",
    "4g": "4G+",
    "—": "—",
    unknown: "—",
  };
  return map[value] ?? value;
}

export function readNetworkBasics(): Omit<
  NetworkSnapshot,
  | "publicIp"
  | "publicIpSource"
  | "localIps"
  | "lanIps"
  | "mdnsHosts"
  | "reflexiveIps"
  | "webrtcStatus"
  | "measuredRttMs"
  | "updatedAt"
> {
  const connection = readConnection();
  const type = connection?.type || "unknown";
  const effectiveType = connection?.effectiveType || "unknown";
  return {
    online: typeof navigator.onLine === "boolean" ? navigator.onLine : true,
    connectionType: type,
    effectiveType,
    downlinkMbps: typeof connection?.downlink === "number" ? connection.downlink : null,
    rttMs: typeof connection?.rtt === "number" ? connection.rtt : null,
    saveData: Boolean(connection?.saveData),
    pageHost: typeof location !== "undefined" ? location.hostname || "—" : "—",
    pageProtocol: typeof location !== "undefined" ? (location.protocol || "").replace(":", "") || "—" : "—",
  };
}

/** Best-effort public IP via multiple HTTPS endpoints. */
export async function fetchPublicIp(
  signal?: AbortSignal,
): Promise<{ ip: string | null; source: string | null; rttMs: number | null }> {
  for (const endpoint of PUBLIC_IP_ENDPOINTS) {
    if (signal?.aborted) break;
    const started = performance.now();
    try {
      const response = await fetch(endpoint.url, {
        method: "GET",
        cache: "no-store",
        signal,
      });
      if (!response.ok) continue;
      const text = await response.text();
      const ip = endpoint.parse(text);
      if (ip && isLikelyIp(ip)) {
        return {
          ip,
          source: endpoint.source,
          rttMs: Math.round(performance.now() - started),
        };
      }
    } catch {
      if (signal?.aborted) throw new DOMException("Network diagnostics aborted", "AbortError");
      // try next
    }
  }
  return { ip: null, source: null, rttMs: null };
}

/**
 * Best-effort local / host candidates via WebRTC ICE.
 * Chrome often returns mDNS (.local) for host candidates instead of real LAN IPs.
 */
export async function discoverLocalIps(
  timeoutMs = 4000,
  signal?: AbortSignal,
  createPeerConnection: (configuration: RTCConfiguration) => RTCPeerConnection = (configuration) => new RTCPeerConnection(configuration),
): Promise<{
  all: string[];
  lan: string[];
  mdns: string[];
  reflexive: string[];
  status: NetworkSnapshot["webrtcStatus"];
}> {
  const hits: IceHit[] = [];
  let pc: RTCPeerConnection | null = null;
  try {
    if (signal?.aborted) throw new DOMException("Network diagnostics aborted", "AbortError");
    pc = createPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    });
    pc.createDataChannel("neko-net");

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        globalThis.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => fail(new DOMException("Network diagnostics aborted", "AbortError"));
      const timer = globalThis.setTimeout(finish, timeoutMs);
      signal?.addEventListener("abort", onAbort, { once: true });

      pc!.onicecandidate = (event) => {
        if (!event.candidate) {
          finish();
          return;
        }
        const c = event.candidate;
        hits.push(
          ...parseIceCandidate(c.candidate, {
            address: c.address,
            type: c.type,
            relatedAddress: c.relatedAddress,
          }),
        );
      };

      pc!.onicegatheringstatechange = () => {
        if (pc!.iceGatheringState === "complete") finish();
      };

      void pc!
        .createOffer({ offerToReceiveAudio: true })
        .then((offer) => pc!.setLocalDescription(offer))
        .catch(fail);
    });

    // SDP may contain candidates not delivered via the event in some engines
    hits.push(...parseSdpCandidates(pc.localDescription?.sdp));
  } catch (error) {
    try {
      pc?.close();
    } catch {
      // ignore
    }
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { all: [], lan: [], mdns: [], reflexive: [], status: "fail" };
  } finally {
    try {
      pc?.close();
    } catch {
      // ignore
    }
  }

  const mdns = new Set<string>();
  const lan = new Set<string>();
  const reflexive = new Set<string>();
  const all = new Set<string>();

  for (const hit of hits) {
    if (hit.mdns) {
      mdns.add(hit.address);
      continue;
    }
    all.add(hit.address);
    if (hit.type === "srflx" || hit.type === "relay") {
      reflexive.add(hit.address);
    }
    if (hit.type === "host" || isPrivateOrLocal(hit.address)) {
      lan.add(hit.address);
    }
  }

  const allList = [...all].sort(
    (a, b) => Number(isPrivateOrLocal(b)) - Number(isPrivateOrLocal(a)) || a.localeCompare(b),
  );
  const lanList = [...lan].sort((a, b) => a.localeCompare(b));
  const mdnsList = [...mdns].sort((a, b) => a.localeCompare(b));
  const reflexiveList = [...reflexive].sort((a, b) => a.localeCompare(b));

  let status: NetworkSnapshot["webrtcStatus"] = "empty";
  if (lanList.length || allList.length) status = "ok";
  else if (mdnsList.length) status = "mdns";
  else if (reflexiveList.length) status = "ok";

  return {
    all: allList,
    lan: lanList,
    mdns: mdnsList,
    reflexive: reflexiveList,
    status,
  };
}

export async function collectNetworkSnapshot(signal?: AbortSignal): Promise<NetworkSnapshot> {
  const basics = readNetworkBasics();
  const [publicResult, ice] = await Promise.all([
    basics.online ? fetchPublicIp(signal) : Promise.resolve({ ip: null, source: null, rttMs: null }),
    discoverLocalIps(4000, signal),
  ]);
  if (signal?.aborted) throw new DOMException("Network diagnostics aborted", "AbortError");

  const publicIp = publicResult.ip;
  const localIps = ice.all.filter((ip) => ip !== publicIp);
  const lanIps = ice.lan.filter((ip) => ip !== publicIp);
  // Keep reflexive even if it matches public IP — useful confirmation
  const reflexiveIps = ice.reflexive;

  return {
    ...basics,
    measuredRttMs: publicResult.rttMs,
    publicIp,
    publicIpSource: publicResult.source,
    localIps,
    lanIps,
    mdnsHosts: ice.mdns,
    reflexiveIps,
    webrtcStatus: ice.status,
    updatedAt: Date.now(),
  };
}

export function subscribeNetworkChange(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  const connection = readConnection();
  connection?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
    connection?.removeEventListener?.("change", onChange);
  };
}
