"use server";

import { cookies } from "next/headers";
import type { Codebase, CodebaseVersion } from "@/types/api";
import { API_BASE } from "@/config/api";
import { getUserIdFromToken } from "@/utils/jwt";

// GraphLang Agent URL
const LANGCHAIN_API_URL =
  process.env.LANGCHAIN_API_URL || "http://localhost:8011";

// In production, default to a secure WebSocket URL on the app domain so we never
// trigger mixed-content errors even if the env var is missing.
const DEFAULT_LANGCHAIN_WS_URL =
  process.env.NODE_ENV === "production"
    ? "wss://app.trybluemagma.com"
    : "ws://localhost:8011";

const LANGCHAIN_WS_URL =
  process.env.LANGCHAIN_WS_URL || DEFAULT_LANGCHAIN_WS_URL;

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

// Get user's codebases with versions
export async function getUserCodebases(): Promise<Codebase[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch codebases: ${response.statusText}`);
    }

    const codebases: Codebase[] = await response.json();
    return codebases;
  } catch (error) {
    console.error("Error fetching codebases:", error);
    throw error;
  }
}

// Get specific codebase version details (including commit hash)
export async function getCodebaseVersion(
  codebaseId: string,
  versionId: string
): Promise<CodebaseVersion | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    // First get the codebase to access its versions
    const response = await fetch(`${API_BASE}/org/${orgId}/codebase/${codebaseId}`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch codebase: ${response.statusText}`);
    }

    const codebase: Codebase = await response.json();
    const version = codebase.versions.find(v => v.object_id === versionId);
    
    return version || null;
  } catch (error) {
    console.error("Error fetching codebase version:", error);
    return null;
  }
}

// Get WebSocket configuration for chat
export async function getWebSocketConfig(): Promise<{
  success: boolean;
  config?: {
    url: string;
    token?: string;
    orgId?: string;
    userId?: string;
  };
  error?: string;
}> {
  try {
    // For GraphLang Agent, we don't need authentication
    // But we'll still try to get user info for potential future use
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const orgId = cookieStore.get("organization_id")?.value;

    let userId: string | null = null;
    if (accessToken) {
      userId = getUserIdFromToken(accessToken);
    }

    return {
      success: true,
      config: {
        url: `${LANGCHAIN_WS_URL}/ws`,
        token: accessToken,
        orgId,
        userId: userId || undefined,
      },
    };
  } catch (error) {
    console.error("Error getting WebSocket config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get WebSocket configuration",
    };
  }
}

export async function getInitializationData(): Promise<{
  success: boolean;
  data?: {
    userId: string;
    orgId: string;
    jwtToken: string;
  };
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token")?.value;
    const orgId = cookieStore.get("organization_id")?.value;

    if (!accessToken) {
      throw new Error("No access token available");
    }

    if (!orgId) {
      throw new Error("No organization ID available");
    }

    const userId = getUserIdFromToken(accessToken);
    if (!userId) {
      throw new Error("Could not extract user ID from token");
    }

    return {
      success: true,
      data: {
        userId,
        orgId,
        jwtToken: accessToken,
      },
    };
  } catch (error) {
    console.error("Error getting initialization data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get initialization data",
    };
  }
}

// Legacy function for backward compatibility - now returns error directing to use WebSocket
export async function chatWithAgent(
  message: string,
  sessionId: string
): Promise<{
  success: boolean;
  response?: string;
  intermediateSteps?: string[];
  creditsUsed?: number;
  memoryDebug?: unknown;
  error?: string;
}> {
  return {
    success: false,
    error: "This function is deprecated. Please use WebSocket connection for chat communication.",
    intermediateSteps: [],
    creditsUsed: 0,
    memoryDebug: null,
  };
}

// Update codebase context in backend memory
export async function updateCodebaseContext(
  sessionId: string,
  context: {
    codebaseId: string;
    codebaseVersionId: string;
    codebaseName: string;
    versionBranch: string;
    versionHash: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const payload = {
      session_id: sessionId,
      action: "update_context",
      context: {
        selected_codebase_id: context.codebaseId,
        selected_codebase_version_id: context.codebaseVersionId,
        selected_codebase_name: context.codebaseName,
        selected_version_branch: context.versionBranch,
        conversation_state: "active",
      },
    };

    const headers = await getAuthHeaders();

    const response = await fetch(`${LANGCHAIN_API_URL}/context`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Context update error: ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating codebase context:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Perform structured analysis
export async function analyzeCodebase(
  codebaseVersionId: string,
  analysisType: string = "comprehensive",
  specificCriteria?: string
): Promise<{
  success: boolean;
  analysisResult?: string;
  findings?: string[];
  error?: string;
}> {
  try {
    const orgId = await getOrganizationId();

    const payload = {
      codebase_version_id: codebaseVersionId,
      org_id: orgId,
      analysis_type: analysisType,
      specific_criteria: specificCriteria,
    };

    const headers = await getAuthHeaders();

    const response = await fetch(`${LANGCHAIN_API_URL}/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`GraphLang API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      success: true,
      analysisResult: data.analysis_result,
      findings: data.findings || [],
    };
  } catch (error) {
    console.error("Error analyzing codebase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Check GraphLang service health
export async function checkGraphLangHealth(): Promise<{
  success: boolean;
  status?: string;
  services?: Record<string, string>;
  error?: string;
}> {
  try {
    const response = await fetch(`${LANGCHAIN_API_URL}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Add caching to prevent excessive calls
      cache: "no-cache",
      next: { revalidate: 30 }, // Cache for 30 seconds
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform LangGraph agent health response to expected format
    const isHealthy = data.status === "healthy";

    return {
      success: isHealthy,
      status: data.status,
      services: {
        graphlang_agent: data.status,
        active_connections: data.active_connections?.toString() || "0",
        timestamp: data.timestamp || new Date().toISOString(),
      },
      error: isHealthy ? undefined : `Service status: ${data.status}`,
    };
  } catch (error) {
    console.error("Error checking GraphLang health:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Service unavailable",
    };
  }
}
