import dns from 'node:dns';
import net from 'node:net';

/**
 * SSRF-hardened fetch for user-supplied URLs (used by the API Fetcher node).
 *
 * Guards applied:
 *  - scheme must be http/https
 *  - no embedded credentials (user:pass@host)
 *  - every DNS-resolved address must be a public/global unicast address
 *    (blocks loopback, private RFC1918, link-local incl. cloud metadata
 *    169.254.169.254, CGNAT, ULA, multicast, reserved ranges)
 *  - request timeout
 *  - response body size cap
 *
 * Note on TOCTOU: we resolve and validate the host, then hand the original URL
 * to fetch, which resolves again. A hostile DNS server could in theory return a
 * public IP to us and a private IP to fetch (DNS rebinding). Fully closing that
 * requires pinning the validated IP at the socket layer, which the platform
 * fetch does not expose; the check below stops the overwhelmingly common cases.
 */

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SafeFetchResult {
  status: number;
  ok: boolean;
  contentType: string | null;
  text: string;
  truncated: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1_000_000; // 1 MB

function ipv4IsBlocked(ip: string): boolean {
  const parts = ip.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed -> block
  }
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved

  return false;
}

/** Expand any valid IPv6 literal (compressed, zone-suffixed, or with an
 *  embedded IPv4 tail) into its 8 hextets. Returns null if unparseable. */
function parseIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0]; // strip zone id

  // Embedded IPv4 tail, e.g. ::ffff:127.0.0.1 or 64:ff9b::192.0.2.1
  let v4Hextets: number[] = [];
  const v4match = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4match && v4match.index !== undefined) {
    const octets = v4match[1].split('.').map((n) => parseInt(n, 10));
    if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return null;
    }
    v4Hextets = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    s = s.slice(0, v4match.index); // leaves a trailing ':' before the v4 part
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (part: string) =>
    part ? part.split(':').filter((x) => x !== '').map((h) => parseInt(h, 16)) : [];

  const head = parseGroups(halves[0]);
  const tail = halves.length === 2 ? parseGroups(halves[1]) : [];

  let hextets: number[];
  if (halves.length === 2) {
    const known = head.length + tail.length + v4Hextets.length;
    const zeros = 8 - known;
    if (zeros < 0) return null;
    hextets = [...head, ...Array(zeros).fill(0), ...tail, ...v4Hextets];
  } else {
    hextets = [...head, ...v4Hextets];
  }

  if (hextets.length !== 8 || hextets.some((h) => Number.isNaN(h) || h < 0 || h > 0xffff)) {
    return null;
  }
  return hextets;
}

function ipv6IsBlocked(ip: string): boolean {
  const h = parseIPv6(ip);
  if (!h) return true; // unparseable -> block

  const allZeroPrefix = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0;

  if (h.every((x) => x === 0)) return true; // :: unspecified
  if (allZeroPrefix && h[5] === 0 && h[6] === 0 && h[7] === 1) return true; // ::1 loopback

  // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96) -> check the v4
  const embedsV4 =
    (allZeroPrefix && h[5] === 0xffff) ||
    (allZeroPrefix && h[5] === 0 && (h[6] !== 0 || h[7] !== 0));
  if (embedsV4) {
    const v4 = `${h[6] >> 8}.${h[6] & 0xff}.${h[7] >> 8}.${h[7] & 0xff}`;
    return ipv4IsBlocked(v4);
  }

  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  return false;
}

function addressIsBlocked(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return ipv4IsBlocked(ip);
  if (family === 6) return ipv6IsBlocked(ip);
  return true; // not a valid IP literal -> block
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme "${url.protocol}". Only http and https are allowed.`);
  }
  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets

  // If the host is already an IP literal, validate it directly.
  if (net.isIP(hostname)) {
    if (addressIsBlocked(hostname)) {
      throw new Error('Blocked request to a private, loopback, or reserved IP address.');
    }
    return url;
  }

  // Otherwise resolve every address the hostname maps to and validate them all.
  let addresses: { address: string }[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve host "${hostname}".`);
  }
  if (addresses.length === 0) {
    throw new Error(`Host "${hostname}" did not resolve to any address.`);
  }
  for (const { address } of addresses) {
    if (addressIsBlocked(address)) {
      throw new Error('Blocked request to a host that resolves to a private or reserved IP address.');
    }
  }

  return url;
}

export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const {
    method = 'GET',
    headers,
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
  } = options;

  const url = await assertPublicUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upperMethod = method.toUpperCase();
    const hasBody = body != null && upperMethod !== 'GET' && upperMethod !== 'HEAD';

    const response = await fetch(url.toString(), {
      method: upperMethod,
      headers,
      body: hasBody ? body : undefined,
      redirect: 'follow',
      signal: controller.signal,
    });

    // Fast reject on an advertised oversized body.
    const declaredLength = Number(response.headers.get('content-length') || '0');
    if (declaredLength && declaredLength > maxBytes) {
      throw new Error(`Response too large (${declaredLength} bytes, limit ${maxBytes}).`);
    }

    // Stream the body and enforce the cap even when content-length is absent.
    const reader = response.body?.getReader();
    let text = '';
    let received = 0;
    let truncated = false;

    if (reader) {
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          const remaining = maxBytes - (received - value.byteLength);
          text += decoder.decode(value.slice(0, Math.max(0, remaining)), { stream: false });
          truncated = true;
          await reader.cancel();
          break;
        }
        text += decoder.decode(value, { stream: true });
      }
      if (!truncated) text += decoder.decode();
    } else {
      text = await response.text();
      if (text.length > maxBytes) {
        text = text.slice(0, maxBytes);
        truncated = true;
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      text,
      truncated,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
