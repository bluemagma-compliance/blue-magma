// Data source type definitions

export interface DataSource {
  object_id: string;
  type: 'repo' | 'documentation' | 'user' | 'policy';
  source: 'github' | 'confluence' | 'internal' | 'uploaded';
  name: string;
  last_updated: string;
  status: 'active' | 'inactive' | 'syncing' | 'error';
}

export interface DataSourcesResponse {
  data_sources: DataSource[];
  total: number;
}

export type DataSourceType = 'repo' | 'documentation' | 'user' | 'policy' | 'all';
export type DataSourceSource = 'github' | 'confluence' | 'internal' | 'uploaded' | 'all';

export interface VendorRole {
  vendor: string; // e.g., "GitHub", "AWS", "Jira"
  role: string; // e.g., "Admin", "Developer", "Viewer"
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Pending';
  vendorRoles: VendorRole[];
  joinedAt: string;
  avatar?: string;
}

export interface MockPolicy {
  id: string;
  name: string;
  summary: string;
  pageCount: number;
  author?: string;
  uploadedAt: string;
  fileSize: string; // e.g., "2.4 MB"
  fileType: string; // e.g., "PDF", "DOCX"
}

export type DataSourceTab = 'codebases' | 'users' | 'policies';

export type AddCodebaseTab = 'manual' | 'github';
