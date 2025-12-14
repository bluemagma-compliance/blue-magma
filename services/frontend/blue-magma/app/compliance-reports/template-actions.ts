"use server";

import { getOrganizationId, getAuthHeaders } from "@/app/auth/actions";
import type {
  ReportTemplate,
  TemplateSection,
  TemplateRule,
  Codebase,
  UiReportTemplate,
} from "@/types/api";
import { API_BASE } from "@/config/api";

// Template Actions
export async function getTemplates(): Promise<UiReportTemplate[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/report-template`, {
      headers,
    });

    if (!response.ok) {
      // For new organizations or permission issues, return empty array instead of throwing
      if (response.status === 403 || response.status === 404) {
        console.log(
          "No templates found or insufficient permissions - returning empty array",
        );
        return [];
      }
      throw new Error("Failed to fetch templates");
    }

    const templates = (await response.json()) as ReportTemplate[];

    // Handle null response from backend (when no templates exist)
    if (!templates || !Array.isArray(templates)) {
      console.log("No templates returned from backend - returning empty array");
      return [];
    }

    // Debug logging to help identify active templates
    const activeTemplates = templates.filter((t: ReportTemplate) => t.active);
    if (activeTemplates.length > 0) {
      console.log(
        "Found active templates:",
        activeTemplates.map((t: ReportTemplate) => ({
          id: t.object_id,
          name: t.name,
          active: t.active,
        })),
      );
    }

    return templates.map(
      (template) =>
        ({
          ...template,
          sections: template.sections.map((section) => ({
            ...section,
            rules: section.rules.map((rule) => ({
              ...rule,
              evidence_schema: rule.evidence_schema
                ? typeof rule.evidence_schema === "string"
                  ? JSON.parse(rule.evidence_schema)
                  : rule.evidence_schema
                : { required_documents: [] },
            })),
          })),
        }) satisfies UiReportTemplate,
    );
  } catch (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }
}

export async function getTemplate(
  templateId: string,
): Promise<ReportTemplate | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/template/${templateId}`,
      {
        headers,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch template: ${response.status}`);
    }

    const template = await response.json();
    return template;
  } catch (error) {
    console.error("Error fetching template:", error);
    return null;
  }
}

export async function createTemplate(data: {
  name: string;
  description: string;
  active: boolean;
  codebases: string[];
}): Promise<UiReportTemplate> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/report-template`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to create template");
    }

    return response.json();
  } catch (error) {
    console.error("Error creating template:", error);
    throw error;
  }
}

export async function updateTemplate(
  templateId: string,
  data: {
    name: string;
    description: string;
    active: boolean;
    codebases: string[];
  },
): Promise<UiReportTemplate> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/report-template/${templateId}`,
      {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update template");
    }

    return response.json();
  } catch (error) {
    console.error("Error updating template:", error);
    throw error;
  }
}

// Helper function to deactivate all templates (useful for debugging)
export async function deactivateAllTemplates(): Promise<void> {
  try {
    const templates = await getTemplates();
    const activeTemplates = templates.filter((t) => t.active);

    console.log(
      `Found ${activeTemplates.length} active templates to deactivate`,
    );

    for (const template of activeTemplates) {
      console.log(
        `Deactivating template: ${template.name} (${template.object_id})`,
      );
      await updateTemplate(template.object_id, {
        name: template.name,
        description: template.description,
        active: false,
        codebases:
          template.codebases?.map((cb) =>
            typeof cb === "string" ? cb : cb.object_id,
          ) || [],
      });
    }

    console.log("All templates deactivated");
  } catch (error) {
    console.error("Error deactivating templates:", error);
    throw error;
  }
}

export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/report-template/${templateId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete template");
    }
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
}

// Template Section Actions
export async function createTemplateSection(data: {
  name: string;
  description: string;
  template_id: string;
  rules: string[];
}): Promise<TemplateSection> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    console.log("Creating template section with data:", data);

    const response = await fetch(`${API_BASE}/org/${orgId}/template-section`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Template section creation failed:",
        response.status,
        errorText,
      );
      throw new Error(
        `Failed to create template section: ${response.status} ${errorText}`,
      );
    }

    return response.json();
  } catch (error) {
    console.error("Error creating template section:", error);
    throw error;
  }
}

export async function updateTemplateSection(
  sectionId: string,
  data: {
    name: string;
    description: string;
    template_id: string;
    rules: string[];
  },
): Promise<TemplateSection> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/template-section/${sectionId}`,
      {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to update template section");
    }

    return response.json();
  } catch (error) {
    console.error("Error updating template section:", error);
    throw error;
  }
}

