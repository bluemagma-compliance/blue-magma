/**
	 * Frontend base URL used for building absolute redirect URLs.
	 *
	 * NOTE: This should ONLY be used for constructing URLs that the **browser** will
	 * follow (e.g. NextResponse.redirect). Server-side code MUST NOT use this for
	 * internal fetch() calls; use the internal API base from `config/api` instead
	 * (BLUE_MAGMA_API / API_BASE) to avoid going back out through Cloudflare.
	 *
	 * Priority:
	 * 1. PUBLIC_BASE_URL (preferred explicit env for OAuth / redirects)
	 * 2. NEXTAUTH_URL (legacy, kept for backward compatibility)
	 * 3. Sensible defaults based on NODE_ENV
	 */

const DEFAULT_DEV_BASE_URL = "http://localhost:3000";
const DEFAULT_PROD_BASE_URL = "https://app.trybluemagma.com";

export function getAppBaseUrl(): string {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.NODE_ENV === "production"
      ? DEFAULT_PROD_BASE_URL
      : DEFAULT_DEV_BASE_URL)
  );
}

