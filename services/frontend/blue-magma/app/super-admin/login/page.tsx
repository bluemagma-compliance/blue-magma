import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SuperAdminLoginClient from "./SuperAdminLoginClient";
import {
	getSuperAdminPageClientIp,
	getSuperAdminAllowedIps,
	isIpAllowedByWhitelist,
} from "@/utils/superAdminIp";

export const dynamic = "force-dynamic";

// NOTE: Temporary SUPER_ADMIN_IP_DEBUG logging was removed after we validated
// how headers are populated in the dev Docker environment. The page now uses
// getSuperAdminPageClientIp to prefer the browser IP from X-Real-IP.

	export default async function SuperAdminLoginPage() {
			const h = await headers();
			const clientIp = getSuperAdminPageClientIp(h);
			const allowedIps = getSuperAdminAllowedIps();

			const isAllowed = isIpAllowedByWhitelist(clientIp, allowedIps);

			if (!isAllowed) {
				// Log server-side whenever the super-admin page is hidden due to IP whitelist.
				// This helps distinguish a "real" 404 from one caused by SUPER_ADMIN_ALLOWED_IPS.
				console.warn(
					"[SUPER_ADMIN_IP_BLOCK] /super-admin/login blocked",
					{
						clientIp: clientIp ?? "unknown",
						allowedIps: allowedIps ?? "<unset>",
					},
				);
				// Behave as if the page does not exist for non-whitelisted IPs
				notFound();
			}

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Super admin login</h1>
          <p className="text-sm text-gray-600">
            This page is restricted to approved IP addresses and requires a
            two-step verification.
          </p>
        </div>
        <SuperAdminLoginClient />
      </div>
    </div>
  );
}

