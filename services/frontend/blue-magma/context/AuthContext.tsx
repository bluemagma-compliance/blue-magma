"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import {
  loginAction,
  logoutAction,
  refreshTokenAction,
  signupAction,
  getAuthStatusAction,
} from "../app/auth/actions";
import { startGitHubLogin } from "../app/auth/github/actions";
import { startGoogleLogin } from "../app/auth/google/actions";
import type { User } from "../types/api";

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  organizationId: string | null;
  // Service layer methods
  loginUser: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; message?: string }>;
  loginWithGitHub: (
    returnUrl?: string,
  ) => Promise<{ success: boolean; oauth_url?: string; error?: string }>;
  loginWithGoogle: (
    returnUrl?: string,
  ) => Promise<{ success: boolean; oauth_url?: string; error?: string }>;
  signupUser: (
    signupData: Record<string, string>,
  ) => Promise<{ success: boolean; message?: string }>;
  logoutUser: () => Promise<void>;
  refreshUserToken: () => Promise<{ success: boolean; message?: string }>;
  checkAuthStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // Ref to store the refresh timer
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check authentication status using server action
  const checkAuthStatus = async () => {
    try {
      const authStatus = await getAuthStatusAction();
      setIsAuthenticated(authStatus.isAuthenticated);
      setOrganizationId(authStatus.organizationId);

      // If authenticated, create a basic user object and schedule token refresh
      if (authStatus.isAuthenticated) {
        const userData: User = {
          id: 0,
          object_id: "current-user",
          name: "",
          surname: "",
          username: "",
          phone: "",
          email: "",
          role: "",
          is_owner: false,
          organization_id: 0,
          verified: false,
          created_at: "",
          updated_at: "",
        };
        setUser(userData);

        // Schedule automatic token refresh if we have expiry info
        if (authStatus.tokenExpiresIn && authStatus.tokenExpiresIn > 0) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `Token expires in ${authStatus.tokenExpiresIn} seconds, scheduling refresh`,
            );
          }
          scheduleTokenRefresh(authStatus.tokenExpiresIn);
        } else if (process.env.NODE_ENV === "development") {
          console.log(
            "No token expiry info available or token already expired",
          );
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
      setIsAuthenticated(false);
      setUser(null);
      setOrganizationId(null);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await checkAuthStatus();
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Function to schedule automatic token refresh
  const scheduleTokenRefresh = (expiresIn: number) => {
    // Clear any existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Schedule refresh 5 minutes before expiry (or halfway through if token expires in less than 10 minutes)
    const refreshBuffer = Math.min(5 * 60, expiresIn / 2); // 5 minutes or half the expiry time
    const refreshTime = (expiresIn - refreshBuffer) * 1000; // Convert to milliseconds

    if (process.env.NODE_ENV === "development") {
      console.log(
        `Scheduling token refresh in ${refreshTime / 1000} seconds (${refreshTime / 60000} minutes)`,
      );
    }

    refreshTimerRef.current = setTimeout(async () => {
      if (process.env.NODE_ENV === "development") {
        console.log("Automatic token refresh triggered");
      }
      try {
        const result = await refreshUserToken();
        if (!result.success) {
          console.error("Automatic token refresh failed:", result.message);
          // If refresh fails, user will be logged out by refreshUserToken
        }
      } catch (error) {
        console.error("Automatic token refresh error:", error);
      }
    }, refreshTime);
  };

  // Local logout function (clears client state)
  const logout = () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    setIsAuthenticated(false);
    setUser(null);
    setOrganizationId(null);
  };

  // Service layer methods that use server actions
  const loginUser = async (email: string, password: string) => {
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);

      const result = await loginAction(formData);

      if (result.success) {
        // Refresh auth status after successful login
        await checkAuthStatus();

        // Schedule automatic token refresh if expires_in is available
        if (result.expires_in) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `Login successful, token expires in ${result.expires_in} seconds`,
            );
          }
          scheduleTokenRefresh(result.expires_in);
        }

        return { success: true };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: "An unexpected error occurred. Please try again.",
      };
    }
  };

  const signupUser = async (signupData: Record<string, string>) => {
    try {
      const formData = new FormData();
      Object.keys(signupData).forEach((key) => {
        formData.append(key, signupData[key]);
      });

      const result = await signupAction(formData);

      if (result.success) {
        // Refresh auth status after successful signup
        await checkAuthStatus();

        // Schedule automatic token refresh if expires_in is available
        if (result.expires_in) {
          scheduleTokenRefresh(result.expires_in);
        }

        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error("Signup error:", error);
      return {
        success: false,
        message: "An unexpected error occurred. Please try again.",
      };
    }
  };

  const logoutUser = async () => {
    try {
      // Clear local state first
      logout();
      // Call server action
      await logoutAction();
    } catch (error) {
      console.error("Logout error:", error);
      // Even if server action fails, we've cleared local state
    }
  };

  const refreshUserToken = async () => {
    try {
      const result = await refreshTokenAction();

      if (result.success) {
        // Refresh auth status after successful token refresh
        await checkAuthStatus();

        // Schedule the next automatic token refresh if expires_in is available
        if (result.expires_in) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `Token refresh successful, new token expires in ${result.expires_in} seconds`,
            );
          }
          scheduleTokenRefresh(result.expires_in);
        }

        return { success: true };
      } else {
        // Refresh failed, clear everything
        logout();
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error("Token refresh error:", error);
      logout();
      return { success: false, message: "Token refresh failed" };
    }
  };

  // GitHub login method
  const loginWithGitHub = async (returnUrl: string = "/dashboard") => {
    try {
      return await startGitHubLogin(returnUrl);
    } catch (error) {
      console.error("GitHub login error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      };
    }
  };

  // Google login method
  const loginWithGoogle = async (returnUrl: string = "/dashboard") => {
    try {
      return await startGoogleLogin(returnUrl);
    } catch (error) {
      console.error("Google login error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        organizationId,
        // Service layer methods
        loginUser,
        loginWithGitHub,
        loginWithGoogle,
        signupUser,
        logoutUser,
        refreshUserToken,
        checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
