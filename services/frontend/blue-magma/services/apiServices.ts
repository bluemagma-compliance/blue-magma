/**
 * @deprecated This entire file is deprecated due to the switch to httpOnly cookies.
 * Client-side API services can no longer access authentication tokens directly.
 *
 * These services should be replaced with server actions in individual page/component
 * action files. See the dashboard/actions.ts file for examples of how to implement
 * authenticated API calls using server actions.
 *
 * Migration pattern:
 * 1. Create server actions in your page's actions.ts file
 * 2. Use the cookies() function from 'next/headers' to access httpOnly cookies
 * 3. Call the server actions from your client components
 */

import { fetchWithAuth } from "./fetchWithAuth";
import { handleApiError, retryWithBackoff } from "../utils/errorHandling";
import type {
  Organization,
  User,
  Codebase,
  CodebaseVersion,
  Rule,
  RuleAssignment,
  Ruling,
  Question,
  APIKey,
  ApiResponse,
  PaginatedResponse,
  DashboardMetrics,
  CodebaseHealth,
  RecentReport,
  CodebaseWithIssues,
  ReportTemplate,
  TemplateSection,
  TemplateRule,
} from "../types/api";

import { API_BASE } from "../config/api";

// Helper function to get organization ID from user context
// This should be replaced with actual user context when available
function getOrgId(): string {
  // TODO: Get this from user context/auth state
  // For now, we'll need to pass it as a parameter
  throw new Error("Organization ID must be provided");
}

// Organization Services
export const organizationService = {
  async getOrganization(orgId: string): Promise<Organization> {
    const response = await fetchWithAuth(`${API_BASE}/org/${orgId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch organization");
    }
    return response.json();
  },
};

// User Services
export const userService = {
  async getUsers(orgId: string): Promise<User[]> {
    try {
      const response = await fetchWithAuth(`${API_BASE}/org/${orgId}/users`);
      if (!response.ok) {
        // If endpoint doesn't exist yet, return empty array
        if (response.status === 404) {
          return [];
        }
        throw new Error("Failed to fetch users");
      }
      return response.json();
    } catch (error) {
      // For now, return empty array if endpoint doesn't exist
      console.warn("Users endpoint not available yet, returning empty array");
      return [];
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      const response = await fetchWithAuth(`${API_BASE}/user/me`);
      if (!response.ok) {
        throw new Error("Failed to fetch current user");
      }
      return response.json();
    } catch (error) {
      // Return a placeholder user if endpoint doesn't exist
      throw new Error("Current user endpoint not available yet");
    }
  },
};

// Codebase Services
export const codebaseService = {
  async getCodebases(orgId: string): Promise<Codebase[]> {
    return retryWithBackoff(async () => {
      const response = await fetchWithAuth(`${API_BASE}/org/${orgId}/codebase`);
      if (!response.ok) {
        throw handleApiError({
          status: response.status,
          message: "Failed to fetch codebases",
        });
      }
      return response.json();
    });
  },

  async getCodebase(orgId: string, codebaseId: string): Promise<Codebase> {
    return retryWithBackoff(async () => {
      const response = await fetchWithAuth(
        `${API_BASE}/org/${orgId}/codebase/${codebaseId}`,
      );
      if (!response.ok) {
        throw handleApiError({
          status: response.status,
          message: "Failed to fetch codebase",
        });
      }
      return response.json();
    });
  },

  async createCodebase(
    orgId: string,
    data: Partial<Codebase>,
  ): Promise<Codebase> {
    const response = await fetchWithAuth(`${API_BASE}/org/${orgId}/codebase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Failed to create codebase");
    }
    return response.json();
  },

  async updateCodebase(
    orgId: string,
    codebaseId: string,
    data: Partial<Codebase>,
  ): Promise<Codebase> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/codebase/${codebaseId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to update codebase");
    }
    return response.json();
  },

  async deleteCodebase(orgId: string, codebaseId: string): Promise<void> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/codebase/${codebaseId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to delete codebase");
    }
  },
};

