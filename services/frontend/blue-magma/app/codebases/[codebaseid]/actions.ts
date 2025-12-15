"use server";

import type { Codebase, CodebaseSourceType } from "@/types/api";
import { API_BASE } from "@/config/api";
import { getAuthHeaders, getOrganizationId } from "@/app/auth/actions";

// Server action to get a specific codebase by ID
export async function getCodebaseById(
  codebaseId: string,
  codebaseType: CodebaseSourceType
): Promise<Codebase | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const url = new URL(`${API_BASE}/org/${orgId}/codebase/${codebaseId}`);
    url.searchParams.append("type", codebaseType);

    const response = await fetch(url.toString(), {
      headers,
      cache: "no-store", // Ensure fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Codebase not found
        return null;
      }
      throw new Error(`Failed to fetch codebase: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching codebase:", error);
    return null;
  }
}

// Server action to ask the seeker agent a question
export async function askSeekerAgent(
  codebaseVersionId: string,
  question: string
): Promise<{ answer: string } | { error: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    try {
      const response = await fetch(
        `${API_BASE}/org/${orgId}/rpc/ask-seeker-agent/`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            codebase_version_id: codebaseVersionId,
            question: question,
          }),
          cache: "no-store",
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Seeker agent API error:", response.status, errorText);
        return { error: `Failed to get response from AI: ${response.status}` };
      }

      const data = await response.json();
      // Extract only the summary from the response
      return { answer: data.summary || "No summary available" };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle timeout specifically
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("Seeker agent request timed out");
        return {
          error:
            "Request timed out. The AI is taking longer than expected to respond. Please try again with a shorter question.",
        };
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("Error calling seeker agent:", error);
    return { error: "Failed to connect to AI service" };
  }
}
