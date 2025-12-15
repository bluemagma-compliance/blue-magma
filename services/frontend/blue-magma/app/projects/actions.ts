"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { API_BASE } from "@/config/api";
import type {
	JsonValue,
	DocumentTreeResponse,
	DocumentSummary,
	FullDocumentResponse,
	Agent,
	AgentDetail,
	Evidence,
	EvidenceRequest,
} from "./types";


// Re-export Agent types so UI components can import them from this module
export type { Agent, AgentDetail } from "./types";



// Project type matching backend response
export interface Project {
  object_id: string;
  name: string;
  description: string;
  status: "initializing" | "active" | "up-to-date" | "out-of-date" | "audit-ready" | "completed" | "on-hold";
  compliance_score: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: "initializing" | "active" | "up-to-date" | "out-of-date" | "audit-ready" | "completed" | "on-hold";
  compliance_score?: number;
  template_id?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: "initializing" | "active" | "up-to-date" | "out-of-date" | "audit-ready" | "completed" | "on-hold";
  compliance_score?: number;
}


// ===== Project Tasks (backend model + helpers) =====

export type ProjectTaskStatusApi = "todo" | "in_progress" | "stuck" | "completed";

export type ProjectTaskPriorityApi = "low" | "medium" | "high" | "critical";

// Shape returned by the backend for a project task.
export interface ApiProjectTask {
	  object_id: string;
	  organization_id?: number;
	  project_id?: number;
	  title: string;
	  description?: string | null;
	  status: ProjectTaskStatusApi;
	  priority: ProjectTaskPriorityApi;
	  notes?: string | null;
	  depends_on_task_id?: string | null;
	  due_date?: string | null;
	  document_id?: number | null;
	  evidence_request_id?: number | null;
	  created_at?: string;
	  updated_at?: string;
	}

export interface ProjectTaskListResponse {
	  items: ApiProjectTask[];
	  total: number;
	  pages: number;
	  limit: number;
	  offset: number;
}

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

// Narrow unknown JSON values into a simple string-keyed record when needed.
function toRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
}

// Safely read an array property (e.g. items, auditors, reports) from an
// unknown JSON payload without resorting to `any`.
function getArrayProperty<T>(
  value: unknown,
  property: string,
): T[] | undefined {
  const record = toRecord(value);
  if (!record) return undefined;
  const candidate = record[property];
  return Array.isArray(candidate) ? (candidate as T[]) : undefined;
}

// Server action to get all projects
export async function getProjects(): Promise<Project[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/project`, {
      headers,
      cache: "no-store", // Ensure fresh data
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const data = await response.json();

    // Ensure we always return an array
    if (!Array.isArray(data)) {
      console.warn("API returned non-array data for projects:", data);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

// Server action to get a single project by ID
export async function getProjectById(
  projectId: string,
): Promise<Project | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}`,
      {
        headers,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch project: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching project:", error);
    return null;
  }
}

// Server action to create a new project
export async function createProject(
  projectData: CreateProjectRequest,
): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}/project`, {
      method: "POST",
      headers,
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to create project: ${response.status}`,
      };
    }

    const project = await response.json();

    // Revalidate the projects page to show the new project
    revalidatePath("/projects");

    return {
      success: true,
      project,
    };
  } catch (error) {
    console.error("Error creating project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create project",
    };
  }
}

// Server action to create a new project from an SCF configuration document.
//
// The backend owns the detailed schema (scf_config.v1). Here we only type the
// top-level fields we care about and keep the rest flexible so the payload can
// evolve without requiring frontend changes.
export interface CreateProjectFromSCFConfigRequest {
  version: string;
  generated_at: string;
  source: string;
  project_name: string;
  project_description?: string;
  // The remainder of the payload follows the scf_config.v1 contract.
	  controls: JsonValue[];
	  assessment_objectives?: JsonValue;
	  evidence_requests?: JsonValue;
	  timeline?: JsonValue;
	  // Allow backend-validated extensions.
		  [key: string]: JsonValue | undefined;
}

	export async function createProjectFromSCFConfig(
	  config: CreateProjectFromSCFConfigRequest,
	): Promise<{
	  success: boolean;
	  project?: Project;
	  // Backend now responds with a small stats summary alongside the project
	  // (e.g. number of controls, documents, evidence_requests, auditors).
	  // We keep this flexible so the contract can evolve without breaking the
	  // frontend, and callers can ignore it until needed.
	  stats?: Record<string, JsonValue>;
	  error?: string;
	}> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/project/from-scf-config`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(config),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          (errorData as { error?: string }).error ||
          `Failed to create project from SCF config: ${response.status}`,
      };
    }
	
	    const raw = (await response.json()) as unknown;
	
	    // Backend now wraps the project and stats as:
	    //   { project: { ... }, stats: { controls, documents, ... } }
	    // but we also support the legacy shape where the response is just the
	    // project object itself. This keeps older/staging backends working.
	    let project: Project | undefined;
	    let stats: Record<string, JsonValue> | undefined;
	
	    if (raw && typeof raw === "object" && "project" in raw) {
	      const wrapped = raw as {
	        project?: Project;
	        stats?: Record<string, JsonValue>;
	      };
	      project = wrapped.project;
	      stats = wrapped.stats;
	    } else {
	      project = raw as Project;
	    }
	
	    if (!project) {
	      return {
	        success: false,
	        error: "Backend did not return a project for SCF config creation",
	      };
	    }

    // Revalidate the projects listing and (if possible) the project detail page.
    revalidatePath("/projects");
    if (project?.object_id) {
      revalidatePath(`/projects/${project.object_id}`);
    }

    return {
      success: true,
      project,
	      stats,
    };
  } catch (error) {
    console.error("Error creating project from SCF config:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create project from SCF config",
    };
  }
}

// Server action to update a project
export async function updateProject(
  projectId: string,
  projectData: UpdateProjectRequest,
): Promise<{ success: boolean; project?: Project; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(projectData),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to update project: ${response.status}`,
      };
    }

    const project = await response.json();

    // Revalidate the projects page and the specific project page
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return {
      success: true,
      project,
    };
  } catch (error) {
    console.error("Error updating project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update project",
    };
  }
}

