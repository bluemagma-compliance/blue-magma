/**
 * Centralized API configuration
 * Update this file to change API endpoints across the entire application
 */

// Base API URL - reads from environment variable or falls back to localhost
const API_BASE_URL = process.env.BLUE_MAGMA_API || "http://localhost:80";

// API endpoints configuration
export const API_CONFIG = {
  // Base URLs
  BASE_URL: API_BASE_URL,
  API_BASE: `${API_BASE_URL}/api/v1`,
  AUTH_BASE: `${API_BASE_URL}/auth`,

  // Specific endpoints
  ENDPOINTS: {
    // Auth endpoints
    AUTH: {
      LOGIN: "/auth/token",
      SIGNUP: "/auth/signup",
      REFRESH: "/auth/refresh",
      LOGOUT: "/auth/logout",
      VALIDATE_INVITATION: (token: string) =>
        `/auth/invitation/${token}/validate`,
      ACCEPT_INVITATION: "/auth/invitation/accept",
      GITHUB_START: "/auth/github/start",
      GITHUB_EXCHANGE: "/auth/github/exchange",
      GITHUB_LINK: "/auth/github/link",
    },

    // API endpoints
    API: {
      HEALTH: "/api/v1/health",
      ORGANIZATIONS: "/api/v1/org",
      CODEBASES: (orgId: string) => `/api/v1/org/${orgId}/codebase`,
      CODEBASE: (orgId: string, codebaseId: string) =>
        `/api/v1/org/${orgId}/codebase/${codebaseId}`,
      REPORTS: (orgId: string) => `/api/v1/org/${orgId}/report`,
      REPORT: (orgId: string, reportId: string) =>
        `/api/v1/org/${orgId}/report/${reportId}`,
      RULINGS: (orgId: string, reportId: string) =>
        `/api/v1/org/${orgId}/ruling/${reportId}`,
      TEMPLATES: (orgId: string) => `/api/v1/org/${orgId}/template`,
      TEMPLATE: (orgId: string, templateId: string) =>
        `/api/v1/org/${orgId}/template/${templateId}`,
      SEND_INVITATION: (orgId: string) => `/api/v1/org/${orgId}/users/invite`,
    },
  },
};

// Helper functions for common API operations
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.API_BASE}${endpoint}`;
};

export const getAuthUrl = (endpoint: string): string => {
  return `${API_CONFIG.AUTH_BASE}${endpoint}`;
};

// Export individual values for backward compatibility
export const API_BASE = API_CONFIG.API_BASE;
export const AUTH_BASE = API_CONFIG.AUTH_BASE;
export const BASE_URL = API_CONFIG.BASE_URL;

// Default export
export default API_CONFIG;
