"use server";

import { API_CONFIG } from "@/config/api";

export async function validateInvitationAction(token: string) {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.VALIDATE_INVITATION(token)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return {
        valid: false,
        message: `Failed to validate invitation: ${res.status} ${res.statusText}`,
      };
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error validating invitation:", error);
    return {
      valid: false,
      message: "Failed to validate invitation. Please try again.",
    };
  }
}

export async function acceptInvitationAction(formData: FormData) {
  try {
    const acceptData = {
      token: formData.get("token") as string,
      first_name: formData.get("firstName") as string,
      last_name: formData.get("lastName") as string,
      password: formData.get("password") as string,
      phone: (formData.get("phone") as string) || undefined,
    };

    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.ACCEPT_INVITATION}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(acceptData),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        message:
          errorData.message ||
          `Failed to accept invitation: ${res.status} ${res.statusText}`,
      };
    }

    const result = await res.json();

    if (result.success) {
      return {
        success: true,
        message: result.message || "Account created successfully!",
      };
    } else {
      return {
        success: false,
        message: result.message || "Failed to accept invitation",
      };
    }
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
