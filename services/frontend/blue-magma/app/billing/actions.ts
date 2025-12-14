"use server";

import { cookies } from "next/headers";
import { API_BASE } from "@/config/api";
import type { Organization } from "@/types/api";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    throw new Error("No access token found");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function getOrganizationId() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("organization_id")?.value;

  if (!orgId) {
    throw new Error("No organization ID found");
  }

  return orgId;
}

export async function getOrganizationBilling(): Promise<Organization> {
  try {
    console.log("=== SERVER ACTION: getOrganizationBilling ===");
    const orgId = await getOrganizationId();
    console.log("Organization ID:", orgId);

    const headers = await getAuthHeaders();
    console.log("Auth headers prepared");

    const url = `${API_BASE}/org/${orgId}`;
    console.log("Fetching from URL:", url);

    const response = await fetch(url, {
      headers,
      cache: "no-store", // Always fetch fresh data
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", errorText);
      throw new Error(
        `Failed to fetch organization billing: ${response.status} - ${errorText}`,
      );
    }

	    const data = await response.json();
	    console.log("Organization data fetched - current_plan:", data.current_plan);
	    return data;
  } catch (error) {
    console.error("Error fetching organization billing:", error);
    throw error;
  }
}

export async function updateOrganizationBilling(
  data: Partial<Organization>,
): Promise<Organization> {
  try {
    const orgId = await getOrganizationId();
    const headers = await getAuthHeaders();

    const response = await fetch(`${API_BASE}/org/${orgId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to update organization billing: ${response.status}`,
      );
    }

    return response.json();
  } catch (error) {
    console.error("Error updating organization billing:", error);
    throw error;
  }
}

export async function getCreditsBalance(): Promise<number> {
  try {
    const org = await getOrganizationBilling();
    return org.credits || 0;
  } catch (error) {
    console.error("Error fetching credits balance:", error);
    return 0;
  }
}

export async function getCurrentPlan(): Promise<string | null> {
  try {
    const org = await getOrganizationBilling();
    return org.current_plan || null;
  } catch (error) {
    console.error("Error fetching current plan:", error);
    return null;
  }
}

export async function getStripeCustomerId(): Promise<string | null> {
  try {
    const org = await getOrganizationBilling();
    return org.stripe_customer_id || null;
  } catch (error) {
    console.error("Error fetching Stripe customer ID:", error);
    return null;
  }
}
