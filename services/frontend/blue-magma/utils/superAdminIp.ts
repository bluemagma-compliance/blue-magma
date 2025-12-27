// Utilities for extracting client IP and checking it against SUPER_ADMIN_ALLOWED_IPS.
// This is server-side only logic, mirroring the backend's IsIPInWhitelist behavior
// for IPv4 and exact IP matches. The backend remains the ultimate source of truth.

/** Get the client IP from standard proxy headers. */
export function getClientIpFromHeaders(headers: Headers): string | null {
	const xForwardedFor =
		headers.get("x-forwarded-for") || headers.get("X-Forwarded-For");
	if (xForwardedFor) {
		const first = xForwardedFor.split(",")[0]?.trim();
		if (first) return first;
	}

	const xRealIp = headers.get("x-real-ip") || headers.get("X-Real-IP");
	if (xRealIp) return xRealIp.trim();

	const forwarded = headers.get("forwarded") || headers.get("Forwarded");
	if (forwarded) {
		// Simple parse for patterns like: "for=203.0.113.43;proto=https;host=example.com"
		const match = forwarded.match(/for=([^;]+)/i);
		if (match && match[1]) {
			return match[1].replace(/^["']|["']$/g, "").trim();
		}
	}

	return null;
}

/**
 * For guarding super-admin pages, prefer the browser IP as seen in X-Real-IP.
 * If X-Real-IP is not present, fall back to the generic header-based helper.
 */
export function getSuperAdminPageClientIp(headers: Headers): string | null {
	const xRealIp = headers.get("x-real-ip") || headers.get("X-Real-IP");
	if (xRealIp) {
		const trimmed = xRealIp.trim();
		if (trimmed) {
			return trimmed;
		}
	}

	return getClientIpFromHeaders(headers);
}

/** Parse an IPv4 address into a 32-bit number. Returns null if invalid or not IPv4. */
function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    if (!/^[0-9]+$/.test(part)) return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    result = (result << 8) | value;
  }

  // Force unsigned 32-bit
  return result >>> 0;
}

/**
 * Check whether an IP address is contained in an IPv4 CIDR range.
 * This intentionally focuses on IPv4; IPv6 CIDRs are handled by the backend.
 */
function ipv4CidrContains(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  if (!range || !bitsStr) return false;

  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ipNum = parseIPv4(ip);
  const rangeNum = parseIPv4(range);
  if (ipNum == null || rangeNum == null) return false;

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

/** Return the raw SUPER_ADMIN_ALLOWED_IPS value from the environment. */
export function getSuperAdminAllowedIps(): string | null {
  return process.env.SUPER_ADMIN_ALLOWED_IPS || null;
}

/**
 * Check whether the given IP address is allowed by the SUPER_ADMIN_ALLOWED_IPS string.
 *
 * Supports:
 * - Exact IP matches (IPv4 or IPv6)
 * - IPv4 CIDR ranges (e.g. "192.168.1.0/24")
 *
 * IPv6 CIDR ranges are validated by the backend only; here they will safely
 * return false so the backend remains the final authority.
 */
export function isIpAllowedByWhitelist(
  ipAddress: string | null | undefined,
  whitelist: string | null | undefined,
): boolean {
  if (!ipAddress || !whitelist) return false;

  const trimmedIp = ipAddress.trim();
  if (!trimmedIp) return false;

  const entries = whitelist
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    if (entry.includes("/")) {
      // IPv4 CIDR support; IPv6 CIDR will simply not match here
      if (ipv4CidrContains(trimmedIp, entry)) {
        return true;
      }
    } else if (entry === trimmedIp) {
      return true;
    }
  }

  return false;
}

