"use server";

import { cookies } from "next/headers";
import { API_BASE } from "@/config/api";
import type { DataSourcesResponse } from "./types";
import type { Codebase } from "@/types/api";
import {
  getCodebases as getCodebasesBase,
  createCodebase as createCodebaseBase,
} from "../codebases/actions";
import { deleteCodebase as deleteCodebaseBase } from "../dashboard/actions";


// Helper function to get auth headers
async function getAuthHeaders() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    throw new Error("No access token found");
  }

  return {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

// Helper function to get organization ID
async function getOrganizationId(): Promise<string> {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("organization_id")?.value;

  if (!orgId) {
    throw new Error("No organization ID found");
  }

  return orgId;
}

// Get all data sources from unified endpoint
export async function getDataSources(): Promise<DataSourcesResponse> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(`${API_BASE}/org/${orgId}/data-sources`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch data sources`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching data sources:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch data sources"
    );
  }
}



// Codebase actions for knowledge base components (wrapping existing server actions)
export async function getCodebases(): Promise<Codebase[]> {
  return getCodebasesBase();
}

export async function createCodebase(data: {
  codebase_name: string;
  codebase_repo_url: string;
  codebase_description: string;
  codebase_type: string;
}): Promise<Codebase> {
  return createCodebaseBase(data);
}

export async function deleteCodebase(codebaseId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return deleteCodebaseBase(codebaseId);
}
