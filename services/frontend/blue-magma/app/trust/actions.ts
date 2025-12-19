"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { API_BASE } from "@/config/api";

export interface CommitmentFrameworkMapping {
	  framework: string;
	  external_ids: string[];
	}

export interface CommitmentControlResponse {
  title: string;
  description: string;
  status: string;
  frameworks: string[];
  scf_id?: string;
  framework_mappings?: CommitmentFrameworkMapping[];
}

export interface CommitmentProjectResponse {
  object_id: string;
  name: string;
  status: string;
  frameworks: string[];
  controls: CommitmentControlResponse[];
}

export interface CommitmentOrganizationResponse {
  object_id: string;
  organization_name?: string;
  name?: string;
  share_commitment: boolean;
}

export interface CommitmentResponse {
  organization: CommitmentOrganizationResponse;
  projects: CommitmentProjectResponse[];
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

export async function getCommitmentPreview(): Promise<CommitmentResponse | null> {
  try {
    const organizationId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${organizationId}/commitment/preview`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        // If the endpoint is not available or no data yet, treat as empty preview
        return null;
      }

      throw new Error(
        `Failed to fetch commitment preview: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as CommitmentResponse;

    // Normalise projects to always be an array
    return {
      ...data,
      projects: Array.isArray(data.projects) ? data.projects : [],
    };
  } catch (error) {
    console.error("Error fetching commitment preview:", error);
    return null;
  }
}

// Fetch the public Trust Center commitment for a given organization.
// This uses the unauthenticated public endpoint and only returns data
// when the organization exists and has enabled the shareable link.
export async function getPublicCommitment(
  orgId: string,
): Promise<CommitmentResponse | null> {
  try {
    if (!orgId) return null;

    const params = new URLSearchParams({ org_id: orgId });

    const response = await fetch(
      `${API_BASE}/public/commitment?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }

      console.error(
        `Failed to fetch public commitment: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = (await response.json()) as CommitmentResponse;

    // If for any reason the backend returns data but sharing is disabled,
    // treat it as not found so the public page shows a 404.
    if (!data.organization || !data.organization.share_commitment) {
      return null;
    }

    return {
      ...data,
      projects: Array.isArray(data.projects) ? data.projects : [],
    };
  } catch (error) {
    console.error("Error fetching public commitment:", error);
    return null;
  }
}

export async function updateShareCommitment(
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const organizationId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${organizationId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ share_commitment: enabled }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          (errorData as { error?: string }).error ||
          `Failed to update share commitment: ${response.status} ${response.statusText}`,
      };
    }

    // Revalidate the Trust Center page so subsequent loads see fresh data
    revalidatePath("/trust");

    return { success: true };
  } catch (error) {
    console.error("Error updating share commitment:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
