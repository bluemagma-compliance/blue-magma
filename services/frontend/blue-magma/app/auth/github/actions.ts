"use server";

import { cookies } from "next/headers";
import { API_BASE } from "@/config/api";
import { getAppBaseUrl } from "@/config/base-url";
import type {
  GitHubOAuthStartRequest,
  GitHubOAuthStartResponse,
  GitHubLinkRequest,
  GitHubLinkResponse,
} from "@/types/github-auth";

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
 * Start GitHub OAuth login flow
 */
export async function startGitHubLogin(
  returnUrl: string = "/dashboard",
): Promise<{
  success: boolean;
  oauth_url?: string;
  state?: string;
  error?: string;
	}> {
	  try {
	    const response = await fetch(`${API_BASE}/auth/github/start`, {
	      method: "POST",
	      headers: {
	        "Content-Type": "application/json",
	      },
	      body: JSON.stringify({
	        action: "login",
	        return_url: returnUrl,
	      } as GitHubOAuthStartRequest),
	    });

	    if (!response.ok) {
	      const errorData = await response.json().catch(() => ({}));
	      return {
	        success: false,
	        error: errorData.error || "Failed to start GitHub login",
	      };
	    }

	    const data: GitHubOAuthStartResponse = await response.json();
	    return {
	      success: true,
	      oauth_url: data.oauth_url,
	      state: data.state,
	    };
	  } catch (error) {
	    console.error("Start GitHub login error:", error);
	    return {
	      success: false,
	      error: "An unexpected error occurred",
	    };
	  }
	}

/**
 * Link GitHub account to existing user (authenticated)
 */
export async function linkGitHubAccount(
  returnUrl: string = "/settings",
): Promise<{
  success: boolean;
  oauth_url?: string;
  state?: string;
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/auth/github/link`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        return_url: returnUrl,
      } as GitHubLinkRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || "Failed to start GitHub account linking",
      };
    }

    const data: GitHubLinkResponse = await response.json();
    return {
      success: true,
      oauth_url: data.oauth_url,
      state: data.state,
    };
  } catch (error) {
    console.error("Link GitHub account error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
