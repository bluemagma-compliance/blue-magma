"use server";

import { API_BASE } from "@/config/api";

// ============================================================================
// SCF Mapping Types
// ============================================================================

export interface SCFMapping {
  id: number;
  framework: string;
  external_id: string;
  external_name: string;
  external_description: string;
  strm_relationship: string;
  strm_rationale: string;
  strength: number;
  notes: string;
  scf_object_id: string;
  scf_control_title: string;
}

export interface SCFMappingListResponse {
  items: SCFMapping[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

export interface SCFControl {
  id: number;
  object_id: string;
  domain: string;
  title: string;
  cadence: string;
  weight: number;
  // Coverage flags
  covers_hipaa?: boolean;
  covers_soc2?: boolean;
  covers_gdpr?: boolean;
  covers_iso27001?: boolean;
  covers_iso42001?: boolean;
  covers_nist_csf?: boolean;
  covers_nist_ai_rmf?: boolean;
  // Core flags
  is_core_lvl0?: boolean;
  is_core_lvl1?: boolean;
  is_core_lvl2?: boolean;
  is_core_ai_ops?: boolean;
  is_mcr?: boolean;
  is_dsr?: boolean;
  // Summaries
  risk_threat_summary?: string;
  control_threat_summary?: string;
  // New fields
  control_description?: string;
  micro_small_solutions?: string;
  // Full original SCF record (preserved)
  data: Record<string, unknown>;
}

export interface SCFListResponse {
  items: SCFControl[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

export async function getSCFControls(params?: {
  q?: string;
  domain?: string;
  cadence?: string;
  limit?: number;
  offset?: number;
  // Coverage flags (server-side filtering)
  covers_hipaa?: boolean;
  covers_soc2?: boolean;
  covers_gdpr?: boolean;
  covers_iso27001?: boolean;
  covers_iso42001?: boolean;
  covers_nist_csf?: boolean;
  covers_nist_ai_rmf?: boolean;
  // Core flags
  is_core_lvl0?: boolean;
  is_core_lvl1?: boolean;
  is_core_lvl2?: boolean;
  is_core_ai_ops?: boolean;
  is_mcr?: boolean;
  is_dsr?: boolean;
}): Promise<SCFListResponse> {
  try {
    const url = new URL(`${API_BASE}/public/frameworks/scf`);

    if (params) {
      if (params.q) url.searchParams.set("q", params.q);
      if (params.domain) url.searchParams.set("domain", params.domain);
      if (params.cadence) url.searchParams.set("cadence", params.cadence);
      if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
      if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
      // Coverage flag filters (only include when true)
      if (params.covers_hipaa) url.searchParams.set("covers_hipaa", "true");
      if (params.covers_soc2) url.searchParams.set("covers_soc2", "true");
      if (params.covers_gdpr) url.searchParams.set("covers_gdpr", "true");
      if (params.covers_iso27001) url.searchParams.set("covers_iso27001", "true");
      if (params.covers_iso42001) url.searchParams.set("covers_iso42001", "true");
      if (params.covers_nist_csf) url.searchParams.set("covers_nist_csf", "true");
      if (params.covers_nist_ai_rmf) url.searchParams.set("covers_nist_ai_rmf", "true");
      // Core flags
      if (params.is_core_lvl0) url.searchParams.set("is_core_lvl0", "true");
      if (params.is_core_lvl1) url.searchParams.set("is_core_lvl1", "true");
      if (params.is_core_lvl2) url.searchParams.set("is_core_lvl2", "true");
      if (params.is_core_ai_ops) url.searchParams.set("is_core_ai_ops", "true");
      if (params.is_mcr) url.searchParams.set("is_mcr", "true");
      if (params.is_dsr) url.searchParams.set("is_dsr", "true");
    }

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      // Public endpoint returns { error: string } on failures
      const err = await res.json().catch(() => ({}));
      console.error("Failed to fetch SCF controls:", res.status, err?.error);
      return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
    }

    const data = await res.json();

    // New API shape with pagination metadata
    if (data && typeof data === "object" && Array.isArray(data.items)) {
      return {
        items: data.items as SCFControl[],
        total: Number(data.total ?? 0),
        pages: Number(data.pages ?? 0),
        limit: Number(data.limit ?? params?.limit ?? 0),
        offset: Number(data.offset ?? params?.offset ?? 0),
      };
    }

    // Fallback: older API shape returned a bare array
    if (Array.isArray(data)) {
      const items = data as SCFControl[];
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

    // Unknown shape
    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  } catch (e) {
    console.error("Error fetching SCF controls:", e);
    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  }
}


export async function getAllSCFControls(): Promise<SCFControl[]> {
  const chunk = 500; // max per page
  let offset = 0;
  const all: SCFControl[] = [];
  // Safety cap on iterations
  for (let i = 0; i < 100; i++) {
    const resp = await getSCFControls({ limit: chunk, offset });
    const arr = resp.items ?? [];
    if (arr.length === 0) break;
    all.push(...arr);
    const total = Number(resp.total ?? 0);
    if (total && all.length >= total) break;
    offset += arr.length;
    // If returned fewer than requested and no total, likely last page
    if (arr.length < (resp.limit || chunk)) break;
  }
  return all;
}


// ============================================================================
// SCF Mappings API
// ============================================================================

/**
 * Fetch SCF framework mappings (relationships between external controls and SCF controls)
 */
export async function getSCFMappings(params?: {
  framework?: string;
  external_id?: string;
  scf_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<SCFMappingListResponse> {
  try {
    const url = new URL(`${API_BASE}/public/frameworks/scf/maps`);

    if (params) {
      if (params.framework) url.searchParams.set("framework", params.framework);
      if (params.external_id) url.searchParams.set("external_id", params.external_id);
      if (params.scf_id) url.searchParams.set("scf_id", params.scf_id);
      if (params.q) url.searchParams.set("q", params.q);
      if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
      if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Failed to fetch SCF mappings:", res.status, err?.error);
      return { items: [], total: 0, pages: 0, limit: params?.limit ?? 50, offset: params?.offset ?? 0 };
    }

    const data = await res.json();

    if (data && typeof data === "object" && Array.isArray(data.items)) {
      return {
        items: data.items as SCFMapping[],
        total: Number(data.total ?? 0),
        pages: Number(data.pages ?? 0),
        limit: Number(data.limit ?? params?.limit ?? 50),
        offset: Number(data.offset ?? params?.offset ?? 0),
      };
    }

    // Fallback
    if (Array.isArray(data)) {
      const items = data as SCFMapping[];
      return {
        items,
        total: items.length,
        pages: 1,
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
      };
    }

    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 50, offset: params?.offset ?? 0 };
  } catch (error) {
    console.error("Error fetching SCF mappings:", error);
    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 50, offset: params?.offset ?? 0 };
  }
}

/**
 * Fetch all mappings for a specific framework by looping through pages
 */
export async function getAllSCFMappingsForFramework(framework: string): Promise<SCFMapping[]> {
  const allMappings: SCFMapping[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const response = await getSCFMappings({ framework, limit, offset });
    allMappings.push(...response.items);

    if (response.items.length < limit) {
      break;
    }
    offset += limit;
  }

  return allMappings;
}



// =============================================================================
// SCF Risk Catalog API
// =============================================================================

export interface SCFRisk {
  id: number;
  object_id: string;
  grouping: string;
  title: string;
  description: string;
  nist_function: string;
  materiality: string;
}

export interface SCFRiskListResponse {
  items: SCFRisk[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

export async function getSCFRisks(params?: {
  q?: string;
  grouping?: string;
  nistFunction?: string;
  limit?: number;
  offset?: number;
}): Promise<SCFRiskListResponse> {
  try {
    const url = new URL(`${API_BASE}/public/frameworks/scf/risks`);

    if (params) {
      if (params.q) url.searchParams.set("q", params.q);
      if (params.grouping) url.searchParams.set("grouping", params.grouping);
      // Backend uses ?function= for NIST function; avoid TS keyword "function" in params.
      if (params.nistFunction) url.searchParams.set("function", params.nistFunction);
      if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
      if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
    }

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Failed to fetch SCF risks:", res.status, err?.error);
      return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
    }

    const data = await res.json();

    if (data && typeof data === "object" && Array.isArray(data.items)) {
      return {
        items: data.items as SCFRisk[],
        total: Number(data.total ?? 0),
        pages: Number(data.pages ?? 0),
        limit: Number(data.limit ?? params?.limit ?? 0),
        offset: Number(data.offset ?? params?.offset ?? 0),
      };
    }

    if (Array.isArray(data)) {
      const items = data as SCFRisk[];
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  } catch (e) {
    console.error("Error fetching SCF risks:", e);
    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  }
}

export async function getAllSCFRisks(): Promise<SCFRisk[]> {
  const chunk = 500;
  let offset = 0;
  const all: SCFRisk[] = [];
  for (let i = 0; i < 100; i++) {
    const resp = await getSCFRisks({ limit: chunk, offset });
    const arr = resp.items ?? [];
    if (arr.length === 0) break;
    all.push(...arr);
    const total = Number(resp.total ?? 0);
    if (total && all.length >= total) break;
    offset += arr.length;
    if (arr.length < (resp.limit || chunk)) break;
  }
  return all;
}


// =============================================================================
// SCF Threat Catalog API
// =============================================================================

export interface SCFThreat {
  id: number;
  object_id: string;
  grouping: string;
  title: string;
  description: string;
  materiality: string;
}

export interface SCFThreatListResponse {
  items: SCFThreat[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

export async function getSCFThreats(params?: {
  q?: string;
  grouping?: string;
  limit?: number;
  offset?: number;
}): Promise<SCFThreatListResponse> {
  try {
    const url = new URL(`${API_BASE}/public/frameworks/scf/threats`);

    if (params) {
      if (params.q) url.searchParams.set("q", params.q);
      if (params.grouping) url.searchParams.set("grouping", params.grouping);
      if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
      if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
    }

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Failed to fetch SCF threats:", res.status, err?.error);
      return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
    }

    const data = await res.json();

    if (data && typeof data === "object" && Array.isArray(data.items)) {
      return {
        items: data.items as SCFThreat[],
        total: Number(data.total ?? 0),
        pages: Number(data.pages ?? 0),
        limit: Number(data.limit ?? params?.limit ?? 0),
        offset: Number(data.offset ?? params?.offset ?? 0),
      };
    }

    if (Array.isArray(data)) {
      const items = data as SCFThreat[];
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  } catch (e) {
    console.error("Error fetching SCF threats:", e);
    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  }
}

export async function getAllSCFThreats(): Promise<SCFThreat[]> {
  const chunk = 500;
  let offset = 0;
  const all: SCFThreat[] = [];
  for (let i = 0; i < 100; i++) {
    const resp = await getSCFThreats({ limit: chunk, offset });
    const arr = resp.items ?? [];
    if (arr.length === 0) break;
    all.push(...arr);
    const total = Number(resp.total ?? 0);
    if (total && all.length >= total) break;
    offset += arr.length;
    if (arr.length < (resp.limit || chunk)) break;
  }
  return all;
}

// =============================================================================
// SCF Assessment Objectives Catalog API
// =============================================================================

export interface SCFAssessmentObjective {
  id: number;
  object_id: string;
  statement: string;
  origin: string;
  // Newline-separated SCF control IDs this objective maps to.
  control_mappings: string;
  // Whether this objective is part of the SCF baseline.
  is_scf_baseline?: boolean;
}

export interface SCFAssessmentObjectiveListResponse {
  items: SCFAssessmentObjective[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

export async function getSCFAssessmentObjectives(params?: {
  q?: string;
  control?: string;
  baseline?: boolean;
  origin?: string;
  limit?: number;
  offset?: number;
}): Promise<SCFAssessmentObjectiveListResponse> {
  try {
    const url = new URL(`${API_BASE}/public/frameworks/scf/assessment-objectives`);

    if (params) {
      if (params.q) url.searchParams.set("q", params.q);
      if (params.control) url.searchParams.set("control", params.control);
      if (params.origin) url.searchParams.set("origin", params.origin);
      if (params.baseline) url.searchParams.set("baseline", "true");
      if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
      if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
    }

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Failed to fetch SCF assessment objectives:", res.status, err?.error);
      return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
    }

    const data = await res.json();

    if (data && typeof data === "object" && Array.isArray(data.items)) {
      return {
        items: data.items as SCFAssessmentObjective[],
        total: Number(data.total ?? 0),
        pages: Number(data.pages ?? 0),
        limit: Number(data.limit ?? params?.limit ?? 0),
        offset: Number(data.offset ?? params?.offset ?? 0),
      };
    }

    if (Array.isArray(data)) {
      const items = data as SCFAssessmentObjective[];
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  } catch (e) {
    console.error("Error fetching SCF assessment objectives:", e);
    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  }
}

export async function getAllSCFAssessmentObjectives(): Promise<SCFAssessmentObjective[]> {
  const chunk = 500;
  let offset = 0;
  const all: SCFAssessmentObjective[] = [];
  for (let i = 0; i < 100; i++) {
    const resp = await getSCFAssessmentObjectives({ limit: chunk, offset });
    const arr = resp.items ?? [];
    if (arr.length === 0) break;
    all.push(...arr);
    const total = Number(resp.total ?? 0);
    if (total && all.length >= total) break;
    offset += arr.length;
    if (arr.length < (resp.limit || chunk)) break;
  }
  return all;
}

// =============================================================================
// SCF Evidence Request Catalog API
// =============================================================================

export interface SCFEvidenceRequest {
  id: number;
  object_id: string;
  area_of_focus: string;
  artifact: string;
  description: string;
  // Newline-separated SCF control IDs this evidence request maps to.
  control_mappings: string;
}

export interface SCFEvidenceRequestListResponse {
  items: SCFEvidenceRequest[];
  total: number;
  pages: number;
  limit: number;
  offset: number;
}

export async function getSCFEvidenceRequests(params?: {
  q?: string;
  control?: string;
  origin?: string;
  area_of_focus?: string;
  limit?: number;
  offset?: number;
}): Promise<SCFEvidenceRequestListResponse> {
  try {
    const url = new URL(`${API_BASE}/public/frameworks/scf/evidence-requests`);

    if (params) {
      if (params.q) url.searchParams.set("q", params.q);
      if (params.control) url.searchParams.set("control", params.control);
      if (params.origin) url.searchParams.set("origin", params.origin);
      if (params.area_of_focus) url.searchParams.set("area_of_focus", params.area_of_focus);
      if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
      if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));
    }

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Failed to fetch SCF evidence requests:", res.status, err?.error);
      return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
    }

    const data = await res.json();

    if (data && typeof data === "object" && Array.isArray(data.items)) {
      return {
        items: data.items as SCFEvidenceRequest[],
        total: Number(data.total ?? 0),
        pages: Number(data.pages ?? 0),
        limit: Number(data.limit ?? params?.limit ?? 0),
        offset: Number(data.offset ?? params?.offset ?? 0),
      };
    }

    if (Array.isArray(data)) {
      const items = data as SCFEvidenceRequest[];
      const limit = params?.limit ?? items.length;
      const offset = params?.offset ?? 0;
      const total = items.length;
      const pages = limit > 0 ? Math.ceil(total / limit) : 1;
      return { items, total, pages, limit, offset };
    }

    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  } catch (e) {
    console.error("Error fetching SCF evidence requests:", e);
    return { items: [], total: 0, pages: 0, limit: params?.limit ?? 0, offset: params?.offset ?? 0 };
  }
}

export async function getAllSCFEvidenceRequests(): Promise<SCFEvidenceRequest[]> {
  const chunk = 500;
  let offset = 0;
  const all: SCFEvidenceRequest[] = [];
  for (let i = 0; i < 100; i++) {
    const resp = await getSCFEvidenceRequests({ limit: chunk, offset });
    const arr = resp.items ?? [];
    if (arr.length === 0) break;
    all.push(...arr);
    const total = Number(resp.total ?? 0);
    if (total && all.length >= total) break;
    offset += arr.length;
    if (arr.length < (resp.limit || chunk)) break;
  }
  return all;
}
