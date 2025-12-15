/**
 * Webhook-specific billing service for server-side operations
 * This service is used by webhooks and doesn't require user authentication
 */

import { API_BASE } from "../config/api";
import type { Organization } from "../types/api";

export interface UpdateOrganizationBillingRequest {
  billing_email?: string;
  current_plan?: string;
  organization_address?: string;
  organization_city?: string;
  organization_country?: string;
  organization_description?: string;
  organization_name?: string;
  organization_postal_code?: string;
  organization_state?: string;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
  stripe_subscription_id?: string;
  monthly_cost?: number;
  subscription_status?: string;
  next_billing_date?: string;
}

export const webhookBillingService = {
  /**
   * Update organization billing information this updates the user's account on our backend API, not Stripe
   */
  async updateOrganizationBilling(
    orgId: string,
    data: UpdateOrganizationBillingRequest,
  ): Promise<Organization> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add API authentication, the front end service needs the API key to authenticate with the API
    if (process.env.INTERNAL_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.INTERNAL_API_KEY}`;
    } else {
	      console.error("[WebhookBillingService] No backend API authentication configured");
      throw new Error("No backend API authentication configured");
    }

	    console.log("[WebhookBillingService] Updating organization billing", {
	      orgId,
	      // Log only high-level fields to avoid leaking sensitive data
	      data: {
	        current_plan: data.current_plan,
	        stripe_subscription_id: data.stripe_subscription_id,
	        stripe_customer_id: data.stripe_customer_id,
	        monthly_cost: data.monthly_cost,
	        subscription_status: data.subscription_status,
	        next_billing_date: data.next_billing_date,
	      },
	    });

	    const response = await fetch(`${API_BASE}/org/${orgId}`, {
	      method: "PATCH",
	      headers,
	      body: JSON.stringify(data),
	    });

	    if (!response.ok) {
	      const errorText = await response.text();
	      console.error(
	        "[WebhookBillingService] Failed to update organization billing",
	        {
	          status: response.status,
	          error: errorText,
	        },
	      );
	      throw new Error(
	        `Failed to update organization billing: ${response.status} - ${errorText}`,
	      );
	    }

	    const result = await response.json();
	    console.log("[WebhookBillingService] Organization billing updated", {
	      orgId,
	      current_plan: result.current_plan,
	      stripe_subscription_id: result.stripe_subscription_id,
	      subscription_status: result.subscription_status,
	      next_billing_date: result.next_billing_date,
	    });
	    return result;
  },

  /**
   * Update Stripe customer ID after successful subscription
   */
  async updateStripeCustomerId(
    orgId: string,
    customerId: string,
  ): Promise<Organization> {
    return this.updateOrganizationBilling(orgId, {
      stripe_customer_id: customerId,
    });
  },

  /**
   * Update subscription information
   */
  async updateSubscriptionInfo(
    orgId: string,
    subscriptionId: string,
    planName: string,
  ): Promise<Organization> {
    return this.updateOrganizationBilling(orgId, {
      stripe_subscription_id: subscriptionId,
      current_plan: planName,
    });
  },

  /**
   * Update complete subscription data (subscription + customer + plan) in one call
   * This prevents race conditions and conflicting requests
   */
  async updateCompleteSubscriptionData(
    orgId: string,
    subscriptionId: string,
    planName: string,
    customerId: string,
    monthlyCost: number,
    subscriptionStatus: string,
    nextBillingDate: string,
  ): Promise<Organization> {
    return this.updateOrganizationBilling(orgId, {
      stripe_subscription_id: subscriptionId,
      current_plan: planName,
      stripe_customer_id: customerId,
      monthly_cost: monthlyCost,
      subscription_status: subscriptionStatus,
      next_billing_date: nextBillingDate,
    });
  },

  /**
   * Clear subscription data (for cancellations) - revert to free plan
   */
	  async clearSubscriptionData(orgId: string): Promise<Organization> {
	    console.log("[WebhookBillingService] Clearing subscription data", { orgId });
	    return this.updateOrganizationBilling(orgId, {
	      stripe_subscription_id: "",
	      current_plan: "Free",
	      monthly_cost: 0,
	      subscription_status: "active",
	      next_billing_date: "N/A",
	    });
  },

  /**
   * Add credits to organization balance using dedicated credits endpoint
   */
  async addCredits(orgId: string, creditsToAdd: number): Promise<Organization> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

	    // Add backend API authentication
	    if (process.env.INTERNAL_API_KEY) {
	      headers["Authorization"] = `Bearer ${process.env.INTERNAL_API_KEY}`;
	    } else {
	      console.error(
	        "[WebhookBillingService] No INTERNAL_API_KEY found for credits API authentication",
	      );
	      throw new Error("No authentication configured for credits API");
	    }

	    console.log("[WebhookBillingService] Adding credits", {
	      orgId,
	      creditsToAdd,
	    });

	    const response = await fetch(`${API_BASE}/org/${orgId}/credits/add`, {
	      method: "PATCH",
	      headers,
	      body: JSON.stringify({
	        credits: creditsToAdd,
	      }),
	    });

	    if (!response.ok) {
	      const errorText = await response.text();
	      console.error("[WebhookBillingService] Failed to add credits", {
	        status: response.status,
	        error: errorText,
	      });
	      throw new Error(
	        `Failed to add credits: ${response.status} - ${errorText}`,
	      );
	    }

	    const result = await response.json();
	    console.log("[WebhookBillingService] Credits added", {
	      orgId,
	      creditsToAdd,
	      newCreditsBalance: result.credits,
	    });
	    return result;
  },

  /**
   * Find organization by Stripe customer ID
   * This is a placeholder - you'll need to implement this based on your backend API
   */
  async findOrganizationByCustomerId(
    customerId: string,
  ): Promise<string | null> {
    // TODO: Implement API call to find organization by Stripe customer ID
    // This might require a new backend endpoint like GET /api/v1/org/by-stripe-customer/{customer_id}
    return null;
  },
};
