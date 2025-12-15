// Project type definitions

	export type JsonValue =
	  | string
	  | number
	  | boolean
	  | null
	  | JsonValue[]
	  | { [key: string]: JsonValue }
	  | object;


export interface ProjectDataSource {
  type: 'codebase' | 'user' | 'document';
  id: string;
  name: string;
}

export interface ProjectTask {
	id: string;
	title: string;
	description: string;
	// NOTE: taskType/author/assignment are optional so backend-created tasks can
	// still be shown even if they don't carry this richer UI metadata yet.
	taskType?: 'missing-data' | 'documentation-issue' | 'evidence-request' | 'security-issue';
	author?: {
	  name?: string;
	  role?: string; // e.g., "SOC2 General Auditor", "Security Team"
	  type?: 'ai' | 'human';
	};
		status: 'todo' | 'in-progress' | 'stuck' | 'completed';
	priority: 'low' | 'medium' | 'high' | 'critical';
	linkedEvidenceRequestId?: string; // For evidence-request tasks
	linkedDocumentPageId?: string; // For documentation-issue tasks
	assignedTo?: string;
	dueDate?: string;
		createdAt: string;
		// Optional backend-linked relationships for richer detail views.
		// documentId/evidenceRequestId come from ApiProjectTask.document_id /
		// ApiProjectTask.evidence_request_id when available.
		documentId?: number;
		evidenceRequestId?: number;
		// Optional last-updated timestamp from the backend task record.
		updatedAt?: string;
		notes?: string;
		dependsOnTaskId?: string;
		// Resolution metadata is currently UI-only and derived when a task is
		// marked completed from the Task Detail modal.
		resolutionReason?: string; // Reason why task was resolved (UI-only for now)
		resolutionDate?: string; // When task was resolved (UI-only for now)
}

export interface EvidenceCollection {
  object_id: string;
  name: string;
  type: string;
  content: JsonValue;
  sources: JsonValue[];
}

export interface Evidence {
  object_id: string;
  name: string;
  value_type: string;
  value?: JsonValue;
  collection?: EvidenceCollection;
}

export interface EvidenceRequest {
  object_id: string;
  title: string;
  status: string;
  due_date?: string;
  // Optional detailed description of what this request is asking for.
  // Backend may omit this, so treat as best-effort context for the UI.
  description?: string;
}

export type PageKind =
  | "overview"
  | "domain"
  | "control"
  | "risk"
  | "threat"
  | "risks_overview"
  | "threats_overview"
  | "other";

export interface FrameworkMapping {
  framework: string;
  external_ids: string[];
}

export interface RelatedPageSummary {
  object_id: string;
  template_page_id?: string | null;
  title: string;
  status?: string | null;
  page_kind?: PageKind;
  is_control?: boolean;
  relation_type?: string;
}

export interface DocumentPage {
  id: string;
  title: string;
  content: string; // Markdown content
  order: number;
  children?: DocumentPage[];
  createdAt: string;
  updatedAt: string;
  // For real documents (non-template)
  status?: string;
  evidence?: Evidence[];
  evidenceRequests?: EvidenceRequest[];
  // Optional SCF/SCF-like metadata when this page is backed by a real document
  // instance from the backend. Template-only pages may omit these.
  page_kind?: PageKind;
  is_control?: boolean;
  // Related pages (e.g., risks/threats linked to a control) hydrated from
  // the /document/:document_id/full endpoint.
  relatedPages?: RelatedPageSummary[];
  // SCF control metadata (for control pages)
  scf_id?: string;
  frameworks?: string[];
  framework_mappings?: FrameworkMapping[];
  // Relevance score for this document in the project context (0-100)
  relevance_score?: number;
}

export interface DocumentTreeNode {
  object_id: string;
  title: string;
  content?: string;
  status?: string;
  order?: number;
  children?: DocumentTreeNode[];
  // Optional timestamps from the backend tree response
  created_at?: string;
  updated_at?: string;
}

export interface DocumentTreeResponse {
	tree: DocumentTreeNode[];
}

