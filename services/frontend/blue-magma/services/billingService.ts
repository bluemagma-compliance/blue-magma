/**
 * @deprecated This service is deprecated. Use server actions instead.
 * See app/billing/actions.ts for the new implementation.
 *
 * This file is kept for backward compatibility but should not be used
 * in new code. All billing operations should use server actions.
 */

import type { Organization } from "../types/api";

export interface OrganizationBillingData {
  billing_email?: string;
  credits?: number;
  current_plan?: string;
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
  stripe_subscription_id?: string;
}

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
}

export const billingService = {
  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async getOrganizationBilling(orgId: string): Promise<Organization> {
    throw new Error(
      "billingService.getOrganizationBilling is deprecated. Use server actions from app/billing/actions.ts instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async updateOrganizationBilling(
    orgId: string,
    data: UpdateOrganizationBillingRequest,
  ): Promise<Organization> {
    throw new Error(
      "billingService.updateOrganizationBilling is deprecated. Use server actions from app/billing/actions.ts instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async updateStripeCustomerId(
    orgId: string,
    customerId: string,
  ): Promise<Organization> {
    throw new Error(
      "billingService.updateStripeCustomerId is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async updateSubscriptionInfo(
    orgId: string,
    subscriptionId: string,
    planName: string,
  ): Promise<Organization> {
    throw new Error(
      "billingService.updateSubscriptionInfo is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async updatePaymentMethod(
    orgId: string,
    paymentMethodId: string,
  ): Promise<Organization> {
    throw new Error(
      "billingService.updatePaymentMethod is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async clearSubscriptionData(orgId: string): Promise<Organization> {
    throw new Error(
      "billingService.clearSubscriptionData is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async updateBillingEmail(
    orgId: string,
    email: string,
  ): Promise<Organization> {
    throw new Error(
      "billingService.updateBillingEmail is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async getCreditsBalance(orgId: string): Promise<number> {
    throw new Error(
      "billingService.getCreditsBalance is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async getCurrentPlan(orgId: string): Promise<string | null> {
    throw new Error(
      "billingService.getCurrentPlan is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async getStripeCustomerId(orgId: string): Promise<string | null> {
    throw new Error(
      "billingService.getStripeCustomerId is deprecated. Use server actions instead.",
    );
  },

  /**
   * @deprecated Use server actions from app/billing/actions.ts instead
   */
  async hasActiveSubscription(orgId: string): Promise<boolean> {
    throw new Error(
      "billingService.hasActiveSubscription is deprecated. Use server actions instead.",
    );
  },
};
