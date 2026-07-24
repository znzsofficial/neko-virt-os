import { describe, expect, it } from "vitest";
import { formatConnectionType, formatEffectiveType, parseIceCandidate } from "./networkInfo";

describe("parseIceCandidate", () => {
  it("parses host IPv4 candidates", () => {
    const hits = parseIceCandidate(
      "candidate:842163049 1 udp 1677729535 192.168.1.5 54321 typ host generation 0",
    );
    expect(hits.some((h) => h.address === "192.168.1.5" && h.type === "host")).toBe(true);
  });

  it("parses mDNS host candidates", () => {
    const hits = parseIceCandidate(
      "candidate:1 1 udp 2122260223 abcdef12-3456-7890-abcd-ef1234567890.local 54321 typ host",
    );
    expect(hits.some((h) => h.mdns && h.address.endsWith(".local"))).toBe(true);
  });

  it("parses srflx public candidates", () => {
    const hits = parseIceCandidate(
      "candidate:2 1 udp 1686052607 42.200.231.106 9 typ srflx raddr 0.0.0.0 rport 0",
      { address: "42.200.231.106", type: "srflx", relatedAddress: "0.0.0.0" },
    );
    expect(hits.some((h) => h.address === "42.200.231.106" && h.type === "srflx")).toBe(true);
  });

  it("uses RTCIceCandidate address field", () => {
    const hits = parseIceCandidate("candidate:x", {
      address: "10.0.0.8",
      type: "host",
    });
    expect(hits).toEqual([{ address: "10.0.0.8", type: "host", mdns: false }]);
  });
});

describe("format helpers", () => {
  it("maps unknown connection type to dash", () => {
    expect(formatConnectionType("unknown")).toBe("—");
    expect(formatEffectiveType("4g")).toBe("4G+");
  });
});
