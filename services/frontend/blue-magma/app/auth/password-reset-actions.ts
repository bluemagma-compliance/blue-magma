"use server";

import { AUTH_BASE } from "@/config/api";

type BasicResult = {
  success: boolean;
  message?: string;
};

type ValidateResult = {
  valid: boolean;
  message?: string;
};

export async function requestPasswordReset(
  email: string,
): Promise<BasicResult> {
  try {
    const res = await fetch(`${AUTH_BASE}/password-reset/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      return {
        success: false,
        message: "Unable to request password reset.",
      };
    }

    const data = await res.json().catch(() => ({}));

    if (data && data.success === false) {
      return {
        success: false,
        message: data.message || "Unable to request password reset.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("requestPasswordReset error:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

export async function validateResetToken(
  token: string,
): Promise<ValidateResult> {
  if (!token) {
    return { valid: false, message: "Missing reset token." };
  }

  try {
    const res = await fetch(
      `${AUTH_BASE}/password-reset/validate?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
      },
    );

    if (!res.ok) {
      return {
        valid: false,
        message: "Invalid or expired reset link.",
      };
    }

    const data = await res.json();
    return {
      valid: !!data.valid,
      message: data.message,
    };
  } catch (error) {
    console.error("validateResetToken error:", error);
    return {
      valid: false,
      message: "Unable to validate reset link.",
    };
  }
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<BasicResult> {
  try {
    const res = await fetch(`${AUTH_BASE}/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || (data && data.success === false)) {
      const message =
        data?.error ||
        data?.message ||
        data?.error_description ||
        "Unable to reset password.";
      return { success: false, message };
    }

    return { success: true };
  } catch (error) {
    console.error("confirmPasswordReset error:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

