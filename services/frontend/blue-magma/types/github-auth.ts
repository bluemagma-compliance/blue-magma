// GitHub OAuth API Response Types

export interface GitHubOAuthStartResponse {
  oauth_url: string;
  state: string;
}

export interface GitHubOAuthExchangeRequest {
  code: string;
  state: string;
}

export interface GitHubOAuthExchangeResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
  organization_id?: string;
  error?: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    github_user_id?: string;
    github_username?: string;
    github_avatar_url?: string;
  };
}

export interface GitHubOAuthErrorResponse {
  success: false;
  error: string;
  error_description?: string;
}

export interface GitHubLinkRequest {
  return_url?: string;
}

export interface GitHubLinkResponse {
  oauth_url: string;
  state: string;
}

// OAuth callback URL parameters
export interface GitHubCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

// OAuth actions
export type GitHubOAuthAction = "login" | "link";

// OAuth start request
export interface GitHubOAuthStartRequest {
  action: GitHubOAuthAction;
  return_url: string;
}
