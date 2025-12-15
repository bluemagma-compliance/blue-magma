"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { API_BASE } from "@/config/api";
import { logoutAction } from "@/app/auth/actions";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Organization {
  id: string;
  name: string;
}

// Helper function to get auth headers
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

// Helper function to get organization ID
async function getOrganizationId(): Promise<string> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("organization_id")?.value;

  if (!orgId) {
    throw new Error("No organization ID available");
  }

  return orgId;
}

// Fetch organization details from organization endpoint
export async function fetchOrganization(): Promise<Organization> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${organizationId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch organization data: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();

    // Map backend organization response to minimal frontend shape
    return {
      id: data.object_id || organizationId,
      name: data.organization_name || "Organization", // Fallback name
    };
  } catch (error) {
    console.error("Error fetching organization:", error);
    // Return fallback organization data instead of throwing
    const organizationId = await getOrganizationId();
    return {
      id: organizationId,
      name: "Organization",
    };
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Fetch current authenticated user
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE}/users/me`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch current user: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  return {
    id: data.user_id ?? data.id ?? "",
    email: data.email,
    name: data.name,
    role: data.role,
  };
}


// Fetch users in organization
export async function fetchUsers(): Promise<User[]> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${organizationId}/users`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch users: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const users = data.users || data; // Handle different response formats

    return users.map(
      (user: {
        object_id?: string;
        id?: string;
        username?: string;
        name?: string;
        first_name?: string;
        last_name?: string;
        email: string;
        role?: string;
      }) => ({
        id: user.object_id || user.id,
        name:
          user.username ||
          user.name ||
          `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
          "Unknown User",
        email: user.email,
        role: user.role || "user",
      }),
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

// Invite a new user
export async function inviteUser(email: string, role: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${organizationId}/users/invite`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          role,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error ||
          `Failed to invite user: ${response.status} ${response.statusText}`,
      );
    }

    revalidatePath("/settings");
  } catch (error) {
    console.error("Error inviting user:", error);
    throw error;
  }
}

// Change user role
export async function changeUserRole(
  userId: string,
  newRole: string,
): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${organizationId}/users/${userId}/role`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          role: newRole,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error ||
          `Failed to change user role: ${response.status} ${response.statusText}`,
      );
    }

    revalidatePath("/settings");
  } catch (error) {
    console.error("Error changing user role:", error);
    throw error;
  }
}

// Update organization name (owner only, enforced by backend)
export async function updateOrganizationName(name: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${organizationId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        organization_name: name,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as { error?: string }).error ||
          `Failed to update organization name: ${response.status} ${response.statusText}`,
      );
    }

    // Refresh settings page data
    revalidatePath("/settings");
  } catch (error) {
    console.error("Error updating organization name:", error);
    throw error;
  }
}

// Delete current user (remove from organization)
export async function deleteCurrentUser(): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    // Get current user ID from auth context
    const cookieStore = await cookies();
    const userObjectId = cookieStore.get("user_id")?.value;

    if (!userObjectId) {
      throw new Error("User ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${organizationId}/users/${userObjectId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error ||
          `Failed to delete user: ${response.status} ${response.statusText}`,
      );
    }

    revalidatePath("/settings");
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

// Delete organization and log out the current user
export async function deleteOrganizationAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${organizationId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          (errorData as { error?: string }).error ||
          `Failed to delete organization: ${response.status} ${response.statusText}`,
      };
    }
  } catch (error) {
    console.error("Error deleting organization:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // If we reach here, the organization was deleted successfully.
  // Log the user out, which will revoke the refresh token, clear cookies, and redirect to /login.
  await logoutAction();

  // This line is never reached because redirect() throws, but is kept for typing completeness.
  return { success: true };
}

