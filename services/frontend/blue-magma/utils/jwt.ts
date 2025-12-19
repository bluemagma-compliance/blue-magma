// JWT utility functions for client-side token handling
// Note: This is for reading claims only, not for verification (which should be done server-side)

interface JWTPayload {
  user_id: string;
  exp: number;
  iat: number;
}

export function decodeJWT(token: string): JWTPayload | null {
  try {
    // Split the token into parts
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];

    // Add padding if needed
    const paddedPayload = payload + "=".repeat((4 - (payload.length % 4)) % 4);

    // Decode from base64
    const decodedPayload = atob(paddedPayload);

    // Parse JSON
    return JSON.parse(decodedPayload) as JWTPayload;
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload) {
    return true;
  }

  // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
  return payload.exp * 1000 < Date.now();
}

export function getUserIdFromToken(token: string): string | null {
  const payload = decodeJWT(token);
  return payload?.user_id || null;
}
