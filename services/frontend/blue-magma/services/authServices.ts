import { BASE_URL, AUTH_BASE } from "../config/api";

export type SignupData = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
};

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in?: number;
}

interface TokenError {
  error: string;
  error_description?: string;
}

export async function signup(data: SignupData) {
  const res = await fetch(`${AUTH_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  return res.json();
}

export async function login(
  email: string,
  password: string,
): Promise<TokenResponse | TokenError> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "password",
      username: email,
      password: password,
      refresh_token: null,
    }),
  });

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse | TokenError> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      username: null,
      password: null,
      refresh_token: refreshToken,
    }),
  });

  return res.json();
}

export async function revokeToken(refreshToken: string) {
  return fetch(`${AUTH_BASE}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
