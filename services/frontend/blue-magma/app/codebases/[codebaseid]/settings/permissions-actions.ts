"use server";

import { cookies } from "next/headers";
import { API_BASE } from "@/config/api";

export interface UserPermissions {
  current_role: string;
  hierarchy_level: number;
  can_create_users: boolean;
  can_delete_users: boolean;
  can_assign_any_role: boolean;
  can_assign_below_admin: boolean;
  can_modify_admins: boolean;
  can_modify_owners: boolean;
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

export async function fetchUserPermissions(): Promise<UserPermissions> {
  try {
    const headers = await getAuthHeaders();
    const organizationId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${organizationId}/roles/permissions`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch permissions: ${response.status} ${response.statusText}`,
      );
    }

    const permissions = await response.json();
    return permissions as UserPermissions;
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    throw error;
  }
}
