import { NextRequest, NextResponse } from "next/server";
import {
  getClientIpFromHeaders,
  getSuperAdminAllowedIps,
  isIpAllowedByWhitelist,
} from "@/utils/superAdminIp";
import { BASE_URL } from "@/config/api";

interface SuperAdminLoginRequest {
  login_identifier: string;
  password: string;
}

// Use the existing internal backend base URL (BLUE_MAGMA_API -> BASE_URL).
// We do NOT introduce any new env vars here; frontend should only rely on
// SUPER_ADMIN_ALLOWED_IPS for super-admin concerns.
const SUPER_ADMIN_LOGIN_URL = `${BASE_URL}/super-admin/auth/login`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SuperAdminLoginRequest>;

    if (!body.login_identifier || !body.password) {
      return NextResponse.json(
        { error: "login_identifier and password are required" },
        { status: 400 },
      );
    }

    const headersObj = request.headers;
    const clientIp = getClientIpFromHeaders(headersObj);
    const allowedIps = getSuperAdminAllowedIps();

    if (!allowedIps) {
      return NextResponse.json(
        { error: "Super admin IP whitelist is not configured" },
        { status: 500 },
      );
    }

    if (!isIpAllowedByWhitelist(clientIp, allowedIps)) {
      // Fail closed and avoid leaking that the super-admin endpoint exists
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

	    const targetUrl = SUPER_ADMIN_LOGIN_URL;

    let backendResponse: Response;
    try {
      backendResponse = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Propagate the original client IP so the backend can perform its own checks
          "X-Real-IP": clientIp ?? "",
          "X-Forwarded-For": clientIp ?? "",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("Error calling super admin backend login:", error);
      return NextResponse.json(
        { error: "Failed to reach super admin backend" },
        { status: 502 },
      );
    }

    let data: unknown = null;
    try {
      data = await backendResponse.json();
    } catch {
      // If backend didn't return JSON, map to a generic error
      if (!backendResponse.ok) {
        return NextResponse.json(
          { error: "Super admin login failed" },
          { status: backendResponse.status },
        );
      }
    }

    return NextResponse.json(data ?? {}, { status: backendResponse.status });
  } catch (error) {
    console.error("Unexpected error in super admin login route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