// Lightweight document summary used by search-oriented endpoints
// (e.g. /document?q=...) where we only need a few top candidates.
export interface DocumentSummary {
	object_id: string;
	title: string;
	status?: string;
	order?: number;
}

export interface FullDocumentResponse {
  document?: {
    object_id: string;
    title: string;
    status?: string;
    version?: string | number;
    // SCF control metadata (for control documents)
    scf_id?: string;
    frameworks?: string[];
    framework_mappings?: FrameworkMapping[];
    // Template page reference
    template_page_id?: string;
    // Page metadata
    page_kind?: PageKind;
    is_control?: boolean;
    // Relevance score for this document in the project context (0-100)
    relevance_score?: number;
    [key: string]: unknown;
  } | null;
  evidence?: Evidence[];
  evidence_requests?: EvidenceRequest[];
  children?: DocumentTreeNode[];
  // New related_pages field provides concise links between control/risk/threat
  // documents so the frontend can surface "Related Pages" context.
  related_pages?: RelatedPageSummary[];
}

export interface Project {
	id: string;
	name: string;
	description: string;
	status: 'initializing' | 'active' | 'up-to-date' | 'out-of-date' | 'audit-ready' | 'completed' | 'on-hold';
	complianceScore: number; // 0-100
	dataSources: ProjectDataSource[];
	tasks: ProjectTask[];
	agentTasks: AgentTask[];
	documentation: DocumentPage[];
	createdAt: string;
	updatedAt: string;
}

// NOTE: The historical 'policies' project tab has been removed in favor of a
// project-wide 'evidence-library' tab that surfaces all evidence and evidence
// requests associated with the project.
export type ProjectTab =
	| 'action'
	| 'agent-tasks'
	| 'documentation'
	| 'evidence-library'
	| 'reports'
	| 'data-sources';

// Project Templates
export type PolicyCategory = 'Security' | 'Privacy' | 'Compliance' | 'Operations' | 'Legal';

export interface PolicyTemplate {
  id: string;
  title: string;
  description: string;
  content: string; // Markdown content
  category: PolicyCategory;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
  createdAt: string;
}

export interface ProjectTemplateDetail extends ProjectTemplate {
  documentation: DocumentPage[];
  policies: PolicyTemplate[];
}

export interface AgentTaskNodeData {
  label?: string;
  status?: string;
  type?: string;
  optional?: boolean;
  condition?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface AgentTaskNode {
  id: string;
  name: string;
  type: 'start' | 'analysis' | 'decision' | 'action' | 'end' | 'condition' | 'parallel';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  data?: AgentTaskNodeData;
  optional?: boolean; // Whether this node can be skipped
  condition?: string; // Condition for conditional nodes
  position?: { x: number; y: number }; // Custom positioning for complex flows
}

export interface AgentTaskEdge {
  id: string;
  source: string;
  target: string;
  label?: string; // For conditional edges (e.g., "Yes", "No", "If critical issues found")
  condition?: string; // Condition for this edge to be taken
  type?: 'default' | 'conditional' | 'parallel';
}

export interface AgentTaskRun {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  duration?: number; // in seconds
  findings?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: 'analysis' | 'scan' | 'report' | 'remediation';
  progress: number; // 0-100
  lastRunAt?: string;
  startedAt?: string;
  completedAt?: string;
  result?: string; // Result summary or error message
  findings?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  nodes?: AgentTaskNode[]; // Workflow nodes
  edges?: AgentTaskEdge[]; // Workflow edges (connections between nodes)
  runHistory?: AgentTaskRun[]; // Recent runs
  trigger?: 'manual' | 'scheduled' | 'event'; // How the task is triggered
  schedule?: string; // Cron expression if scheduled
}

// ===== AI Agents =====
export interface Agent {
  object_id: string;
  name: string;
  description: string;
  data_sources: string[]; // List of data source identifiers
  instructions: string; // Agent instructions/prompt
  output_format: string; // Desired output format
  schedule: string; // Cron expression for scheduling
  is_active: boolean;
  last_run_at?: string;
  last_status?: string;
  run_count?: number;
  created_at?: string;
  updated_at?: string;
}

export type AgentDetail = Agent;

