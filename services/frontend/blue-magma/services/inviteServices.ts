import { API_CONFIG } from "../config/api";

export type AcceptInvitationData = {
  token: string;
  first_name: string;
  last_name: string;
  password: string;
  phone?: string;
};

export type ValidateInvitationResponse = {
  valid: boolean;
  email?: string;
  organization_name?: string;
  role?: string;
  inviter_name?: string;
  expires_at?: string;
  message?: string;
};

export type AcceptInvitationResponse = {
  success: boolean;
  message?: string;
  user_id?: string;
};

export type SendInvitationData = {
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
};

export type SendInvitationResponse = {
  success: boolean;
  message?: string;
  user_id?: string;
};

export async function validateInvitation(
  token: string,
): Promise<ValidateInvitationResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.VALIDATE_INVITATION(token)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      mode: "cors",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error validating invitation:", error);
    throw error;
  }
}

export async function acceptInvitation(
  data: AcceptInvitationData,
): Promise<AcceptInvitationResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.ACCEPT_INVITATION}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      mode: "cors",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const result = await res.json();
    return result;
  } catch (error) {
    console.error("Error accepting invitation:", error);
    throw error;
  }
}

export async function sendInvitation(
  organizationId: string,
  data: SendInvitationData,
  accessToken: string,
): Promise<SendInvitationResponse> {
  try {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.API.SEND_INVITATION(organizationId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const result = await res.json();
    return result;
  } catch (error) {
    console.error("Error sending invitation:", error);
    throw error;
  }
}