export async function deleteTemplateSection(sectionId: string): Promise<void> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/template-section/${sectionId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to delete template section");
    }
  } catch (error) {
    console.error("Error deleting template section:", error);
    throw error;
  }
}

// Rule Actions
export async function getRules(): Promise<TemplateRule[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/rule`, {
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to fetch rules");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching rules:", error);
    throw error;
  }
}

export async function createRule(data: {
  name: string;
  description: string;
  rule: string;
  evidence_schema?: string;
  policy_name?: string;
  policy_version?: string;
  public?: boolean;
  scope?: string;
  section?: string;
  severity?: string;
  source?: string;
  tags?: string;
}): Promise<TemplateRule> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    // Ensure all required fields are present with defaults
    const ruleData = {
      name: data.name,
      description: data.description,
      rule: data.rule,
      evidence_schema: data.evidence_schema || "{}",
      policy_name: data.policy_name || "",
      policy_version: data.policy_version || "1.0",
      public: data.public || false,
      scope: data.scope || "",
      section: data.section || "",
      severity: data.severity || "medium",
      source: data.source || "custom",
      tags: data.tags || "",
    };

    console.log("Creating rule with data:", ruleData);

    const response = await fetch(`${API_BASE}/org/${orgId}/rule`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ruleData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Rule creation failed:", response.status, errorText);
      throw new Error(`Failed to create rule: ${response.status} ${errorText}`);
    }

    const createdRule = await response.json();
    console.log("Rule created successfully:", createdRule);
    return createdRule;
  } catch (error) {
    console.error("Error creating rule:", error);
    throw error;
  }
}

export async function updateRule(
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
): Promise<TemplateRule> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/rule/${ruleId}`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to update rule");
    }

    return response.json();
  } catch (error) {
    console.error("Error updating rule:", error);
    throw error;
  }
}

export async function deleteRule(ruleId: string): Promise<void> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/rule/${ruleId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to delete rule");
    }
  } catch (error) {
    console.error("Error deleting rule:", error);
    throw error;
  }
}

// Import/Export Actions
export async function importTemplate(templateData: {
  name: string;
  description: string;
  version?: string;
  source?: string;
  sections: Array<{
    name: string;
    description: string;
    rules: Array<{
      name: string;
      rule: string;
      scope: string;
      tags: string[];
    }>;
  }>;
}): Promise<ReportTemplate> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/compliance-template/import`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templateData),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to import template");
    }

    return response.json();
  } catch (error) {
    console.error("Error importing template:", error);
    throw error;
  }
}

export async function exportTemplate(templateId: string): Promise<{
  name: string;
  description: string;
  version?: string;
  source?: string;
  sections: Array<{
    name: string;
    description: string;
    rules: Array<{
      name: string;
      rule: string;
      scope: string;
      tags: string[];
    }>;
  }>;
}> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(
      `${API_BASE}/org/${orgId}/compliance-template/${templateId}/export`,
      {
        headers,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to export template");
    }

    return response.json();
  } catch (error) {
    console.error("Error exporting template:", error);
    throw error;
  }
}

// Codebase Actions (reusing existing server action)
export async function getCodebases(): Promise<Codebase[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    if (!orgId) {
      throw new Error("Organization ID not found");
    }

    const response = await fetch(`${API_BASE}/org/${orgId}/codebase`, {
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to fetch codebases");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching codebases:", error);
    throw error;
  }
}
