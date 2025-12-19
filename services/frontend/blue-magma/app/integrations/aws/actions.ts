"use server";

import { getAuthHeaders, getOrganizationId } from "@/app/auth/actions";
import { API_BASE } from "@/config/api";

// AWS Integration Types
export interface AWSInstallation {
  org_id: string;
  external_id: string;
  sync_time: string | null;
}

export interface InstallSessionResponse {
  install_url: string;
}

// Start AWS App installation flow
export async function startAWSInstallation(): Promise<InstallSessionResponse> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${orgId}/aws/installations`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("Error data:", errorData, response.status);
      throw new Error(
        errorData || `HTTP ${response.status}: Failed to start AWS installation`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error starting AWS installation:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to start AWS installation"
    );
  }
}

export async function saveRoleArn(arn: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${orgId}/aws/installations`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ arn }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: Failed to save Role ARN`
      );
    }
  } catch (error) {
    console.error("Error saving Role ARN:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to save Role ARN"
    );
  }
}

export async function deleteAwsInstallation(): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${orgId}/aws/installations`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `HTTP ${response.status}: Failed to delete AWS installation`
      );
    }
  } catch (error) {
    console.error("Error deleting AWS installation:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to delete AWS installation"
    );
  }
}

// Get AWS installations for the organization
export async function getAWSInstallation(): Promise<AWSInstallation | null> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${orgId}/aws/installations`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `HTTP ${response.status}: Failed to fetch AWS installations`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching AWS installations:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch AWS installations"
    );
  }
}

export async function syncAwsInstallation(): Promise<AWSInstallation> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${orgId}/aws/data/sync`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `HTTP ${response.status}: Failed to sync AWS installation`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error syncing AWS installation:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to sync AWS installation"
    );
  }
}
