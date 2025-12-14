"use server";

import type { Codebase } from "@/types/api";
import { createCodebase } from "@/app/codebases/actions";
import { getAuthHeaders, getOrganizationId } from "@/app/auth/actions";
import { API_BASE } from "@/config/api";

// GitHub Integration Types
export interface GitHubInstallation {
  // Core installation fields from GitHub integration service
  id: number;
  installation_id?: number;
  org_id: string;
  account_id: string;
  account_login?: string;
  account_type?: string;
  repository_selection: "selected" | "all";
  access_tokens_url: string;
  repositories_url: string;
  html_url: string;
  app_id: number;
  app_slug: string;
  target_id: number;
  target_type: string;
  permissions: Record<string, string>;
  events: string[];
  created_at: string;
  updated_at: string;
  suspended_by: unknown;
  suspended_at: string | null;

  // Optional fields that may be returned by the backend DB model
  repo_selection?: "selected" | "all";
  last_baseline_at?: string | null;

  // Attached repositories & accounts (shapes differ slightly between services)
  repositories: GitHubRepository[];
  accounts: {
    id: number;
    login: string;
    type: string;
    avatar_url: string;
    created_at: string;
    updated_at: string;
  }[];
}

// Repository shape comes from both the GitHub integration service and the
// backend DB model, so we use a superset of fields.
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch?: string;
  archived?: boolean;
  disabled?: boolean;
  last_synced_at?: string | null;
}

export interface InstallSessionResponse {
  install_url: string;
  state: string;
}

// Start GitHub App installation flow
export async function startGitHubInstallation(
  returnUrl: string
): Promise<InstallSessionResponse> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/github/install/session`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          return_url: returnUrl,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log("Error data:", errorData, response.status);
      throw new Error(
        errorData ||
          `HTTP ${response.status}: Failed to start GitHub installation`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error starting GitHub installation:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to start GitHub installation"
    );
  }
}

// Get GitHub installations for the organization
export async function getGitHubInstallations(): Promise<GitHubInstallation[]> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/github/proxy/installations`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `HTTP ${response.status}: Failed to fetch GitHub installations`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub installations:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch GitHub installations"
    );
  }
}

// Get repositories for a specific GitHub installation
export async function getGitHubRepositories(
  installationId: number
): Promise<GitHubRepository[]> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/github/repos?installation_id=${installationId}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `HTTP ${response.status}: Failed to fetch repositories`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to fetch repositories"
    );
  }
}

// Trigger baseline sync for a GitHub installation
export async function triggerGitHubBaseline(): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/github/proxy/repositories/sync`,
      {
        method: "POST",
        headers,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: Failed to trigger baseline`
      );
    }
  } catch (error) {
    console.error("Error triggering GitHub baseline:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to trigger baseline sync"
    );
  }
}

// Get GitHub proxy installations info
export async function getGitHubProxyInstallations(): Promise<GitHubInstallation[]> {
  try {
    const headers = await getAuthHeaders();
    const orgId = await getOrganizationId();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/integrations/github/proxy/installations?org_id=${orgId}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          `HTTP ${response.status}: Failed to fetch proxy installations`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub proxy installations:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch proxy installations",
    );
  }
}

// Link a GitHub repository by creating a corresponding codebase in the backend
export async function linkGitHubRepository(
  repo: GitHubRepository,
  codebaseType: string,
): Promise<Codebase> {
  try {
    const repoUrl = `https://github.com/${repo.full_name}`;
    const description = `GitHub repository: ${repo.full_name}`;

    // Reuse the existing codebase creation server action so behavior is
    // consistent with manual codebase creation.
    const created = await createCodebase({
      codebase_name: repo.name,
      codebase_repo_url: repoUrl,
      codebase_description: description,
      codebase_type: codebaseType.trim(),
    });

    return created;
  } catch (error) {
    console.error("Error linking GitHub repository:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to link GitHub repository",
    );
  }
}
