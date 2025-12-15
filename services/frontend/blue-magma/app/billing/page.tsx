"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getOrganizationBilling } from "./actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  ExternalLink,
  Calendar,
  DollarSign,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { BillingInfo, Subscription, Invoice } from "@/types/api";

export default function BillingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [managingBilling, setManagingBilling] = useState(false);

  const fetchBillingInfo = useCallback(async () => {
    try {
      console.log("=== FETCHING BILLING INFO ===");
      const orgData = await getOrganizationBilling();
      console.log("Organization data received:", orgData);

      // Check user's plan status
      const hasSubscription = !!(
        orgData.current_plan && orgData.stripe_subscription_id
      );
      const hasCredits = (orgData.credits || 0) > 0;
      const hasStripeCustomer = !!orgData.stripe_customer_id;
      const isFreePlan = orgData.current_plan === "free";

      console.log("Billing info check:", {
        hasSubscription,
        hasCredits,
        hasStripeCustomer,
        isFreePlan,
        current_plan: orgData.current_plan,
        stripe_subscription_id: orgData.stripe_subscription_id,
        stripe_customer_id: orgData.stripe_customer_id,
        credits: orgData.credits,
      });

      // Everyone gets to see the billing dashboard now (including free plan users)
      console.log("✅ Showing billing dashboard");

      // Build billing info from organization data
      const billingInfo: BillingInfo = {
        customerId: orgData.stripe_customer_id || "",
        credits: {
          balance: orgData.credits || 0,
	          // Use backend cumulative counters for lifetime credit stats.
	          // Fall back to current balance if totals are not yet populated
	          // (e.g., very old orgs before the migration).
	          totalPurchased:
	            orgData.total_credits_added ?? orgData.credits ?? 0,
	          totalUsed: orgData.total_credits_subtracted ?? 0,
          lastUpdated: new Date().toISOString(),
        },
        paymentMethods: [], // You might want to fetch this from Stripe API
        invoices: [], // You might want to fetch this from Stripe API
      };
      console.log("orgData:", orgData);
      // Add subscription info (including free plan)
      billingInfo.subscription = {
        id: orgData.stripe_subscription_id || "",
        customerId: orgData.stripe_customer_id || "",
        status: orgData.subscription_status || "canceled",
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd:
          hasSubscription &&
          orgData.next_billing_date &&
          orgData.next_billing_date !== "N/A" &&
          !orgData.next_billing_date.startsWith("Cancels on")
            ? new Date(orgData.next_billing_date).toISOString()
            : orgData.next_billing_date,
        cancelAtPeriodEnd: false,
        plan: {
          id: hasSubscription ? "paid_plan" : "free_plan",
          name: orgData.current_plan || "",
          description: isFreePlan
	            ? "Free plan with 200 credits included"
	            : "Paid subscription plan",
          price: hasSubscription ? orgData.monthly_cost * 100 : 0, // Convert dollars to cents for display
          interval: hasSubscription ? "month" : "free",
          currency: "usd",
          features: [],
          stripePriceId: "",
        },
      };

      setBillingInfo(billingInfo);
    } catch (error) {
      console.error("Error fetching billing info:", error);
      toast.error("Failed to load billing information");
      // Don't redirect on error - just show error state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      fetchBillingInfo();
    }
  }, [isAuthenticated, isLoading, router, fetchBillingInfo]);

  const handleManageBilling = async () => {
    setManagingBilling(true);

    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create portal session");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Error creating portal session:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to open billing portal",
      );
    } finally {
      setManagingBilling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "past_due":
        return "bg-yellow-100 text-yellow-800";
      case "canceled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4" />;
      case "past_due":
        return <AlertCircle className="w-4 h-4" />;
      case "canceled":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Everyone should see the billing dashboard now, including free plan users
  if (!billingInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            Loading Billing Information...
          </h1>
          <p className="text-muted-foreground">
            Please wait while we load your billing data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription, payment methods, and view invoices
        </p>
      </div>

      <div className="grid gap-6">
        {/* Current Subscription */}
        {billingInfo.subscription && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Current Subscription
                </span>
                <Badge
                  className={getStatusColor(billingInfo.subscription.status)}
                >
                  {getStatusIcon(billingInfo.subscription.status)}
                  <span className="ml-1 capitalize">
                    {billingInfo.subscription.status}
                  </span>
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold">
                    {billingInfo.subscription.plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {billingInfo.subscription.plan.name === "free"
	                      ? "Free plan with 200 credits included"
                      : `$${(billingInfo.subscription.plan.price / 100).toFixed(
                          2,
                        )}/${billingInfo.subscription.plan.interval}`}
                  </p>
                  {billingInfo.subscription.status === "canceling" && (
                    <p className="text-sm text-orange-600 font-medium mt-1">
                      ⚠️ Subscription will be canceled
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {billingInfo.subscription.plan.name === "Free"
                      ? "Status"
                      : billingInfo.subscription.status === "canceling"
                        ? "Cancellation date"
                        : "Next billing date"}
                  </p>
                  <p className="font-semibold">
                    {billingInfo.subscription.plan.name === "free"
                      ? "Active"
                      : billingInfo.subscription.status === "canceling"
                        ? billingInfo.subscription.currentPeriodEnd.includes(
                            "Cancels on",
                          )
                          ? billingInfo.subscription.currentPeriodEnd.replace(
                              "Cancels on ",
                              "",
                            )
                          : billingInfo.subscription.currentPeriodEnd
                        : new Date(
                            billingInfo.subscription.currentPeriodEnd,
                          ).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {billingInfo.subscription.plan.name === "free"
                      ? "You're currently on the free tier. Upgrade to a paid subscription plan to unlock additional features."
                      : billingInfo.subscription.status === "canceling"
                        ? "Your subscription is set to cancel at the end of the current billing period. You can reactivate it anytime before then."
                        : "Manage your subscription, change plans, update payment methods, and view billing history"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {billingInfo.subscription.plan.name === "free" ? (
                    <Button
                      onClick={() => router.push("/subscription")}
                      variant="secondary"
                    >
                      Upgrade Plan
                    </Button>
                  ) : (
                    <Button
                      onClick={handleManageBilling}
                      disabled={managingBilling}
                      variant="default"
                    >
                      {managingBilling
                        ? "Loading..."
                        : billingInfo.subscription.status === "canceling"
                          ? "Reactivate Subscription"
                          : "Manage Subscription"}
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credits Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Credits Balance
            </CardTitle>
            <CardDescription>
              Use credits for additional scans and premium features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {billingInfo.credits.balance}
                </p>
                <p className="text-sm text-muted-foreground">
                  Available Credits
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {billingInfo.credits.totalPurchased}
                </p>
                <p className="text-sm text-muted-foreground">Total Purchased</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {billingInfo.credits.totalUsed}
                </p>
                <p className="text-sm text-muted-foreground">Total Used</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex justify-center">
              <Button onClick={() => router.push("/credits")}>
                Purchase More Credits
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices - Commented out until Stripe invoice fetching is implemented */}
        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {billingInfo.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{invoice.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.created).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">
                        ${(invoice.amount / 100).toFixed(2)}
                      </p>
                      <Badge
                        variant={
                          invoice.status === "paid" ? "default" : "destructive"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={invoice.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
}