// Server action to delete a project
export async function deleteProject(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to delete project: ${response.status}`,
      };
    }

    // Revalidate the projects page
    revalidatePath("/projects");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete project",
    };
  }
}

// ===== Documentation Template actions =====
export interface DocPage {
  id: string;
  title: string;
  content: string;
  order: number;
  children?: DocPage[];
  createdAt: string;
  updatedAt: string;
}

interface DocumentationTemplateResponse {
  object_id: string;
  project_id: string;
  pages: DocPage[];
  created_at: string;
  updated_at: string;
}

export async function getDocumentationTemplate(
  projectId: string,
): Promise<DocPage[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/documentation-template`,
      { headers, cache: "no-store" },
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Failed to fetch template: ${res.status}`);
    }
    const data: DocumentationTemplateResponse = await res.json();
    // Handle null or missing pages
    return (Array.isArray(data.pages) && data.pages.length > 0) ? data.pages : [];
  } catch (err) {
    console.error("Error fetching documentation template:", err);
    return [];
  }
}

export async function saveDocumentationTemplate(
  projectId: string,
  pages: DocPage[],
): Promise<{ success: boolean; error?: string }>
{
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/documentation-template`,
      { method: "PUT", headers, body: JSON.stringify({ pages }) },
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { success: false, error: errorData.error || `Failed: ${res.status}` };
    }

    // Revalidate project page
    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Error saving documentation template:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}


// Full fetch returning template metadata (including object_id)
export async function getDocumentationTemplateFull(
  projectId: string,
): Promise<DocumentationTemplateResponse | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/documentation-template`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch template: ${res.status}`);
    }
    const data: DocumentationTemplateResponse = await res.json();

    // Handle null pages - convert to empty array
    if (data && data.pages === null) {
      data.pages = [];
    }

    return data;
  } catch (err) {
    console.error("Error fetching full documentation template:", err);
    return null;
  }
}

// RPC: initiate docs generation from a template (placeholder)
export async function rpcGenerateDocs(
  projectId: string,
  templateId: string,
): Promise<{ success: boolean; job_id?: string; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/org/${orgId}/rpc/generate-docs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ template_id: templateId, project_id: projectId }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { success: false, error: errorData.error || `Failed: ${res.status}` };
    }
    const data = await res.json();
    return { success: true, job_id: data.job_id };
  } catch (err) {
    console.error("Error initiating docs generation:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ===== Project Templates =====
// API response format
export interface ProjectTemplateAPIResponse {
  object_id: string;
  title: string;
  description: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Normalized format for frontend
export interface ProjectTemplateResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  createdAt: string;
}

export interface ProjectTemplateDetailResponse extends ProjectTemplateResponse {
  documentation: DocPage[];
  policies: PolicyTemplateResponse[];
}

export interface PolicyTemplateResponse {
  id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

// Helper function to map API response to frontend format
function mapTemplateResponse(apiTemplate: ProjectTemplateAPIResponse): ProjectTemplateResponse {
  return {
    id: apiTemplate.object_id,
    name: apiTemplate.title,
    description: apiTemplate.description,
    category: apiTemplate.category,
    active: apiTemplate.is_active,
    createdAt: apiTemplate.created_at,
  };
}

// Get all available project templates
export async function getProjectTemplates(): Promise<ProjectTemplateResponse[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/project-template`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Failed to fetch templates: ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map(mapTemplateResponse);
  } catch (err) {
    console.error("Error fetching project templates:", err);
    return [];
  }
}

// Get a specific project template with full details
export async function getProjectTemplateById(
  templateId: string,
): Promise<ProjectTemplateDetailResponse | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/project-template/${templateId}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch template: ${res.status}`);
    }

    const data = await res.json();

    // Extract template_data if it exists (nested structure)
    const templateData = data.template_data || data;

    // Map the API response to our frontend format
    if (data) {
      return {
        id: data.object_id || data.id,
        name: data.title || data.name,
        description: data.description,
        category: data.category,
        active: data.is_active !== undefined ? data.is_active : data.active,
        createdAt: data.created_at || data.createdAt,
        documentation: templateData.documentation_template?.pages || templateData.documentation || [],
        policies: templateData.policy_templates || templateData.policies || [],
      };
    }

    return null;
  } catch (err) {
    console.error("Error fetching project template:", err);
    return null;
  }
}

// ===== Policy Templates =====

