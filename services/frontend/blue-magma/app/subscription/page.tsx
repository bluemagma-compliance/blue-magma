"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Star } from "lucide-react";
import { toast } from "sonner";
import type { SubscriptionPlan } from "@/types/api";
import { getOrganizationBilling } from "@/app/billing/actions";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const stripePromise =
  publishableKey
    ? loadStripe(publishableKey)
    : (Promise.resolve(null) as ReturnType<typeof loadStripe>);

export default function SubscriptionPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

  const checkExistingSubscription = useCallback(async () => {
    try {
      const orgData = await getOrganizationBilling();

      // Check if user has an active PAID subscription (not free plan)
      const hasSubscription = !!(
        orgData.current_plan && orgData.stripe_subscription_id
      );
      const isFreePlan =
        orgData.current_plan === "Free" || !orgData.current_plan;

      if (hasSubscription && !isFreePlan) {
        console.log(
          "User has existing paid subscription, redirecting to billing page",
        );
        router.push("/billing");
        return;
      }

      // Free plan users or no subscription, proceed to fetch plans
      console.log(
        "User is on free plan or has no subscription, showing upgrade options",
      );
      fetchPlans();
    } catch (error) {
      console.error("Error checking subscription status:", error);
      // If there's an error checking, still show plans (fail gracefully)
      fetchPlans();
    }
  }, [router]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      checkExistingSubscription();
    }
  }, [isAuthenticated, isLoading, router, checkExistingSubscription]);

  const fetchPlans = async () => {
    try {
      const response = await fetch("/api/stripe/subscription-plans");
      if (!response.ok) throw new Error("Failed to fetch plans");
      const data = await response.json();
      setPlans(data);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setSubscribingTo(plan.id);

    try {
      if (!publishableKey) {
        console.error("Stripe publishable key is not configured");
        toast.error("Payments are not configured. Please contact support.");
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        console.error("Stripe failed to load");
        toast.error("Payments are not available right now. Please try again later.");
        return;
      }

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          mode: "subscription",
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/subscription`,
        }),
      });

      if (!response.ok) throw new Error("Failed to create checkout session");

      const { sessionId } = await response.json();
      const result = await stripe.redirectToCheckout({ sessionId });

      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast.error("Failed to start subscription process");
    } finally {
      setSubscribingTo(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select the perfect plan for your compliance needs. Upgrade or
          downgrade at any time.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              plan.popular ? "border-primary shadow-lg scale-105" : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground px-3 py-1">
                  <Star className="w-3 h-3 mr-1" />
                  Most Popular
                </Badge>
              </div>
            )}

            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                {plan.name === "Pro" && (
                  <Crown className="w-5 h-5 text-yellow-500" />
                )}
                {plan.name === "Enterprise" && (
                  <Zap className="w-5 h-5 text-purple-500" />
                )}
                {plan.name}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">
                  ${(plan.price / 100).toFixed(0)}
                </span>
                <span className="text-muted-foreground">/{plan.interval}</span>
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSubscribe(plan)}
                disabled={subscribingTo === plan.id}
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
              >
                {subscribingTo === plan.id ? "Processing..." : "Subscribe Now"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

	      {/* NOTE: Previously showed a 14-day free trial message here. Removed at
	        user request because trial terms are no longer accurate. */}
    </div>
  );
}
