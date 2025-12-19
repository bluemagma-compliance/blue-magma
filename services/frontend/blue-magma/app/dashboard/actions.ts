"use server";

import { cookies } from "next/headers";
import type {
  CodebaseHealth,
  RecentReport,
  DashboardMetrics,
  Codebase,
  SubjectType,
  CodebaseWithIssues,
  UserOverview,
} from "@/types/api";
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

    // Ensure we always return an array
    if (!Array.isArray(data)) {
      console.warn("API returned non-array data for codebases:", data);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error fetching codebases:", error);
    // Return empty array if there's an error
    return [];
  }
}

// Server action to get subject types
export async function getSubjectTypes(): Promise<SubjectType[]> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/subject-types`, {
      headers,
      cache: "no-store", // Ensure fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint doesn't exist yet, return empty array
        return [];
      }
      throw new Error(`Failed to fetch subject types: ${response.status}`);
    }

    const data = await response.json();

    // Ensure we always return an array
    if (!Array.isArray(data)) {
      console.warn("API returned non-array data for subject types:", data);
      return [];
    }

    console.log("All subject types from API:", data);

    // Filter for codebase-related types and only include Frontend, Backend, Application, and Infrastructure
    const allowedTypes = [
      "frontend",
      "backend",
      "application",
      "infrastructure",
    ];
    const codebaseTypes = data.filter((type) => {
      const category = type.category && type.category.trim().toLowerCase();
      const objectId = type.object_id.toLowerCase();

      // Include types from 'codebase' category or infrastructure type specifically
      return (
        allowedTypes.includes(objectId) &&
        (category === "codebase" || objectId === "infrastructure")
      );
    });

    console.log("Filtered codebase types:", codebaseTypes);

    return codebaseTypes;
  } catch (error) {
    console.error("Error fetching subject types:", error);
    return [];
  }
}

// Server action to delete a codebase
export async function deleteCodebase(
  codebaseId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/codebase/${codebaseId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Failed to delete codebase: ${response.status} - ${
          errorData.error || "Unknown error"
        }`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting codebase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Helper function to map codebase types from backend to frontend
function mapCodebaseType(
  codebaseType: string,
): "frontend" | "backend" | "application" | "infrastructure" {
  switch (codebaseType.toLowerCase()) {
    case "frontend":
      return "frontend";
    case "backend":
      return "backend";
    case "application":
      return "application"; // Keep application as separate type
    case "infrastructure":
      return "infrastructure"; // Keep infrastructure as separate type
    case "database":
      return "backend"; // Map database to backend
    default:
      return "backend"; // Default fallback
  }
}

// Server action to get dashboard data
export async function getDashboardData(): Promise<{
  codebaseHealth: CodebaseHealth[];
  recentReports: RecentReport[];
  dashboardMetrics: DashboardMetrics;
}> {
  try {
    // Get codebases first
    const codebases = await getCodebases();

    // Debug logging
    console.log(
      "Fetched codebases:",
      codebases,
      "Type:",
      typeof codebases,
      "IsArray:",
      Array.isArray(codebases),
    );

    // Ensure codebases is an array (handle null/undefined cases)
    const safeCodebases = Array.isArray(codebases) ? codebases : [];

    console.log("Safe codebases:", safeCodebases.length, "items");

    // Transform codebases to health format with default values
    const codebaseHealth: CodebaseHealth[] = safeCodebases.map((codebase) => ({
      id: codebase.object_id,
      name: codebase.codebase_name,
      version: "1.0.0", // Default version
      lastScanDate: new Date().toISOString(), // Use current date since updated_at is not available
      status: "Good Standing" as const,
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      trend: "new" as const,
      healthScore: 100,
      type: mapCodebaseType(codebase.codebase_type || "backend"),
    }));

    // For now, return empty reports (until backend has reports endpoints)
    const recentReports: RecentReport[] = [];

    // Calculate dashboard metrics from available data
    const dashboardMetrics: DashboardMetrics = {
      totalCodebases: safeCodebases.length,
      averageComplianceScore: safeCodebases.length > 0 ? 100 : 0, // Default since no issues yet
      codebasesNeedingAttention: 0,
      compliancePercentage: safeCodebases.length > 0 ? 100 : 0,
      totalIssues: 0,
      activeScans: 0,
    };

    return {
      codebaseHealth,
      recentReports,
      dashboardMetrics,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);

    // Return empty state on error
    return {
      codebaseHealth: [],
      recentReports: [],
      dashboardMetrics: {
        totalCodebases: 0,
        averageComplianceScore: 0,
        codebasesNeedingAttention: 0,
        compliancePercentage: 0,
        totalIssues: 0,
        activeScans: 0,
      },
    };
  }
}

// Server action to get users for an organization
export async function getOrganizationUsers(): Promise<UserOverview[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/users`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint doesn't exist yet, return empty array
        return [];
      }
      throw new Error(`Failed to fetch users: ${response.status}`);
    }

    const data = await response.json();

    console.log("Users data:", data);

    // Backend may return either an array of users or an object wrapper like { users: [...] }
    const users =
      data && typeof data === "object" && "users" in data && Array.isArray((data as { users: unknown[] }).users)
        ? (data as { users: unknown[] }).users
        : Array.isArray(data)
          ? data
          : [];


    if (!Array.isArray(users)) {
      console.error("Unexpected users response shape", data);
      return [];
    }

  

    // Transform API users to component format
    return users.map(
      (user: {
        object_id: string;
        name: string;
        surname: string;
        username: string;
        email: string;
        role?: string;
        is_owner: boolean;
      }) => ({
        id: user.object_id,
        name: `${user.name} ${user.surname}`.trim() || user.username,
        email: user.email,
        role: user.role || (user.is_owner ? "Owner" : "Member"),
      }),
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

// Server action to get codebases with issues
export async function getCodebasesWithIssues() {
  try {
    // For now, return empty array since we don't have issues endpoints yet
    // TODO: Implement when backend has scan results/issues endpoints
    return [] as CodebaseWithIssues[];
  } catch (error) {
    console.error("Error fetching codebases with issues:", error);
    return [];
  }
}

// Server action to create a new codebase
export async function createCodebase(data: {
  codebase_name: string;
  codebase_repo_url: string;
  codebase_description: string;
  codebase_type: string;
}) {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        codebase_name: data.codebase_name,
        codebase_repo_url: data.codebase_repo_url,
        codebase_description: data.codebase_description,
        codebase_type: data.codebase_type,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to create codebase: ${response.status}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating codebase:", error);
    throw error;
  }
}

// Server action to get organization data including onboard_status
export async function getOrganization() {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch organization: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching organization:", error);
    throw error;
  }
}

// Server action to update organization onboard_status
export async function updateOnboardStatus(status: string): Promise<void> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        onboard_status: status,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to update onboard status: ${response.status}`,
      );
    }
  } catch (error) {
    console.error("Error updating onboard status:", error);
    throw error;
  }
}
