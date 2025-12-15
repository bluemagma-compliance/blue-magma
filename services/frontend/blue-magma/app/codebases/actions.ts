"use server";

import { revalidatePath } from "next/cache";
import type { Codebase } from "@/types/api";
import { API_BASE } from "@/config/api";
import { getAuthHeaders, getOrganizationId } from "../auth/actions";

// Server action to get codebases
export async function getCodebases(): Promise<Codebase[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase`, {
      headers,
      cache: "no-store", // Ensure fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint doesn't exist yet, return empty array
        return [];
      }
      throw new Error(`Failed to fetch codebases: ${response.status}`);
    }

    const data = await response.json();
    console.log("Fetched codebases:", data);

    // Ensure we always return an array
    if (!Array.isArray(data)) {
      console.warn("API returned non-array data for codebases:", data);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error fetching codebases:", error);
    return [];
  }
}

// Server action to create a new codebase
export async function createCodebase(data: {
  codebase_name: string;
  codebase_repo_url: string;
  codebase_description: string;
  codebase_type: string;
}): Promise<Codebase> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to create codebase: ${response.status} - ${errorData.error || "Unknown error"}`
      );
    }

    const result = await response.json();

    // Revalidate the codebases page to show the new codebase
    revalidatePath("/codebases");

    return result;
  } catch (error) {
    console.error("Error creating codebase:", error);
    throw error;
  }
}

// Server action for form submission (compatible with form actions)
export async function createCodebaseAction(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const repoUrl = formData.get("repoUrl") as string;
    const description = formData.get("description") as string;
    const codebaseType = formData.get("codebaseType") as string;

    if (!codebaseType || codebaseType.trim() === "") {
      throw new Error("Codebase type is required");
    }

    await createCodebase({
      codebase_name: name || "New Codebase",
      codebase_repo_url: repoUrl,
      codebase_description: description || "",
      codebase_type: codebaseType.trim(),
    });

    // Revalidate the codebases page to show the new codebase
    revalidatePath("/codebases");
  } catch (error) {
    console.error("Error creating codebase:", error);
    throw error;
  }
}


// Server action to delete a codebase
export async function deleteCodebase(codebaseId: string): Promise<void> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase/${codebaseId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to delete codebase: ${response.status} - ${errorData.error || "Unknown error"}`
      );
    }

    // Revalidate the codebases page to remove the deleted codebase
    revalidatePath("/codebases");
  } catch (error) {
    console.error("Error deleting codebase:", error);
    throw error;
  }
}
