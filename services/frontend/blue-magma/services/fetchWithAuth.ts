/**
 * @deprecated This function is deprecated due to the switch to httpOnly cookies.
 * Client-side code can no longer access authentication tokens directly.
 *
 * Instead, use server actions for authenticated API calls:
 * 1. Create server actions in your page/component's actions.ts file
 * 2. Use the cookies() function from 'next/headers' to access httpOnly cookies
 * 3. Call the server actions from your client components
 *
 * Example:
 * ```typescript
 * // In app/dashboard/actions.ts
 * 'use server'
 * import { cookies } from 'next/headers'
 *
 * export async function getDataAction() {
 *   const cookieStore = await cookies()
 *   const accessToken = cookieStore.get('access_token')?.value
 *
 *   const response = await fetch('${API_BASE}/data', {
 *     headers: {
 *       'Authorization': `Bearer ${accessToken}`,
 *       'Content-Type': 'application/json'
 *     }
 *   })
 *
 *   return response.json()
 * }
 * ```
 */
export async function fetchWithAuth(
  input: RequestInfo,
  init: RequestInit = {},
): Promise<Response> {
  throw new Error(
    "fetchWithAuth is deprecated. Use server actions for authenticated API calls with httpOnly cookies. " +
      "See the function documentation for migration examples.",
  );
}
