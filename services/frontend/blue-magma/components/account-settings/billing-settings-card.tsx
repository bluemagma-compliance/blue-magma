"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getOrganizationBilling } from "@/app/billing/actions";
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
  Coins,
  Plus,
  Settings,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

interface SubscriptionInfo {
  plan: string;
  status: string;
  renewalDate: string;
  amount: number;
}

interface CreditsInfo {
  balance: number;
  lastUpdated: string;
}

export function BillingSettingsCard() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null,
  );
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBillingData = useCallback(async () => {
    try {
      const orgData = await getOrganizationBilling();

      // Set subscription data
      if (orgData.current_plan && orgData.stripe_subscription_id) {
        setSubscription({
          plan: orgData.current_plan,
          status: "active", // You might want to get this from Stripe API
          renewalDate: "Next billing cycle", // You might want to get this from Stripe API
          amount: 0, // You might want to get this from Stripe API
        });
      }

      // Set credits data
      setCredits({
        balance: orgData.credits || 0,
        lastUpdated: new Date().toISOString().split("T")[0],
      });
    } catch (error) {
      console.error("Error fetching billing data:", error);
      // Set default values on error
      setSubscription(null);
      setCredits({
        balance: 0,
        lastUpdated: new Date().toISOString().split("T")[0],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleViewBilling = () => {
    router.push("/billing");
  };

  const handleViewSubscriptions = () => {
    router.push("/subscription");
  };

  const handleBuyCredits = () => {
    router.push("/credits");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="mr-2 h-5 w-5" />
            Billing & Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="mr-2 h-5 w-5" />
          Billing & Subscription
        </CardTitle>
        <CardDescription>
          Manage your subscription, payment methods, and credits.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Subscription */}
        {subscription && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{subscription.plan}</h3>
                <p className="text-sm text-muted-foreground">
                  ${subscription.amount}/month • Renews on{" "}
                  {subscription.renewalDate}
                </p>
              </div>
              <Badge
                variant={
                  subscription.status === "active" ? "default" : "secondary"
                }
              >
                {subscription.status}
              </Badge>
            </div>
          </div>
        )}

        {/* Credits Balance */}
        {credits && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Credits Balance</span>
                </div>
                <span className="text-lg font-bold text-primary">
                  {credits.balance}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Last updated:{" "}
                {new Date(credits.lastUpdated).toLocaleDateString()}
              </p>
            </div>
          </>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button onClick={handleViewBilling} className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            Open Billing Dashboard
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleViewSubscriptions}
              variant="outline"
              size="sm"
            >
              <Crown className="mr-1 h-3 w-3" />
              View Plans
            </Button>
            <Button onClick={handleBuyCredits} variant="outline" size="sm">
              <Plus className="mr-1 h-3 w-3" />
              Buy Credits
            </Button>
          </div>

          {/* Quick Links */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Quick Actions:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => router.push("/subscription")}
                variant="ghost"
                size="sm"
                className="text-xs h-7"
              >
                Change Plan
              </Button>
              <Button
                onClick={() => router.push("/billing")}
                variant="ghost"
                size="sm"
                className="text-xs h-7"
              >
                View Invoices
              </Button>
              <Button
                onClick={() => router.push("/credits")}
                variant="ghost"
                size="sm"
                className="text-xs h-7"
              >
                Purchase Credits
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Secure payments processed through Stripe. Cancel anytime.
        </p>
      </CardContent>
    </Card>
  );
}
