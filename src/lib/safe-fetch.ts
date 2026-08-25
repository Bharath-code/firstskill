import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * SSRF guard: users hand us arbitrary URLs that the server then fetches.
 * Blocks non-public destinations (loopback, private ranges, link-local/cloud metadata).
 */

const MAX_REDIRECTS = 3;
const MAX_BYTES = 512_000;

export class BlockedUrlError extends Error {}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    // IPv4-mapped (::ffff:127.0.0.1)
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }

  const [a, b] = ip.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // AWS/GCP metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

/** Throws BlockedUrlError unless the URL is https and resolves only to public IPs. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("Invalid URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedUrlError("Only http(s) URLs are supported");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new BlockedUrlError("URL resolves to a non-public address");
    return url;
  }

  let records;
  try {
    records = await lookup(host, { all: true });
  } catch {
    throw new BlockedUrlError("Hostname does not resolve");
  }
  if (records.some((r) => isPrivateIp(r.address))) {
    throw new BlockedUrlError("URL resolves to a non-public address");
  }
  return url;
}

/**
 * fetch() with every redirect hop re-validated and the body size capped.
 * ponytail: revalidates per hop rather than pinning the resolved IP — a DNS
 * rebind between check and connect is still possible; pin via a custom agent if that matters.
 */
export async function safeFetch(
  raw: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; contentType: string; text: string; url: string }> {
  const { timeoutMs = 8000, ...rest } = init;
  let target = raw;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(target);
    const res = await fetch(url, {
      ...rest,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new BlockedUrlError("Redirect without location");
      target = new URL(location, url).toString();
      continue;
    }

    const reader = res.body?.getReader();
    let text = "";
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        text += decoder.decode(value, { stream: true });
        if (total >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") || "",
      text,
      url: url.toString(),
    };
  }

  throw new BlockedUrlError("Too many redirects");
}
