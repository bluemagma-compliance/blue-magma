"use server";

import { getOrganizationId, getAuthHeaders } from "@/app/auth/actions";
import type { ComplianceReport, Ruling, Codebase, ReportTemplate, TemplateRule } from "@/types/api";
import { API_BASE } from "@/config/api";

function formatReport(report: ComplianceReport): ComplianceReport {
  return {
    ...report,
    id: report.object_id, // alias for backward compatibility
  };
}

export async function getComplianceReports(): Promise<ComplianceReport[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/report`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch compliance reports: ${response.status}`);
    }

    const data = await response.json();
    const reports = Array.isArray(data) ? data : [];
    return reports.map(formatReport);
  } catch (error) {
    console.error("Error fetching compliance reports:", error);
    return [];
  }
}

// Debug function to fetch and log templates
export async function debugLogTemplates(): Promise<void> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      console.error("Organization ID not found");
      return;
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/report-template`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`Failed to fetch templates: ${response.status}`);
      return;
    }

    const templates = (await response.json()) as ReportTemplate[];

    console.log("=== ALL TEMPLATES ===");
    console.log("Total templates:", templates.length);
    console.table(
      templates.map((t) => ({
        ID: t.object_id,
        Name: t.name,
        Active: t.active,
        Description: t.description,
        Codebases: t.codebases?.length || 0,
        Sections: t.sections?.length || 0,
      }))
    );

    const activeTemplates = templates.filter((t) => t.active);
    console.log("=== ACTIVE TEMPLATES ===");
    console.log("Active templates count:", activeTemplates.length);
    if (activeTemplates.length > 0) {
      console.table(
        activeTemplates.map((t) => ({
          ID: t.object_id,
          Name: t.name,
          Active: t.active,
          Description: t.description,
        }))
      );
    } else {
      console.log("No active templates found");
    }
  } catch (error) {
    console.error("Error fetching templates for debug:", error);
  }
}

export async function getComplianceReport(
  reportId: string
): Promise<ComplianceReport | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/report/${reportId}`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch compliance report: ${response.status}`);
    }

    const report = await response.json();

    return formatReport(report);
  } catch (error) {
    console.error("Error fetching compliance report:", error);
    return null;
  }
}

export async function getRulingDetails(
  rulingId: string
): Promise<Ruling | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/ruling/${rulingId}`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch ruling details: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching ruling details:", error);
    return null;
  }
}

export async function getRule(ruleId: string): Promise<TemplateRule | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/rule/${ruleId}`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch rule: ${response.status}`);
    }

    const rule = (await response.json()) as TemplateRule;
    return rule;
  } catch (error) {
    console.error("Error fetching rule:", error);
    return null;
  }
}

export async function getComplianceReportWithRulings(
  reportId: string
): Promise<ComplianceReport | null> {
  try {
    // Get the base report (which already includes rulings in sections)
    const report = await getComplianceReport(reportId);
    if (!report) {
      return null;
    }

    // For each section, fetch detailed ruling data (questions and found_properties)
    if (report.sections) {
      for (const section of report.sections) {
        if (section.rulings) {
          // Fetch detailed data for each ruling
          const detailedRulings = await Promise.all(
            section.rulings.map(async (ruling) => {
              const detailedRuling = await getRulingDetails(ruling.object_id);

              if (detailedRuling) {
                // Merge the basic ruling data with detailed data
                // Rule details are now included in the ruling response from backend
                return {
                  ...ruling,
                  ...detailedRuling,
                  // Ensure we keep the original object_id
                  object_id: ruling.object_id,
                };
              }
              return ruling;
            })
          );
          section.rulings = detailedRulings;
        }
      }
    }

    return report;
  } catch (error) {
    console.error("Error fetching compliance report with rulings:", error);
    return null;
  }
}

export async function generateReport(
  templateId: string,
  codebaseVersionId: string
): Promise<{ success: boolean; message: string; reportId?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const requestBody = {
      template_id: templateId,
      organization_id: orgId,
      codebase_version_id: codebaseVersionId,
    };

    console.log("=== GENERATE REPORT DEBUG ===");
    console.log("Template ID:", templateId);
    console.log("Codebase Version ID:", codebaseVersionId);
    console.log("Request body:", requestBody);
    console.log("API URL:", `${API_BASE}/org/${orgId}/rpc/generate-report/`);

    const response = await fetch(
      `${API_BASE}/org/${orgId}/rpc/generate-report/`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Failed to generate report: ${response.status} - ${
          errorData.message || "Unknown error"
        }`
      );
    }

    const data = await response.json();
    return {
      success: true,
      message: "Report generation started successfully",
      reportId: data.report_id || data.object_id,
    };
  } catch (error) {
    console.error("Error generating report:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to generate report",
    };
  }
}

// Helper function to get codebases with versions for a template
export async function getTemplateCodebasesWithVersions(
  templateId: string
): Promise<Codebase[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    // First get the template to find associated codebases
    const templateResponse = await fetch(
      `${API_BASE}/org/${orgId}/report-template/${templateId}`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!templateResponse.ok) {
      throw new Error("Failed to fetch template");
    }

    const template = await templateResponse.json();
    const codebaseIds =
      template.codebases?.map((cb: string | { object_id: string }) =>
        typeof cb === "string" ? cb : cb.object_id
      ) || [];

    if (codebaseIds.length === 0) {
      return [];
    }

    // Fetch detailed codebase data with versions
    const codebasePromises = codebaseIds.map(async (codebaseId: string) => {
      const response = await fetch(
        `${API_BASE}/org/${orgId}/codebase/${codebaseId}`,
        {
          headers,
          cache: "no-store",
        }
      );

      if (!response.ok) {
        console.warn(`Failed to fetch codebase ${codebaseId}`);
        return null;
      }

      return response.json();
    });

    const codebases = await Promise.all(codebasePromises);
    return codebases.filter(Boolean) as Codebase[];
  } catch (error) {
    console.error("Error fetching template codebases with versions:", error);
    return [];
  }
}