// API response format for policies
interface PolicyTemplateAPIResponse {
  object_id: string;
  project_id: string;
  title: string;
  description: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

// Helper function to map policy API response to frontend format
function mapPolicyResponse(apiPolicy: PolicyTemplateAPIResponse): PolicyTemplateResponse {
  return {
    id: apiPolicy.object_id,
    title: apiPolicy.title,
    description: apiPolicy.description,
    content: apiPolicy.content,
    category: apiPolicy.category,
    createdAt: apiPolicy.created_at,
    updatedAt: apiPolicy.updated_at,
  };
}

// Get all policies for a project
export async function getProjectPolicies(
  projectId: string,
): Promise<PolicyTemplateResponse[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/policy-template`,
      { headers, cache: "no-store" },
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Failed to fetch policies: ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map(mapPolicyResponse);
  } catch (err) {
    console.error("Error fetching project policies:", err);
    return [];
  }
}

// Get a specific policy
export async function getPolicyById(
  projectId: string,
  policyId: string,
): Promise<PolicyTemplateResponse | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/policy-template/${policyId}`,
      { headers, cache: "no-store" },
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch policy: ${res.status}`);
    }

    const data = await res.json();
    return mapPolicyResponse(data);
  } catch (err) {
    console.error("Error fetching policy:", err);
    return null;
  }
}

// Create a new policy
export async function createPolicy(
  projectId: string,
  policyData: {
    title: string;
    description: string;
    content: string;
    category: string;
  },
): Promise<{ success: boolean; policy?: PolicyTemplateResponse; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/policy-template`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(policyData),
      },
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to create policy: ${res.status}`,
      };
    }

    const policy = await res.json();
    revalidatePath(`/projects/${projectId}`);
    return { success: true, policy };
  } catch (err) {
    console.error("Error creating policy:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Update a policy
export async function updatePolicy(
  projectId: string,
  policyId: string,
  policyData: {
    title?: string;
    description?: string;
    content?: string;
    category?: string;
  },
): Promise<{ success: boolean; policy?: PolicyTemplateResponse; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/policy-template/${policyId}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(policyData),
      },
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to update policy: ${res.status}`,
      };
    }

    const policy = await res.json();
    revalidatePath(`/projects/${projectId}`);
    return { success: true, policy };
  } catch (err) {
    console.error("Error updating policy:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Delete a policy
export async function deletePolicy(
  projectId: string,
  policyId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/policy-template/${policyId}`,
      {
        method: "DELETE",
        headers,
      },
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to delete policy: ${res.status}`,
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Error deleting policy:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ===== Auditors =====
export interface Auditor {
  object_id: string;
  name: string;
  description: string;
  schedule: string;
  is_active: boolean;
  last_run_at?: string;
  last_status?: string;
  run_count?: number;
}

export interface AuditorDetail extends Auditor {
  instructions: {
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      context?: string;
      success_criteria: string[];
      failure_criteria: string[];
      weight: number;
    }>;
    passing_score: number;
  };
}

export interface AuditReport {
  object_id: string;
  status: string;
  score: number;
  executed_at: string;
  executed_by: string;
  duration: number;
}

export interface AuditReportDetail extends AuditReport {
  results: {
    requirements: Array<{
      id: string;
      title: string;
      status: string;
      score: number;
      findings: string;
      evidence_reviewed: string[];
      reasoning: string;
    }>;
    summary: string;
    recommendations: string[];
  };
}

// Paginated list responses for auditors and audit reports (matches SCF pattern)
export interface AuditorListResponse {
  items: Auditor[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

export interface AuditReportListResponse {
  items: AuditReport[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

// Get all auditors for a project
export async function getAuditors(projectId: string): Promise<Auditor[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    console.log("=== FETCHING AUDITORS ===");
    console.log("Endpoint:", `${API_BASE}/org/${orgId}/project/${projectId}/auditor`);
    console.log("Project ID:", projectId);
    console.log("Organization ID:", orgId);

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor`,
      { headers, cache: "no-store" }
    );

    console.log("Response Status:", res.status);

    if (!res.ok) {
      if (res.status === 404) {
        console.log("⚠️ Auditors endpoint returned 404 - returning empty array");
        return [];
      }
      throw new Error(`Failed to fetch auditors: ${res.status}`);
    }

    const data = await res.json();

    console.log("\n📊 EXPECTED DATA STRUCTURE:");
    console.log(JSON.stringify({
      auditors: [
        {
          object_id: "string (UUID)",
          name: "string",
          description: "string",
          schedule: "string (e.g., 'daily', 'weekly')",
          is_active: "boolean",
          last_run_at: "string (ISO date) - optional",
          last_status: "string (e.g., 'passed', 'failed') - optional",
          run_count: "number - optional"
        }
      ]
    }, null, 2));

    console.log("\n📦 ACTUAL DATA RECEIVED:");
    console.log("Type:", typeof data);
    console.log("Value:", JSON.stringify(data, null, 2));

    console.log("\n🔍 DATA VALIDATION:");
    console.log("- Is data null?", data === null);
    console.log("- Is data an object?", typeof data === 'object' && data !== null);
    console.log("- Is data an array?", Array.isArray(data));
    console.log("- Has 'auditors' property?", data && !Array.isArray(data) && 'auditors' in data);

    // Handle null response
    if (!data) {
      console.log("⚠️ Response data is null - returning empty array");
      console.log("=== END FETCHING AUDITORS ===\n");
      return [];
    }

    // Backend returns array directly, or wrapped, or paginated with items.
    let auditors: Auditor[] = [];

	    const paginatedItems = getArrayProperty<Auditor>(data, "items");
	    const wrappedAuditors = getArrayProperty<Auditor>(data, "auditors");

	    if (paginatedItems) {
	      console.log("✅ Backend returned paginated envelope { items, ... }");
	      console.log("- Number of auditors:", paginatedItems.length);
	      auditors = paginatedItems;
	    } else if (Array.isArray(data)) {
	      console.log("✅ Backend returned array directly (not wrapped)");
	      console.log("- Number of auditors:", data.length);
	      auditors = data as Auditor[];
	    } else if (wrappedAuditors) {
	      console.log("✅ Backend returned wrapped object { auditors: [...] }");
	      console.log("- Number of auditors:", wrappedAuditors.length);
	      auditors = wrappedAuditors;
	    } else {
	      console.log("⚠️ Unexpected data format - returning empty array");
	      console.log("=== END FETCHING AUDITORS ===\n");
	      return [];
	    }

    if (auditors.length > 0) {
      console.log("\n✅ FIRST AUDITOR SAMPLE:");
      console.log(JSON.stringify(auditors[0], null, 2));
    }

    console.log("=== END FETCHING AUDITORS ===\n");

    return auditors;
  } catch (err) {
    console.error("❌ Error fetching auditors:", err);
    return [];
  }
}

// Get auditors for a project (paginated). Follows the same offset/limit envelope as SCF helpers.
export async function getAuditorsPaginated(
  projectId: string,
  params?: { limit?: number; offset?: number },
): Promise<AuditorListResponse> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const url = new URL(`${API_BASE}/org/${orgId}/project/${projectId}/auditor`);
    if (params?.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params?.offset !== undefined) url.searchParams.set("offset", String(params.offset));

    const res = await fetch(url.toString(), { headers, cache: "no-store" });

    const fallback: AuditorListResponse = {
      items: [],
      total: 0,
      pages: 0,
      limit: params?.limit ?? 0,
      offset: params?.offset ?? 0,
    };

    if (!res.ok) {
      if (res.status === 404) {
        console.warn("Auditors endpoint returned 404 - returning empty list");
        return fallback;
      }
      console.error("Failed to fetch auditors:", res.status);
      return fallback;
    }

    const data = await res.json();

	    // Preferred shape: paginated envelope { items, total, pages, limit, offset }
	    const paginatedItems = getArrayProperty<Auditor>(data, "items");
	    if (paginatedItems) {
	      const record = toRecord(data);
	      const items = paginatedItems;
	      return {
	        items,
	        total: Number(
	          (record?.["total"] as number | undefined) ?? items.length ?? 0,
	        ),
	        pages: Number((record?.["pages"] as number | undefined) ?? 0),
	        limit: Number(
	          (record?.["limit"] as number | undefined)
	            ?? params?.limit
	            ?? items.length
	            ?? 0,
	        ),
	        offset: Number(
	          (record?.["offset"] as number | undefined) ?? params?.offset ?? 0,
	        ),
	      };
	    }

	    const wrappedAuditors = getArrayProperty<Auditor>(data, "auditors");

	    // Backwards-compat: bare array of auditors
    if (Array.isArray(data)) {
      const items = data as Auditor[];
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

	    // Backwards-compat: wrapped object { auditors: Auditor[] }
	    if (wrappedAuditors) {
	      const items = wrappedAuditors;
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

    console.warn("Unexpected auditors response shape; returning empty list");
    return fallback;
  } catch (err) {
    console.error("Error fetching auditors (paginated):", err);
    return {
      items: [],
      total: 0,
      pages: 0,
      limit: params?.limit ?? 0,
      offset: params?.offset ?? 0,
    };
  }
}

// Get a specific auditor with details
export async function getAuditorById(
  projectId: string,
  auditorId: string
): Promise<AuditorDetail | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor/${auditorId}`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch auditor: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("Error fetching auditor:", err);
    return null;
  }
}

// Get all audit reports for an auditor
export async function getAuditReports(
  projectId: string,
  auditorId: string
): Promise<AuditReport[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor/${auditorId}/report`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`Failed to fetch audit reports: ${res.status}`);
    }

    const data = await res.json();

	    	// Handle direct array, wrapped object, or paginated envelope with items
	    	const paginatedItems = getArrayProperty<AuditReport>(data, "items");
	    	if (paginatedItems) {
	    	  return paginatedItems;
	    	}
	    	if (Array.isArray(data)) {
	    	  return data as AuditReport[];
	    	}
	    	const wrappedReports = getArrayProperty<AuditReport>(data, "reports");
	    	if (wrappedReports) {
	    	  return wrappedReports;
	    	}
	   	
	    	return [];
  } catch (err) {
    console.error("Error fetching audit reports:", err);
    return [];
  }
}

// Get audit reports for an auditor (paginated).
export async function getAuditReportsPaginated(
  projectId: string,
  auditorId: string,
  params?: { limit?: number; offset?: number },
): Promise<AuditReportListResponse> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const url = new URL(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor/${auditorId}/report`,
    );
    if (params?.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params?.offset !== undefined) url.searchParams.set("offset", String(params.offset));

    const res = await fetch(url.toString(), { headers, cache: "no-store" });

    const fallback: AuditReportListResponse = {
      items: [],
      total: 0,
      pages: 0,
      limit: params?.limit ?? 0,
      offset: params?.offset ?? 0,
    };

    if (!res.ok) {
      if (res.status === 404) {
        // No reports yet for this auditor.
        return fallback;
      }
      console.error("Failed to fetch audit reports:", res.status);
      return fallback;
    }

    const data = await res.json();

	    // Preferred shape: paginated envelope { items, total, pages, limit, offset }
	    const paginatedItems = getArrayProperty<AuditReport>(data, "items");
	    if (paginatedItems) {
	      const record = toRecord(data);
	      const items = paginatedItems;
	      return {
	        items,
	        total: Number(
	          (record?.["total"] as number | undefined) ?? items.length ?? 0,
	        ),
	        pages: Number((record?.["pages"] as number | undefined) ?? 0),
	        limit: Number(
	          (record?.["limit"] as number | undefined)
	            ?? params?.limit
	            ?? items.length
	            ?? 0,
	        ),
	        offset: Number(
	          (record?.["offset"] as number | undefined) ?? params?.offset ?? 0,
	        ),
	      };
	    }

    // Backwards-compat: bare array of reports
    if (Array.isArray(data)) {
      const items = data as AuditReport[];
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

	    const wrappedReports = getArrayProperty<AuditReport>(data, "reports");
	    // Backwards-compat: wrapped object { reports: AuditReport[] }
	    if (wrappedReports) {
	      const items = wrappedReports;
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

    console.warn("Unexpected audit reports response shape; returning empty list");
    return fallback;
  } catch (err) {
    console.error("Error fetching audit reports (paginated):", err);
    return {
      items: [],
      total: 0,
      pages: 0,
      limit: params?.limit ?? 0,
      offset: params?.offset ?? 0,
    };
  }
}

// Get a specific audit report
export async function getAuditReportById(
  projectId: string,
  auditorId: string,
  reportId: string
): Promise<AuditReportDetail | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor/${auditorId}/report/${reportId}`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch audit report: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("Error fetching audit report:", err);
    return null;
  }
}

// Create a new auditor
export async function createAuditor(
  projectId: string,
  auditorData: {
    name: string;
    description?: string;
    schedule?: string;
    is_active?: boolean;
    instructions: {
      requirements: Array<{
        id: string;
        title: string;
        description: string;
        context?: string;
        success_criteria?: string[];
        failure_criteria?: string[];
        weight?: number;
        [key: string]: JsonValue | undefined; // Flexible JSON object
      }>;
      passing_score: number;
    };
  }
): Promise<{ success: boolean; auditor?: Auditor; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(auditorData),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to create auditor: ${res.status}`,
      };
    }

    const auditor = await res.json();
    revalidatePath(`/projects/${projectId}`);
    return { success: true, auditor };
  } catch (err) {
    console.error("Error creating auditor:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Update an auditor
export async function updateAuditor(
  projectId: string,
  auditorId: string,
  auditorData: {
    name?: string;
    description?: string;
    schedule?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; auditor?: Auditor; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor/${auditorId}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(auditorData),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to update auditor: ${res.status}`,
      };
    }

    const auditor = await res.json();
    revalidatePath(`/projects/${projectId}`);
    return { success: true, auditor };
  } catch (err) {
    console.error("Error updating auditor:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Delete an auditor
export async function deleteAuditor(
  projectId: string,
  auditorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor/${auditorId}`,
      {
        method: "DELETE",
        headers,
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to delete auditor: ${res.status}`,
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Error deleting auditor:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Run an auditor manually
export async function runAuditor(
  projectId: string,
  auditorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/auditor/${auditorId}/run`,
      {
        method: "POST",
        headers,
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to run auditor: ${res.status}`,
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Error running auditor:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Get document tree/hierarchy for a project
export async function getDocumentTree(projectId: string): Promise<DocumentTreeResponse> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/document/tree`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      if (res.status === 404) {
        console.log("⚠️ Document tree endpoint returned 404");
        return { tree: [] };
      }
      throw new Error(`Failed to fetch document tree: ${res.status}`);
    }

    const data = (await res.json()) as DocumentTreeResponse;
    return data;
  } catch (err) {
    console.error("Error fetching document tree:", err);
    return { tree: [] };
  }
}

// Get full document with all evidence and collections
export async function getFullDocument(
  projectId: string,
  documentId: string
): Promise<FullDocumentResponse | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const url = `${API_BASE}/org/${orgId}/project/${projectId}/document/${documentId}/full`;
    console.log("📄 [getFullDocument] Fetching from:", url);

    const res = await fetch(url, { headers, cache: "no-store" });

    if (!res.ok) {
      if (res.status === 404) {
        console.log("⚠️ [getFullDocument] Endpoint returned 404");
        return null;
      }
      throw new Error(`Failed to fetch full document: ${res.status}`);
    }

    const data = (await res.json()) as FullDocumentResponse;
    console.log("📄 [getFullDocument] Response received:", {
      has_document: !!data.document,
      evidence_count: data.evidence?.length || 0,
      evidence_requests_count: data.evidence_requests?.length || 0,
      children_count: data.children?.length || 0,
      related_pages_count: data.related_pages?.length || 0,
    });

    return data;
  } catch (err) {
    console.error("❌ [getFullDocument] Error fetching full document:", err);
    return null;
  }
}

// Get all evidence for a project (project-wide Evidence Library).
// NOTE: Backend may return either a bare array, { evidence: [...] }, or a
// paginated-style envelope with { items, ... }. This helper normalizes all
// shapes to a simple Evidence[] for the UI.
export async function getProjectEvidence(projectId: string): Promise<Evidence[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const url = `${API_BASE}/org/${orgId}/project/${projectId}/evidence`;
    const res = await fetch(url, { headers, cache: "no-store" });

    if (!res.ok) {
      if (res.status === 404) {
        console.log("⚠️ [getProjectEvidence] Endpoint returned 404 - no evidence for project");
        return [];
      }
      throw new Error(`Failed to fetch project evidence: ${res.status}`);
    }

    const data = await res.json();

    if (!data) {
      return [];
    }

    if (Array.isArray(data)) {
      return data as Evidence[];
    }

	    const wrappedEvidence = getArrayProperty<Evidence>(data, "evidence");
	    if (wrappedEvidence) {
	      return wrappedEvidence;
	    }
	
	    const itemsEvidence = getArrayProperty<Evidence>(data, "items");
	    if (itemsEvidence) {
	      return itemsEvidence;
	    }

    console.warn("⚠️ [getProjectEvidence] Unexpected response shape; returning empty array", data);
    return [];
  } catch (err) {
    console.error("❌ [getProjectEvidence] Error fetching project evidence:", err);
    return [];
  }
}

// Get all evidence requests for a project (project-wide Evidence Library).
// Mirrors getProjectEvidence in shape-normalization.
export async function getProjectEvidenceRequests(
	projectId: string,
	params?: { q?: string },
): Promise<EvidenceRequest[]> {
	try {
		const orgId = await getOrganizationId();
		const headers = await getAuthHeaders();

			const url = new URL(
				`${API_BASE}/org/${orgId}/project/${projectId}/evidence-request`,
			);
			// Forward q exactly as provided so the backend can treat `?q=`
			// differently from the absence of q.
			if (params && "q" in params && params.q !== undefined) {
				url.searchParams.set("q", params.q);
			}

		const res = await fetch(url.toString(), { headers, cache: "no-store" });

		if (!res.ok) {
			if (res.status === 404) {
				console.log(
					"⚠️ [getProjectEvidenceRequests] Endpoint returned 404 - no evidence requests for project or no matches",
				);
				return [];
			}
			throw new Error(`Failed to fetch project evidence requests: ${res.status}`);
		}

		const data = await res.json();

		if (!data) {
			return [];
		}

		if (Array.isArray(data)) {
			return data as EvidenceRequest[];
		}

		const wrappedRequests = getArrayProperty<EvidenceRequest>(
			data,
			"evidence_requests",
		);
		if (wrappedRequests) {
			return wrappedRequests;
		}

		const itemsRequests = getArrayProperty<EvidenceRequest>(data, "items");
		if (itemsRequests) {
			return itemsRequests;
		}

		console.warn(
			"⚠️ [getProjectEvidenceRequests] Unexpected response shape; returning empty array",
			data,
		);
		return [];
	} catch (err) {
		console.error(
			"❌ [getProjectEvidenceRequests] Error fetching project evidence requests:",
			err,
		);
		return [];
	}
}

	// Get auditors that explicitly target a specific document.
	// NOTE: This complements getFullDocument and is used by DocumentationTab's
	// Assessment Objectives tab. Historically, that tab pulled SCF assessment
	// objectives via template_page_id and a public SCF endpoint; we now use
	// document-scoped auditors instead so the UI reflects the actual configured
	// auditors and their requirements for the page.
	export async function getDocumentAuditors(
	  projectId: string,
	  documentId: string
	): Promise<AuditorDetail[]> {
	  try {
	    const orgId = await getOrganizationId();
	    const headers = await getAuthHeaders();

	    const url = `${API_BASE}/org/${orgId}/project/${projectId}/document/${documentId}/auditor`;
	    console.log("📘 [getDocumentAuditors] Fetching auditors for document:", {
	      projectId,
	      documentId,
	      url,
	    });

	    const res = await fetch(url, { headers, cache: "no-store" });

	    if (!res.ok) {
	      if (res.status === 404) {
	        // No auditors are linked to this document yet.
	        console.log("⚠️ [getDocumentAuditors] Endpoint returned 404 - no auditors for document");
	        return [];
	      }
	      console.error("⚠️ [getDocumentAuditors] Failed to fetch document auditors:", res.status);
	      return [];
	    }

	    const data = await res.json();
	    let auditors: AuditorDetail[] = [];

	    // Backend may respond with a paginated envelope { items, ... }, a bare
	    // array of auditors, or a wrapped object { auditors: [...] }.
		    const paginatedItems = getArrayProperty<AuditorDetail>(data, "items");
		    const wrappedAuditors = getArrayProperty<AuditorDetail>(data, "auditors");
		
		    if (paginatedItems) {
		      auditors = paginatedItems;
		    } else if (Array.isArray(data)) {
		      auditors = data as AuditorDetail[];
		    } else if (wrappedAuditors) {
		      auditors = wrappedAuditors;
		    } else {
	      console.warn(
	        "⚠️ [getDocumentAuditors] Unexpected response shape; returning empty array",
	        data,
	      );
	      return [];
	    }

	    if (auditors.length > 0) {
	      console.log("📘 [getDocumentAuditors] First auditor sample:", {
	        object_id: auditors[0]?.object_id,
	        name: auditors[0]?.name,
	      });
	    }

	    return auditors;
	  } catch (err) {
	    console.error("❌ [getDocumentAuditors] Error fetching document auditors:", err);
	    return [];
	  }
	}

// Lightweight document search for project-scoped UIs (e.g. task creation).
// Uses the new /document?q=... endpoint which returns at most the top 5
// matches per query.
export async function searchProjectDocuments(
	projectId: string,
	params?: { q?: string },
): Promise<DocumentSummary[]> {
	try {
		const orgId = await getOrganizationId();
		const headers = await getAuthHeaders();

			const url = new URL(
				`${API_BASE}/org/${orgId}/project/${projectId}/document`,
			);
			// Forward q exactly as provided so the backend can apply its
			// own `hasQ` + trimming rules (including `?q=` for top-5).
			if (params && "q" in params && params.q !== undefined) {
				url.searchParams.set("q", params.q);
			}

		const res = await fetch(url.toString(), { headers, cache: "no-store" });

		if (!res.ok) {
			if (res.status === 404) {
				console.log(
					"⚠️ [searchProjectDocuments] Endpoint returned 404 - no documents for project or no matches",
				);
				return [];
			}
			throw new Error(`Failed to search project documents: ${res.status}`);
		}

		const data = await res.json();

		if (!data) {
			return [];
		}

		if (Array.isArray(data)) {
			return data as DocumentSummary[];
		}

		const items = getArrayProperty<DocumentSummary>(data, "items");
		if (items) {
			return items;
		}

		const docs = getArrayProperty<DocumentSummary>(data, "documents");
		if (docs) {
			return docs;
		}

		console.warn(
			"⚠️ [searchProjectDocuments] Unexpected response shape; returning empty array",
			data,
		);
		return [];
	} catch (err) {
		console.error(
			"❌ [searchProjectDocuments] Error searching project documents:",
			err,
		);
		return [];
	}
}


// ===== Project Tasks (CRUD) =====

export async function getProjectTasks(
	projectId: string,
	params?: {
		limit?: number;
		offset?: number;
		status?: string;
		priority?: string;
		q?: string;
	},
): Promise<ProjectTaskListResponse> {
	try {
		const orgId = await getOrganizationId();
		const headers = await getAuthHeaders();

			const url = new URL(`${API_BASE}/org/${orgId}/project/${projectId}/task`);
			if (params?.limit !== undefined) url.searchParams.set("limit", String(params.limit));
			if (params?.offset !== undefined) url.searchParams.set("offset", String(params.offset));
			if (params?.status) url.searchParams.set("status", params.status);
			if (params?.priority) url.searchParams.set("priority", params.priority);
			// If callers pass a q value at all (including the empty string),
			// propagate it so the backend can distinguish `?q=` from no `q`
			// and apply the new "top-5 when q is present" semantics.
			if (params && "q" in params && params.q !== undefined) {
				url.searchParams.set("q", params.q);
			}

		const res = await fetch(url.toString(), { headers, cache: "no-store" });

		const fallback: ProjectTaskListResponse = {
			items: [],
			total: 0,
			pages: 0,
			limit: params?.limit ?? 0,
			offset: params?.offset ?? 0,
		};

		if (!res.ok) {
	      if (res.status === 404) {
	        // No tasks for this project yet.
	        return fallback;
	      }
	      console.error("Failed to fetch project tasks:", res.status);
	      return fallback;
	    }

	    const data = await res.json();

		    // Preferred shape: paginated envelope { items, total, pages, limit, offset }
		    const paginatedItems = getArrayProperty<ApiProjectTask>(data, "items");
		    if (paginatedItems) {
		      const record = toRecord(data);
		      const items = paginatedItems;
		      return {
		        items,
		        total: Number(
		          (record?.["total"] as number | undefined) ?? items.length ?? 0,
		        ),
		        pages: Number((record?.["pages"] as number | undefined) ?? 0),
		        limit: Number(
		          (record?.["limit"] as number | undefined)
		            ?? params?.limit
		            ?? items.length
		            ?? 0,
		        ),
		        offset: Number(
		          (record?.["offset"] as number | undefined) ?? params?.offset ?? 0,
		        ),
		      };
		    }

		    const wrappedTasks = getArrayProperty<ApiProjectTask>(data, "tasks");
		    // Backwards-compat: bare array of tasks
	    if (Array.isArray(data)) {
	      const items = data as ApiProjectTask[];
	      const limit = params?.limit ?? items.length;
	      const offset = params?.offset ?? 0;
	      const total = items.length;
	      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
	      return { items, total, pages, limit, offset };
	    }

		    // Backwards-compat: wrapped object { tasks: ApiProjectTask[] }
		    if (wrappedTasks) {
		      const items = wrappedTasks;
	      const limit = params?.limit ?? items.length;
	      const offset = params?.offset ?? 0;
	      const total = items.length;
	      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
	      return { items, total, pages, limit, offset };
	    }

	    console.warn("Unexpected project tasks response shape; returning empty list");
	    return fallback;
	  } catch (err) {
	    console.error("Error fetching project tasks:", err);
	    return {
	      items: [],
	      total: 0,
	      pages: 0,
	      limit: params?.limit ?? 0,
	      offset: params?.offset ?? 0,
	    };
	  }
}

export interface CreateProjectTaskRequest {
	  title: string;
	  description?: string;
	  status?: ProjectTaskStatusApi;
	  priority?: ProjectTaskPriorityApi;
	  due_date?: string;
	  document_id?: number;
	  evidence_request_id?: number;
	  // Optional metadata supported by the backend; safe to omit from calls.
	  notes?: string;
	  depends_on_task_id?: string;
	}

export interface UpdateProjectTaskRequest {
	  title?: string;
	  description?: string;
	  status?: ProjectTaskStatusApi;
	  priority?: ProjectTaskPriorityApi;
	  due_date?: string | null;
	  document_id?: number | null;
	  evidence_request_id?: number | null;
	  // Optional metadata supported by the backend; safe to omit from calls.
	  notes?: string | null;
	  depends_on_task_id?: string | null;
	}

export async function createProjectTask(
	  projectId: string,
	  taskData: CreateProjectTaskRequest,
): Promise<{ success: boolean; task?: ApiProjectTask; error?: string }> {
	  try {
	    const orgId = await getOrganizationId();
	    const headers = await getAuthHeaders();

	    const res = await fetch(
	      `${API_BASE}/org/${orgId}/project/${projectId}/task`,
	      {
	        method: "POST",
	        headers,
	        body: JSON.stringify(taskData),
	      },
	    );

	    if (!res.ok) {
	      const errorData = await res.json().catch(() => ({}));
	      return {
	        success: false,
	        error:
	          (errorData as { error?: string }).error ||
	          `Failed to create task: ${res.status}`,
	      };
	    }

	    const task = (await res.json()) as ApiProjectTask;

	    // Revalidate project detail so any server-rendered bits stay in sync.
	    revalidatePath(`/projects/${projectId}`);

	    return { success: true, task };
	  } catch (err) {
	    console.error("Error creating project task:", err);
	    return {
	      success: false,
	      error: err instanceof Error ? err.message : "Failed to create task",
	    };
	  }
}

export async function updateProjectTask(
	  projectId: string,
	  taskId: string,
	  taskData: UpdateProjectTaskRequest,
): Promise<{ success: boolean; task?: ApiProjectTask; error?: string }> {
	  try {
	    const orgId = await getOrganizationId();
	    const headers = await getAuthHeaders();

	    const res = await fetch(
	      `${API_BASE}/org/${orgId}/project/${projectId}/task/${taskId}`,
	      {
	        method: "PUT",
	        headers,
	        body: JSON.stringify(taskData),
	      },
	    );

	    if (!res.ok) {
	      const errorData = await res.json().catch(() => ({}));
	      return {
	        success: false,
	        error:
	          (errorData as { error?: string }).error ||
	          `Failed to update task: ${res.status}`,
	      };
	    }

	    const task = (await res.json()) as ApiProjectTask;

	    revalidatePath(`/projects/${projectId}`);

	    return { success: true, task };
	  } catch (err) {
	    console.error("Error updating project task:", err);
	    return {
	      success: false,
	      error: err instanceof Error ? err.message : "Failed to update task",
	    };
	  }
}

export async function deleteProjectTask(
	  projectId: string,
	  taskId: string,
): Promise<{ success: boolean; error?: string }> {
	  try {
	    const orgId = await getOrganizationId();
	    const headers = await getAuthHeaders();

	    const res = await fetch(
	      `${API_BASE}/org/${orgId}/project/${projectId}/task/${taskId}`,
	      {
	        method: "DELETE",
	        headers,
	      },
	    );

	    if (!res.ok) {
	      const errorData = await res.json().catch(() => ({}));
	      return {
	        success: false,
	        error:
	          (errorData as { error?: string }).error ||
	          `Failed to delete task: ${res.status}`,
	      };
	    }

	    revalidatePath(`/projects/${projectId}`);
	    return { success: true };
	  } catch (err) {
	    console.error("Error deleting project task:", err);
	    return {
	      success: false,
	      error: err instanceof Error ? err.message : "Failed to delete task",
	    };
	  }
}

// ===== AI Agents =====

// Get all agents for a project
export async function getAgents(projectId: string): Promise<Agent[]> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/agent`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      if (res.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch agents: ${res.status}`);
    }

    const data = await res.json();

    // Handle both direct array and wrapped object responses
    if (Array.isArray(data)) {
      return data;
    } else if (data && typeof data === 'object' && 'agents' in data && Array.isArray(data.agents)) {
      return data.agents;
    }

    return [];
  } catch (err) {
    console.error("Error fetching agents:", err);
    return [];
  }
}

