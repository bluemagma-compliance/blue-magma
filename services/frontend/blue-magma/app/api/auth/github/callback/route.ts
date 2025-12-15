import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE } from "@/config/api";
import { getAppBaseUrl } from "@/config/base-url";
import type {
  GitHubOAuthExchangeRequest,
  GitHubOAuthExchangeResponse,
} from "@/types/github-auth";

export async function GET(request: NextRequest) {
	  const baseUrl = getAppBaseUrl();

	  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Handle OAuth errors (user cancelled, etc.)
    if (error) {
      console.log("GitHub OAuth error:", error, errorDescription);
      const errorMessage =
        error === "access_denied"
          ? "GitHub login was cancelled"
          : `GitHub OAuth error: ${error}`;

	      return NextResponse.redirect(
	        new URL(
	          `/login?error=${encodeURIComponent(errorMessage)}`,
	          baseUrl,
	        ),
	      );
    }

    // Validate required parameters
	    if (!code || !state) {
	      return NextResponse.redirect(
	        new URL("/login?error=Invalid OAuth callback parameters", baseUrl),
	      );
	    }

    // Exchange code for tokens with backend
    const exchangeResponse = await fetch(`${API_BASE}/auth/github/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        state,
      } as GitHubOAuthExchangeRequest),
    });

	    if (!exchangeResponse.ok) {
      const errorData = await exchangeResponse.json().catch(() => ({}));
      console.error("GitHub OAuth exchange failed:", errorData);

      // Handle specific error cases
      let errorMessage = "GitHub login failed";
      if (exchangeResponse.status === 400) {
        errorMessage = errorData.error || "Invalid OAuth state or code";
      } else if (exchangeResponse.status === 401) {
        errorMessage = "OAuth session expired. Please try again.";
      }

	      return NextResponse.redirect(
	        new URL(
	          `/login?error=${encodeURIComponent(errorMessage)}`,
	          baseUrl,
	        ),
	      );
    }

    const data: GitHubOAuthExchangeResponse = await exchangeResponse.json();

	    if (!data.success) {
	      return NextResponse.redirect(
	        new URL(
	          `/login?error=${encodeURIComponent(data.error || "GitHub login failed")}`,
	          baseUrl,
	        ),
	      );
	    }

    // Set httpOnly cookies (same pattern as existing auth)
    const cookieStore = await cookies();

    // Set access token
    cookieStore.set("access_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: data.expires_in || 60 * 60, // 1 hour default
      path: "/",
    });

    // Set refresh token
    cookieStore.set("refresh_token", data.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Set organization ID if available
	    if (data.organization_id) {
      cookieStore.set("organization_id", data.organization_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });
	    }

	    // Redirect to dashboard on successful login
	    return NextResponse.redirect(new URL("/dashboard", baseUrl));
	  } catch (error) {
	    console.error("GitHub OAuth callback error:", error);
	    return NextResponse.redirect(
	      new URL(
	        "/login?error=An unexpected error occurred during GitHub login",
	        baseUrl,
	      ),
	    );
	  }
	}
