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
import { CreditCard, Coins, Crown, Plus, ArrowRight } from "lucide-react";

interface BillingQuickActionsProps {
  className?: string;
}

export function BillingQuickActions({ className }: BillingQuickActionsProps) {
  const router = useRouter();
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    daysUntilRenewal: number;
  } | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchBillingData = useCallback(async () => {
    try {
      const orgData = await getOrganizationBilling();

      // Set subscription data
      if (orgData.current_plan && orgData.stripe_subscription_id) {
        setSubscription({
          plan: orgData.current_plan,
          status: "active", // You might want to get this from Stripe API
          daysUntilRenewal: 15, // You might want to calculate this from Stripe API
        });
      }

      // Set credits
      setCredits(orgData.credits || 0);
    } catch (error) {
      console.error("Error fetching billing data:", error);
      setSubscription(null);
      setCredits(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing Overview
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
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing Overview
        </CardTitle>
        <CardDescription>Manage your subscription and credits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription Status */}
        {subscription && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="font-medium text-sm">{subscription.plan}</p>
                <p className="text-xs text-muted-foreground">
                  Renews in {subscription.daysUntilRenewal} days
                </p>
              </div>
            </div>
            <Badge
              variant={
                subscription.status === "active" ? "default" : "secondary"
              }
            >
              {subscription.status}
            </Badge>
          </div>
        )}

        {/* Credits Balance */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="font-medium text-sm">Credits Balance</p>
              <p className="text-xs text-muted-foreground">
                Available for scans and reports
              </p>
            </div>
          </div>
          <span className="text-lg font-bold text-primary">{credits}</span>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <Button
            onClick={() => router.push("/billing")}
            className="w-full"
            variant="outline"
          >
            Manage Billing
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => router.push("/subscription")}
              variant="outline"
              size="sm"
            >
              View Plans
            </Button>
            <Button
              onClick={() => router.push("/credits")}
              variant="outline"
              size="sm"
            >
              <Plus className="mr-1 h-3 w-3" />
              Buy Credits
            </Button>
          </div>
        </div>

        {/* Low Credits Warning */}
        {credits < 50 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ Low credits balance. Consider purchasing more credits to
              continue using premium features.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