// Get a specific agent with details
export async function getAgentById(
  projectId: string,
  agentId: string
): Promise<AgentDetail | null> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/agent/${agentId}`,
      { headers, cache: "no-store" }
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch agent: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("Error fetching agent:", err);
    return null;
  }
}

// Create a new agent
export async function createAgent(
  projectId: string,
  agentData: {
    name: string;
    description?: string;
    data_sources: string[];
    instructions: string;
    output_format: string;
    schedule?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; agent?: Agent; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/agent`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(agentData),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to create agent: ${res.status}`,
      };
    }

    const agent = await res.json();
    revalidatePath(`/projects/${projectId}`);
    return { success: true, agent };
  } catch (err) {
    console.error("Error creating agent:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Update an agent
export async function updateAgent(
  projectId: string,
  agentId: string,
  agentData: {
    name?: string;
    description?: string;
    data_sources?: string[];
    instructions?: string;
    output_format?: string;
    schedule?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; agent?: Agent; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/agent/${agentId}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(agentData),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to update agent: ${res.status}`,
      };
    }

    const agent = await res.json();
    revalidatePath(`/projects/${projectId}`);
    return { success: true, agent };
  } catch (err) {
    console.error("Error updating agent:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// Delete an agent
export async function deleteAgent(
  projectId: string,
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const res = await fetch(
      `${API_BASE}/org/${orgId}/project/${projectId}/agent/${agentId}`,
      {
        method: "DELETE",
        headers,
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to delete agent: ${res.status}`,
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Error deleting agent:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
