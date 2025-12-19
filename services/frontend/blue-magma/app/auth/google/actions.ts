"use server";

import { cookies } from "next/headers";
import { API_BASE } from "@/config/api";
import { getAppBaseUrl } from "@/config/base-url";
import type {
  GoogleOAuthStartRequest,
  GoogleOAuthStartResponse,
  GoogleLinkRequest,
  GoogleLinkResponse,
} from "@/types/google-auth";

// Helper function to get auth headers for authenticated requests
async function getAuthHeaders() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    throw new Error("No access token available");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/**
 * Start Google OAuth login flow
 */
export async function startGoogleLogin(
  returnUrl: string = "/dashboard",
): Promise<{
  success: boolean;
  oauth_url?: string;
  state?: string;
  error?: string;
	}> {
	  try {
	    const response = await fetch(`${API_BASE}/auth/google/start`, {
	      method: "POST",
	      headers: {
	        "Content-Type": "application/json",
	      },
	      body: JSON.stringify({
	        action: "login",
	        return_url: returnUrl,
	      } as GoogleOAuthStartRequest),
	    });

	    if (!response.ok) {
	      const errorData = await response.json().catch(() => ({}));
	      return {
	        success: false,
	        error: errorData.error || "Failed to start Google login",
	      };
	    }

	    const data: GoogleOAuthStartResponse = await response.json();
	    return {
	      success: true,
	      oauth_url: data.oauth_url,
	      state: data.state,
	    };
	  } catch (error) {
	    console.error("Google OAuth start error:", error);
	    return {
	      success: false,
	      error:
	        error instanceof Error ? error.message : "An unexpected error occurred",
	    };
	  }
	}

/**
 * Link Google account to existing user (authenticated)
 */
export async function linkGoogleAccount(
  returnUrl: string = "/settings",
): Promise<{
  success: boolean;
  oauth_url?: string;
  state?: string;
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/auth/google/link`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        return_url: returnUrl,
        action: "link",
      } as GoogleLinkRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || "Failed to start Google account linking",
      };
    }

    const data: GoogleLinkResponse = await response.json();
    return {
      success: true,
      oauth_url: data.oauth_url,
      state: data.state,
    };
  } catch (error) {
    console.error("Google OAuth link error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