// Rule Services
export const ruleService = {
  async getRules(orgId: string): Promise<Rule[]> {
    const response = await fetchWithAuth(`${API_BASE}/org/${orgId}/rule`);
    if (!response.ok) {
      throw new Error("Failed to fetch rules");
    }
    return response.json();
  },

  async getRule(orgId: string, ruleId: string): Promise<Rule> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/rule/${ruleId}`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch rule");
    }
    return response.json();
  },

  async updateRule(
    orgId: string,
    ruleId: string,
    data: {
      name?: string;
      description?: string;
      rule?: string;
      policy_name?: string;
      policy_version?: string;
      evidence_schema?: string;
      scope?: string;
      section?: string;
      severity?: string;
      source?: string;
      tags?: string;
      public?: boolean;
    },
  ): Promise<Rule> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/rule/${ruleId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to update rule");
    }
    return response.json();
  },

  async deleteRule(orgId: string, ruleId: string): Promise<void> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/rule/${ruleId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to delete rule");
    }
  },

  async createRule(orgId: string, data: Partial<Rule>): Promise<Rule> {
    const response = await fetchWithAuth(`${API_BASE}/org/${orgId}/rule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error("Failed to create rule");
    }
    return response.json();
  },
};

// Dashboard Services - These will need to be implemented as the backend doesn't have these endpoints yet
export const dashboardService = {
  async getDashboardMetrics(orgId: string): Promise<DashboardMetrics> {
    // For now, calculate from available data
    const codebases = await codebaseService.getCodebases(orgId);

    // TODO: Replace with actual API calls when backend endpoints are available
    return {
      totalCodebases: codebases.length,
      averageComplianceScore: 0,
      codebasesNeedingAttention: 0,
      compliancePercentage: 0,
      totalIssues: 0,
      activeScans: 0,
    };
  },

  async getCodebaseHealth(orgId: string): Promise<CodebaseHealth[]> {
    // TODO: Implement when backend has scan/health endpoints
    const codebases = await codebaseService.getCodebases(orgId);

    // Transform codebases to health format with default values
    return codebases.map((codebase) => ({
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
      type: "backend" as const, // Default type
    }));
  },

  async getRecentReports(orgId: string): Promise<RecentReport[]> {
    // TODO: Implement when backend has reports endpoints
    return [];
  },

  async getCodebasesWithIssues(orgId: string): Promise<CodebaseWithIssues[]> {
    // TODO: Implement when backend has issues/scan results endpoints
    return [];
  },
};

// RPC Services
export const rpcService = {
  async initiateCodeScanReport(
    orgId: string,
    data: {
      repo_url: string;
      branch: string;
      commit_hash: string;
    },
  ): Promise<unknown> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/rpc/initiate-code-scan-report`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to initiate code scan report");
    }
    return response.json();
  },
};

// Template Services
export const templateService = {
  async getTemplates(orgId: string): Promise<ReportTemplate[]> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/report-template`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch templates");
    }
    return response.json();
  },

  async createTemplate(
    orgId: string,
    data: {
      name: string;
      description: string;
      active: boolean;
      codebases: string[];
    },
  ): Promise<ReportTemplate> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/report-template`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to create template");
    }
    return response.json();
  },

  async updateTemplate(
    orgId: string,
    templateId: string,
    data: {
      name: string;
      description: string;
      active: boolean;
      codebases: string[];
    },
  ): Promise<ReportTemplate> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/report-template/${templateId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to update template");
    }
    return response.json();
  },

  async deleteTemplate(orgId: string, templateId: string): Promise<void> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/report-template/${templateId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to delete template");
    }
  },
};

// Template Section Services
export const templateSectionService = {
  async createTemplateSection(
    orgId: string,
    data: {
      name: string;
      description: string;
      template_id: string;
      rules: string[];
    },
  ): Promise<TemplateSection> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/template-section`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to create template section");
    }
    return response.json();
  },

  async updateTemplateSection(
    orgId: string,
    sectionId: string,
    data: {
      name: string;
      description: string;
      template_id: string;
      rules: string[];
    },
  ): Promise<TemplateSection> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/template-section/${sectionId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to update template section");
    }
    return response.json();
  },

  async deleteTemplateSection(orgId: string, sectionId: string): Promise<void> {
    const response = await fetchWithAuth(
      `${API_BASE}/org/${orgId}/template-section/${sectionId}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error("Failed to delete template section");
    }
  },
};
