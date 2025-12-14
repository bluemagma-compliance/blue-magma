"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Coins, AlertTriangle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface SubscriptionStatusProps {
  variant?: "compact" | "detailed";
  showActions?: boolean;
  className?: string;
}

interface SubscriptionData {
  plan: string;
  status: "active" | "past_due" | "canceled" | "trial";
  daysUntilRenewal: number;
  credits: number;
}

export function SubscriptionStatus({
  variant = "compact",
  showActions = false,
  className = "",
}: SubscriptionStatusProps) {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data - replace with actual API call
    setTimeout(() => {
      setSubscription({
        plan: "Pro Plan",
        status: "active",
        daysUntilRenewal: 15,
        credits: 150,
      });
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 border-green-200";
      case "trial":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "past_due":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "canceled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-3 h-3" />;
      case "trial":
        return <Crown className="w-3 h-3" />;
      case "past_due":
        return <AlertTriangle className="w-3 h-3" />;
      case "canceled":
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-gray-200 rounded w-24"></div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className={className}>
        <Badge variant="outline" className="text-xs">
          No Subscription
        </Badge>
        {showActions && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/subscription")}
            className="ml-2"
          >
            Subscribe
          </Button>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge className={getStatusColor(subscription.status)}>
          {getStatusIcon(subscription.status)}
          <span className="ml-1 capitalize">{subscription.status}</span>
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Coins className="w-3 h-3" />
          <span>{subscription.credits}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-500" />
          <span className="font-medium text-sm">{subscription.plan}</span>
        </div>
        <Badge className={getStatusColor(subscription.status)}>
          {getStatusIcon(subscription.status)}
          <span className="ml-1 capitalize">{subscription.status}</span>
        </Badge>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {subscription.status === "active"
            ? `Renews in ${subscription.daysUntilRenewal} days`
            : subscription.status === "trial"
              ? `Trial ends in ${subscription.daysUntilRenewal} days`
              : "Subscription inactive"}
        </span>
        <div className="flex items-center gap-1">
          <Coins className="w-3 h-3" />
          <span>{subscription.credits} credits</span>
        </div>
      </div>

      {showActions && (
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/billing")}
          >
            Manage
          </Button>
          {subscription.credits < 50 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/credits")}
            >
              Buy Credits
            </Button>
          )}
        </div>
      )}

      {/* Warnings */}
      {subscription.status === "past_due" && (
        <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
          ⚠️ Payment overdue. Please update your payment method.
        </div>
      )}

      {subscription.credits < 20 && (
        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-200">
          🔋 Low credits. Consider purchasing more to continue using premium
          features.
        </div>
      )}

      {subscription.status === "trial" &&
        subscription.daysUntilRenewal <= 3 && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
            🎯 Trial ending soon. Subscribe to continue using all features.
          </div>
        )}
    </div>
  );
}
