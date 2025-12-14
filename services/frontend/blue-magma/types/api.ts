// API Response Types based on backend models

export interface Organization {
  billing_email?: string;
  credits?: number;
  current_plan?: string;
  monthly_cost: number;
  next_billing_date: string;
  object_id: string;
  onboard_status?: string;
  organization_address?: string;
  organization_city?: string;
  organization_country?: string;
  organization_description: string;
  organization_name: string;
  organization_postal_code?: string;
  organization_state?: string;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
  stripe_subscription_id?: string;
  subscription_status?: SubscriptionStatus;
  // Partners flag comes from the backend Organization model. It is used to
  // control access to partner-only functionality and pricing (e.g., special
  // Stripe prices with lookup_key="partners").
  partners?: boolean;
  // Cumulative credit movement tracking from the backend. These are updated
  // only by the dedicated add/subtract credits endpoints and surfaced on the
  // billing page for lifetime stats.
  total_credits_added?: number;
  total_credits_subtracted?: number;
  updated_at: string;
}

export interface User {
  id: number;
  object_id: string;
  name: string; // FirstName in backend
  surname: string; // LastName in backend
  username: string;
  phone: string;
  email: string;
  role: string;
  is_owner: boolean;
  organization_id: number;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserOverview {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface RuleAssignment {
  object_id: string;
  rule: {
    Public: boolean;
    createdAt: string;
    deletedAt?: {
      time: string;
      valid: boolean;
    };
    description: string;
    evidence_schema: number[];
    id: number;
    name: string;
    object_id: string;
    organization: Organization;
    organization_id: number;
    policy_name: string;
    policy_version: string;
    rule: string;
    scope: string;
    source: string;
    tags: string;
    updatedAt: string;
  };
}

export interface CodebaseVersion {
  object_id: string;
  branch_name: string;
  commit_hash: string;
  summary: string;
}

export type CodebaseSourceType = "manual" | "github";

export interface Codebase {
  object_id: string;
  codebase_name: string;
  codebase_repo_url: string;
  codebase_description: string;
  codebase_type?: string;
  source_type: CodebaseSourceType;
  api_key?: string;
  rule_assignments: RuleAssignment[];
  versions: CodebaseVersion[];
}

export interface SubjectType {
  id: number;
  object_id: string;
  name: string;
  description: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: {
    time: string;
    valid: boolean;
  };
}

export interface Rule {
  id: number;
  object_id: string;
  organization_id: number;
  rule_name: string;
  rule_description: string;
  rule_type: string;
  rule_severity: string;
  rule_category: string;
  rule_content: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleAssignment {
  id: number;
  object_id: string;
  organization_id: number;
  rule_id: number;
  codebase_id: number;
  created_at: string;
  updated_at: string;
}

export interface FoundProperty {
  is_issue: boolean;
  issue_severity: string;
  key: string;
  object_id: string;
  organization_id: string;
  property_type: string;
  question_id: string;
  value: string;
}

export interface Question {
  object_id: string;
  organization_id: string;
  question: string;
  answer?: string;
  found_properties?: FoundProperty[];
}

export interface Ruling {
  object_id: string;
  organization_id: string;
  rule_id: string;
  decision: string;
  reasoning: string;
  level: string; // severity level
  status: string;
  questions?: Question[];
  // Rule information (when available from detailed fetch)
  rule?: {
    object_id: string;
    name: string;
    rule: string; // The actual rule text
    description: string;
    policy_name: string;
    policy_version: string;
    scope: string;
    tags: string;
    source: string;
    severity: string;
    section: string;
  };
}

export interface APIKey {
  id: number;
  object_id: string;
  organization_id: number;
  key: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// Frontend-specific types for dashboard data
export interface DashboardMetrics {
  totalCodebases: number;
  averageComplianceScore: number;
  codebasesNeedingAttention: number;
  compliancePercentage: number;
  totalIssues: number;
  activeScans: number;
}

export interface CodebaseHealth {
  id: string;
  name: string;
  version: string;
  lastScanDate: string;
  status: "Good Standing" | "Needs Review" | "Non-Compliant" | "Scanning";
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  trend: "improving" | "stable" | "declining" | "new";
  healthScore: number;
  type: "frontend" | "backend" | "application" | "infrastructure";
}

export interface RecentReport {
  id: string;
  codebaseName?: string;
  deploymentName?: string;
  version: string;
  date: string;
  status: "Completed" | "Failed" | "Running" | "Pending" | "Passed";
  summary: string;
  codebaseId?: string;
  deploymentId?: string;
  type: "codebase" | "deployment";
}

export interface Issue {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  reportId: string;
  reportLink: string;
}

export interface CodebaseWithIssues {
  id: string;
  name: string;
  version: string;
  status: string;
  issues: Issue[];
}

export interface ReportSection {
  object_id: string;
  name: string;
  description: string;
  report_id: string;
  rulings?: Ruling[];
}

export interface ActionableItem {
  object_id: string;
  ruling_id: string;
  title: string;
  description: string;
  severity: string;
  priority: string;
  problem_type: string;
  proposed_fix: string;
  file_path: string;
  line_number?: number;
  status: string;
  assigned_to: string;
  due_date?: string;
  resolved_at?: string;
  resolved_by: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceReport {
  object_id: string;
  name: string;
  description: string;
  status: string;
  template_id: string;
  sections?: ReportSection[];
  created_at: string;

  // Backend summary fields
  summary?: string;
  compliant_count?: number;
  non_compliant_count?: number;
  indeterminate_count?: number;
  total_rulings_count?: number;
  compliance_percentage?: number;
  actionable_items?: ActionableItem[];

  // Legacy fields for backward compatibility with existing UI
  id?: string; // alias for object_id
  framework?: string;
  complianceScore?: number;
  criticalIssues?: number;
  highIssues?: number;
  mediumIssues?: number;
  lowIssues?: number;
  codebaseName?: string;
  version?: string;
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Template and Rule types (matching backend API responses)
export interface TemplateRule {
  object_id: string;
  name: string;
  rule: string;
  policy_name: string;
  policy_version: string;
  evidence_schema: string; // Backend returns as string
  scope: string;
  tags: string;
  public: boolean;
  source: string;
  description: string;
  severity: string;
  section: string;
  organization_id?: number;
}

export interface UiTemplateRule extends Omit<TemplateRule, "evidence_schema"> {
  evidence_schema: {
    required_documents: string[];
  };
}

export interface TemplateSection {
  object_id: string;
  name: string;
  description: string;
  template_id: string;
  rules: TemplateRule[];
}

export interface UiTemplateSection extends Omit<TemplateSection, "rules"> {
  rules: UiTemplateRule[];
  order?: number; // For UI ordering, not from API
}

export interface ReportTemplate {
  object_id: string;
  name: string;
  description: string;
  active: boolean;
  organization_id: string;
  codebases: Codebase[];
  sections: TemplateSection[];
  // UI-only fields for compatibility with existing components
  id?: string; // alias for object_id
  framework?: string;
  category?: "security" | "privacy" | "financial" | "healthcare" | "general";
  isPremade?: boolean;
  isPopular?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UiReportTemplate extends Omit<ReportTemplate, "sections"> {
  sections: UiTemplateSection[];
}

export interface UiReportTemplateWithReports extends UiReportTemplate {
  reports: ComplianceReport[];
}

// Error types
export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

// Template Import/Export Types
export interface TemplateImportData {
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
}

export interface TemplateExportData {
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
}

// Contact Form Types
export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  teamSize: string;
  message: string;
}

// Subscription and Billing Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: "month" | "year" | "free";
  currency: string;
  features: string[];
  popular?: boolean;
  stripePriceId: string;
}

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "canceling";

export interface Subscription {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: SubscriptionPlan;
  cancelAtPeriodEnd: boolean;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  bonus?: number;
  popular?: boolean;
  stripePriceId: string;
}

export interface UserCredits {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  lastUpdated: string;
}

export interface BillingInfo {
  customerId: string;
  subscription?: Subscription;
  credits: UserCredits;
  paymentMethods: PaymentMethod[];
  invoices: Invoice[];
}

export interface PaymentMethod {
  id: string;
  type: "card";
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  created: string;
  description: string;
  invoiceUrl: string;
}

export interface ContactFormResponse {
  success: boolean;
  message: string;
  error?: string;
  details?: string[];
}

export interface ServiceGraphNode {
  object_id: string;
  title: string;
  codebase: string;
  inferred: boolean;
  type: "backend" | "frontend" | "database" | "cache" | "external" | "other";
}

export interface ServiceGraphEdge {
  transport: string; // e.g., "http", "grpc", etc.
  title: string;
  from: string; // Added from property
  to: string; // Added to property
}

export interface DataFlowGraph {
  services: ServiceGraphNode[];
  edges: ServiceGraphEdge[];
}
