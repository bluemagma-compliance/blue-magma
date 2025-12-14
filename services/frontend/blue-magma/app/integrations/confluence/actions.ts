"use server";

import { cookies } from "next/headers";
import crypto from "crypto";
import { API_BASE } from "@/config/api";

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

// Generate a cryptographically secure state token
function generateStateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Generate HMAC signature for state cookie (for integrity verification)
function generateStateSignature(state: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(state).digest("hex");
}

// Generate OAuth URL for Atlassian
export async function getConfluenceOAuthUrl(): Promise<string> {
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const redirectUri = process.env.ATLASSIAN_REDIRECT_URI;
  const stateSecret = process.env.CONFLUENCE_STATE_SECRET || "default-secret";

  if (!clientId || !redirectUri) {
    throw new Error("Missing Atlassian OAuth configuration");
  }

  // Generate cryptographically secure CSRF state token
  const state = generateStateToken();
  const signature = generateStateSignature(state, stateSecret);

  // Get organization ID for server-side validation
  const orgId = await getOrganizationId();

  // Store state + signature in signed cookie for validation on callback
  // The signature ensures the state hasn't been tampered with
  const cookieStore = await cookies();
  cookieStore.set("confluence_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  cookieStore.set("confluence_oauth_state_sig", signature, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  // Store org_id in cookie for reference (will be validated against Redis on callback)
  cookieStore.set("confluence_oauth_org", orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: "read:confluence-content.all read:confluence-props.all read:confluence-user read:confluence-space.summary read:space-details:confluence read:space:confluence read:page:confluence offline_access",
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

// Get Confluence integration status
export async function getConfluenceIntegration(): Promise<{
  connected: boolean;
  installationId?: string;
}> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/confluence/${orgId}`,
      {
        method: "GET",
        headers,
      },
    );

    if (response.status === 404) {
      return { connected: false };
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch integration: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      connected: data.connected === 1,
      installationId: data.installation_id,
    };
  } catch (error) {
    console.error("Error fetching Confluence integration:", error);
    return { connected: false };
  }
}

// Get Confluence integration with spaces and pages
export async function getConfluenceIntegrationWithSpaces(): Promise<{
  connected: boolean;
  installationId?: string;
  spaces?: Array<{
    space_key: string;
    space_name: string;
    space_type: string;
    page_count: number;
    pages: Array<{
      id: string;
      page_title: string;
      space_key: string;
      space_name: string;
      version_number: number;
      version_created_at: string;
      ingested: boolean;
    }>;
  }>;
}> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/confluence/${orgId}`,
      {
        method: "GET",
        headers,
      },
    );

    if (response.status === 404) {
      return { connected: false };
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch integration: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      connected: data.connected === 1,
      installationId: data.installation_id,
      spaces: data.spaces || [],
    };
  } catch (error) {
    console.error("Error fetching Confluence integration with spaces:", error);
    return { connected: false };
  }
}

// Ingest selected Confluence spaces
export async function ingestConfluenceSpaces(spaceKeys: string[]): Promise<{
  message: string;
}> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/confluence/${orgId}/ingest`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          spaces: spaceKeys,
          format: "json",
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to ingest spaces: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return { message: data.message || "Documentation ingestion started" };
  } catch (error) {
    console.error("Error ingesting Confluence spaces:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to ingest spaces",
    );
  }
}

// Placeholder: Force sync Confluence documentation
export async function forceConfluenceSync(): Promise<{ message: string }> {
  try {
    // TODO: Implement actual sync logic when confluence-integration service is ready
    // This will call: POST /integrations/confluence/force-sync
    console.log("Force sync placeholder - to be implemented");
    return { message: "Sync initiated (placeholder)" };
  } catch (error) {
    console.error("Error triggering force sync:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to trigger sync",
    );
  }
}

// Delete Confluence integration
export async function deleteConfluenceIntegration(): Promise<{
  message: string;
}> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/confluence/${orgId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (response.status === 404) {
      throw new Error("No integration found for this organization");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to delete integration: ${response.statusText}`,
      );
    }

    const data = await response.json();
    return { message: data.message || "Integration deleted successfully" };
  } catch (error) {
    console.error("Error deleting Confluence integration:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to delete integration",
    );
  }
}

