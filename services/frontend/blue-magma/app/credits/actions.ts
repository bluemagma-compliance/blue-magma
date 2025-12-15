"use server";

import { cookies } from "next/headers";

interface Organization {
  id: string;
  name: string;
  credits: number;
  // ... other fields
}

/**
 * Add credits to organization using server-side INTERNAL_API_KEY
 * This is called from webhooks when credit purchases are completed
 * The orgId parameter is required since webhooks don't have user cookies
 */
export async function addCreditsToOrganization(
  orgId: string,
  creditsToAdd: number,
): Promise<Organization> {
  console.log(`Adding ${creditsToAdd} credits to organization ${orgId}`);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  const response = await fetch(`${apiUrl}/api/v1/org/${orgId}/credits`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
    },
    body: JSON.stringify({
      credits: creditsToAdd,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to add credits: ${response.status} - ${errorText}`);
    throw new Error(`Failed to add credits: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(
    `✅ Successfully added ${creditsToAdd} credits to organization ${orgId}`,
  );
  console.log("Updated organization:", result);

  return result;
}

// Note: For getting current credits, use getOrganizationBilling() from @/app/billing/actions
// This avoids code duplication and uses the same data source
