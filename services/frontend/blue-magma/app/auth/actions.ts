"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_BASE } from "@/config/api";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
  organization_id?: string;
}

interface TokenError {
  error: string;
  error_description?: string;
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "password",
        username: email,
        password: password,
        refresh_token: null,
      }),
    });

    const result = await res.json();

    if (result.access_token && result.refresh_token) {
      // Set httpOnly cookies for authentication (secure, not accessible by client JS)
      const cookieStore = await cookies();
      cookieStore.set("access_token", result.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Enhanced CSRF protection
        maxAge: 60 * 120, // 120 minutes (2 hours) - matches backend AccessTokenExpiry
        path: "/", // Explicit path
      });
      cookieStore.set("refresh_token", result.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Enhanced CSRF protection
        maxAge: 60 * 60 * 24 * 7, // 7 days - matches backend RefreshTokenExpiry
        path: "/", // Explicit path
      });

      // Store organization ID if available
      if (result.organization_id) {
        cookieStore.set("organization_id", result.organization_id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict", // Enhanced CSRF protection
          maxAge: 60 * 60 * 24 * 7, // 7 days - matches backend RefreshTokenExpiry
          path: "/", // Explicit path
        });
      }

      return {
        success: true,
        message: "Login successful!",
        expires_in: result.expires_in,
        organization_id: result.organization_id,
      };
    }

    return {
      success: false,
      message: result.error_description || result.error || "Login failed",
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token");

  // Try to revoke the token on the server
  if (refreshToken?.value) {
    try {
      await fetch(`${AUTH_BASE}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken.value }),
      });
    } catch (error) {
      console.error("Failed to revoke token:", error);
      // Continue with logout even if revoke fails
    }
  }

  // Clear cookies
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  cookieStore.delete("organization_id");

  // Redirect outside of try-catch to avoid catching NEXT_REDIRECT error
  redirect("/login");
}

export async function refreshTokenAction() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token");

    if (!refreshToken?.value) {
      return { success: false, message: "No refresh token available" };
    }

    const res = await fetch(`${AUTH_BASE}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        username: null,
        password: null,
        refresh_token: refreshToken.value,
      }),
    });

    const result = await res.json();

    if (result.access_token && result.refresh_token) {
      // Update httpOnly cookies with new tokens
      cookieStore.set("access_token", result.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Enhanced CSRF protection
        maxAge: 60 * 120, // 120 minutes (2 hours) - matches backend AccessTokenExpiry
        path: "/", // Explicit path
      });
      cookieStore.set("refresh_token", result.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Enhanced CSRF protection
        maxAge: 60 * 60 * 24 * 7, // 7 days - matches backend RefreshTokenExpiry
        path: "/", // Explicit path
      });

      // Store organization ID if available
      if (result.organization_id) {
        cookieStore.set("organization_id", result.organization_id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict", // Enhanced CSRF protection
          maxAge: 60 * 60 * 24 * 7, // 7 days - matches backend RefreshTokenExpiry
          path: "/", // Explicit path
        });
      }

      return {
        success: true,
        expires_in: result.expires_in,
        organization_id: result.organization_id,
      };
    }

    return {
      success: false,
      message:
        result.error_description || result.error || "Token refresh failed",
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during token refresh.",
    };
  }
}

export async function getAuthStatusAction() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const refreshToken = cookieStore.get("refresh_token")?.value;
    const organizationId = cookieStore.get("organization_id")?.value;

    // If we have an access token, try to decode it to get expiry info
    let tokenExpiresIn = null;
    if (accessToken) {
      try {
        // Decode JWT to get expiry time (exp is in seconds since epoch)
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        tokenExpiresIn = payload.exp - currentTime;

        // If access token is expired but we have a refresh token, try to refresh
        if (tokenExpiresIn <= 0 && refreshToken) {
          const refreshResult = await refreshTokenAction();
          if (refreshResult.success) {
            // Refresh succeeded, return authenticated status
            return {
              isAuthenticated: true,
              hasRefreshToken: true,
              organizationId: refreshResult.organization_id || organizationId,
              tokenExpiresIn: refreshResult.expires_in,
            };
          } else {
            // Refresh failed, user needs to login again
            return {
              isAuthenticated: false,
              hasRefreshToken: false,
              organizationId: null,
              tokenExpiresIn: null,
            };
          }
        }
      } catch (error) {
        console.error("Failed to decode access token:", error);
      }
    }

    return {
      isAuthenticated: !!accessToken,
      hasRefreshToken: !!refreshToken,
      organizationId: organizationId || null,
      tokenExpiresIn: tokenExpiresIn,
    };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return {
      isAuthenticated: false,
      hasRefreshToken: false,
      organizationId: null,
      tokenExpiresIn: null,
    };
  }
}

export async function signupAction(formData: FormData) {
  const signupData = {
    first_name: formData.get("firstName") as string,
    last_name: formData.get("lastName") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    phone: formData.get("phone") as string,
  };

  try {
    const res = await fetch(`${AUTH_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    });

    const result = await res.json();

    if (result.access_token && result.refresh_token) {
      // Set httpOnly cookies for authentication (secure, not accessible by client JS)
      const cookieStore = await cookies();
      cookieStore.set("access_token", result.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Enhanced CSRF protection
        maxAge: 60 * 120, // 120 minutes (2 hours) - matches backend AccessTokenExpiry
        path: "/", // Explicit path
      });
      cookieStore.set("refresh_token", result.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Enhanced CSRF protection
        maxAge: 60 * 60 * 24 * 7, // 7 days - matches backend RefreshTokenExpiry
        path: "/", // Explicit path
      });

      // Store organization ID if available
      if (result.organization_id) {
        cookieStore.set("organization_id", result.organization_id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict", // Enhanced CSRF protection
          maxAge: 60 * 60 * 24 * 7, // 7 days - matches backend RefreshTokenExpiry
          path: "/", // Explicit path
        });
      }

      return {
        success: true,
        message: "Account created successfully!",
        expires_in: result.expires_in,
        organization_id: result.organization_id,
      };
    }

    return {
      success: false,
      message: result.message || "Signup failed",
    };
  } catch (error) {
    console.error("Signup error:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

export async function getOrganizationId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const organizationId = cookieStore.get("organization_id")?.value;
    return organizationId || null;
  } catch (error) {
    console.error("Error getting organization ID:", error);
    return null;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;

    if (!accessToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  } catch (error) {
    console.error("Error getting auth headers:", error);
    return {};
  }
}
