// Google OAuth API Response Types

export interface GoogleOAuthStartResponse {
  oauth_url: string;
  state: string;
}

export interface GoogleOAuthExchangeRequest {
  code: string;
  state: string;
  action: GoogleOAuthAction;
}

export interface GoogleOAuthExchangeResponse {
  success: boolean;
  message: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  organization_id: string;
  error?: string;
  user?: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    google_user_id?: string;
    google_email?: string;
    google_avatar_url?: string;
    google_name?: string;
  };
}

export interface GoogleOAuthErrorResponse {
  success: false;
  error: string;
  error_description?: string;
}

export interface GoogleLinkRequest {
  return_url: string;
  action: string;
}

export interface GoogleLinkResponse {
  oauth_url: string;
  state: string;
}

// OAuth callback URL parameters
export interface GoogleCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

// OAuth actions
export type GoogleOAuthAction = "login" | "link";

// OAuth start request
export interface GoogleOAuthStartRequest {
  action: GoogleOAuthAction;
  return_url: string;
}
