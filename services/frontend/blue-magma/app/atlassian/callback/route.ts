import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

// Verify HMAC signature of state token
function verifyStateSignature(
  state: string,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(state)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

export async function GET(request: NextRequest) {
  // Get the origin from the request headers (preserves localhost vs 127.0.0.1)
  const origin = request.headers.get("x-forwarded-proto") && request.headers.get("x-forwarded-host")
    ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
    : request.nextUrl.origin;

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors from Atlassian
    if (error) {
      console.error("Atlassian OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        new URL(
          `/atlassian/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || "")}`,
          origin,
        ),
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error("Missing required OAuth parameters");
      return NextResponse.redirect(
        new URL(
          "/atlassian/error?error=missing_parameters&description=Missing code or state parameter",
          origin,
        ),
      );
    }

    const cookieStore = await cookies();
    const stateSecret = process.env.CONFLUENCE_STATE_SECRET || "default-secret";

    // Validate state token integrity using HMAC signature
    const storedState = cookieStore.get("confluence_oauth_state")?.value;
    const storedSignature = cookieStore.get("confluence_oauth_state_sig")?.value;

    if (!storedState || !storedSignature) {
      console.error("Missing state or signature in cookies");
      return NextResponse.redirect(
        new URL(
          "/atlassian/error?error=csrf_validation&description=State validation failed - missing cookies",
          origin,
        ),
      );
    }

    // Verify state matches
    if (storedState !== state) {
      console.error("State token mismatch - possible CSRF attack");
      return NextResponse.redirect(
        new URL(
          "/atlassian/error?error=csrf_validation&description=State token mismatch",
          origin,
        ),
      );
    }

    // Verify signature (ensures state hasn't been tampered with)
    try {
      if (!verifyStateSignature(state, storedSignature, stateSecret)) {
        console.error("State signature verification failed");
        return NextResponse.redirect(
          new URL(
            "/atlassian/error?error=csrf_validation&description=State signature verification failed",
            origin,
          ),
        );
      }
    } catch (sigError) {
      console.error("Signature verification error:", sigError);
      return NextResponse.redirect(
        new URL(
          "/atlassian/error?error=csrf_validation&description=Signature verification error",
          origin,
        ),
      );
    }

    // Get organization ID from cookies (untrusted - will be validated by backend)
    const orgIdFromCookie = cookieStore.get("confluence_oauth_org")?.value;
    const orgIdFromAuth = cookieStore.get("organization_id")?.value;

    if (!orgIdFromCookie || !orgIdFromAuth) {
      console.error("Missing organization ID");
      return NextResponse.redirect(
        new URL(
          "/atlassian/error?error=missing_org&description=Missing organization context",
          origin,
        ),
      );
    }

    // Verify org IDs match (defense in depth)
    if (orgIdFromCookie !== orgIdFromAuth) {
      console.error("Organization ID mismatch - possible tampering");
      return NextResponse.redirect(
        new URL(
          "/atlassian/error?error=org_mismatch&description=Organization validation failed",
          origin,
        ),
      );
    }

    // Send callback to backend app service
    // The backend will:
    // 1. Exchange code for access token with Atlassian
    // 2. Store tokens securely bound to organization
    const backendUrl = process.env.BLUE_MAGMA_API || "http://localhost:80";

    // Get access token from cookies for authentication
    const accessToken = cookieStore.get("access_token")?.value;

    const callbackResponse = await fetch(
      `${backendUrl}/api/v1/integrations/confluence/callback`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          code,
          organization_id: orgIdFromAuth,
        }),
      },
    );

    if (!callbackResponse.ok) {
      const errorData = await callbackResponse.json().catch(() => ({}));
      console.error("Confluence callback error:", errorData);

      // Handle specific error cases
      let errorType = "callback_failed";
      let errorDescription = errorData.detail || "Failed to process callback";

      if (callbackResponse.status === 409) {
        errorType = "duplicate_installation";
        errorDescription = "This Confluence workspace is already connected. Please use the existing integration.";
      }

      return NextResponse.redirect(
        new URL(
          `/atlassian/error?error=${encodeURIComponent(errorType)}&description=${encodeURIComponent(errorDescription)}`,
          origin,
        ),
      );
    }

    // Extract response data from backend
    const responseData = await callbackResponse.json();
    console.log("Backend callback response:", JSON.stringify(responseData, null, 2));
    console.log("Response keys:", Object.keys(responseData));
    console.log("installationId value:", responseData.installationId);
    console.log("installationId type:", typeof responseData.installationId);

    // Validate successful response
    if (responseData.connected !== 1) {
      console.error("Backend returned connected !== 1:", responseData.connected);
      return NextResponse.redirect(
        new URL(
          "/atlassian/error?error=callback_failed&description=Backend did not confirm connection",
          origin,
        ),
      );
    }

    const connected = "1";
    const installationId = responseData.installation_id || "";
    console.log("Extracted values:", { connected, installationId, isEmpty: !installationId });

    // Clear the state cookies
    cookieStore.delete("confluence_oauth_state");
    cookieStore.delete("confluence_oauth_state_sig");
    cookieStore.delete("confluence_oauth_org");

    // Redirect to success page with connection details
    const successUrl = new URL("/atlassian/success", origin);
    successUrl.searchParams.set("connected", connected);
    if (installationId) {
      successUrl.searchParams.set("installationId", installationId);
    }
    console.log("Success URL:", successUrl.toString());
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error("Callback route error:", error);
    return NextResponse.redirect(
      new URL(
        `/atlassian/error?error=server_error&description=${encodeURIComponent(error instanceof Error ? error.message : "An unexpected error occurred")}`,
        origin,
      ),
    );
  }
}

