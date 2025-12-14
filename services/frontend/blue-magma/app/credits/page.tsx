"use client";

import { useState, useEffect } from "react";
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
import { Coins, Zap, Gift, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { CreditPackage } from "@/types/api";
import { getOrganizationBilling } from "@/app/billing/actions";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const stripePromise =
  publishableKey
    ? loadStripe(publishableKey)
    : (Promise.resolve(null) as ReturnType<typeof loadStripe>);

export default function CreditsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(
    null,
  );
  const [currentCredits, setCurrentCredits] = useState(0);
  const [creditsLoading, setCreditsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      fetchCreditPackages();
      fetchCurrentCredits();
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchCurrentCredits = async () => {
    try {
      setCreditsLoading(true);
      const orgData = await getOrganizationBilling();
      setCurrentCredits(orgData.credits || 0);
    } catch (error) {
      console.error("Error fetching current credits:", error);
      toast.error("Failed to load current credits");
    } finally {
      setCreditsLoading(false);
    }
  };

  const fetchCreditPackages = async () => {
    try {
      const response = await fetch("/api/stripe/credit-packages");
      if (!response.ok) {
        throw new Error("Failed to fetch credit packages");
      }
      const data = await response.json();
      setPackages(data);
      setPackagesError(null);
    } catch (error) {
      console.error("Error fetching credit packages:", error);
      setPackagesError(
        "We couldn't load purchase options right now. Please try again later.",
      );
      toast.error("Failed to load credit packages");
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (creditPackage: CreditPackage) => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    setPurchasingPackage(creditPackage.id);

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
          priceId: creditPackage.stripePriceId,
          mode: "payment",
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&type=credits`,
          cancelUrl: `${window.location.origin}/credits`,
        }),
      });

      if (!response.ok) throw new Error("Failed to create checkout session");

      const { sessionId } = await response.json();
      const result = await stripe.redirectToCheckout({ sessionId });

      if (result.error) {
        throw new Error(result.error.message);
      }
    } catch (error) {
      console.error("Error purchasing credits:", error);
      toast.error("Failed to start purchase process");
    } finally {
      setPurchasingPackage(null);
    }
  };

  const calculateValue = (creditPackage: CreditPackage) => {
    const baseCredits = creditPackage.credits;
    const bonusCredits = creditPackage.bonus || 0;
    const totalCredits = baseCredits + bonusCredits;
    const pricePerCredit = creditPackage.price / totalCredits;
    return pricePerCredit;
  };

  const getBestValue = () => {
    if (packages.length === 0) return null;
    return packages.reduce((best, current) =>
      calculateValue(current) < calculateValue(best) ? current : best,
    );
  };

  if (isLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const bestValue = getBestValue();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Purchase Credits</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
            Credits are used for code scans, compliance reports, and premium
            features. Choose the package that fits your needs.
          </p>

          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full">
            <Coins className="w-5 h-5" />
            <span className="font-semibold">
              Current Balance:{" "}
              {creditsLoading
                ? "Loading..."
                : `${currentCredits.toLocaleString()} credits`}
            </span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {packagesError && packages.length === 0 && (
          <div className="md:col-span-2 lg:col-span-4 flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
            <p className="text-lg font-medium mb-2">Unable to load credit packages</p>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              {packagesError}
            </p>
            <p className="text-xs text-muted-foreground">
              If this problem persists, please contact support and we&apos;ll help you
              complete your purchase.
            </p>
          </div>
        )}

        {packages.map((creditPackage) => {
          const totalCredits =
            creditPackage.credits + (creditPackage.bonus || 0);
          const isPopular = creditPackage.popular;
          const isBestValue = bestValue?.id === creditPackage.id;

          return (
            <Card
              key={creditPackage.id}
              className={`relative ${isPopular ? "border-primary shadow-lg scale-105" : ""}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1">
                    <Zap className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}

              {isBestValue && !isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge variant="secondary" className="px-3 py-1">
                    Best Value
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  {creditPackage.name}
                </CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    ${(creditPackage.price / 100).toFixed(0)}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-semibold text-primary">
                    {creditPackage.credits.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground"> credits</span>

                  {creditPackage.bonus && (
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <Gift className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600 font-medium">
                        +{creditPackage.bonus} bonus credits
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3 mb-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      Total:{" "}
                      <span className="font-semibold">
                        {totalCredits.toLocaleString()} credits
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ${(calculateValue(creditPackage) / 100).toFixed(3)} per
                      credit
                    </p>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Use for code scans</p>
                    <p>• Generate compliance reports</p>
                    <p>• Access premium features</p>
                    <p>• Credits never expire</p>
                  </div>
                </div>

                <Button
                  onClick={() => handlePurchase(creditPackage)}
                  disabled={purchasingPackage === creditPackage.id}
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                >
                  {purchasingPackage === creditPackage.id
                    ? "Processing..."
                    : "Purchase Now"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-12 space-y-4">
        <p className="text-sm text-muted-foreground">
          All purchases are secure and processed through Stripe. Credits are
          added to your account immediately.
        </p>
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          <span>• Secure payments</span>
          <span>• Instant delivery</span>
          <span>• No expiration</span>
          <span>• 24/7 support</span>
        </div>
      </div>
    </div>
  );
}
