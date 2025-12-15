"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Coins, ArrowRight, Home } from "lucide-react";
import { toast } from "sonner";

interface SessionData {
  id: string;
  status: string;
  payment_status: string;
  customer_email: string;
  customer_id: string;
  subscription_id?: string;
  amount_total: number;
  currency: string;
  metadata: Record<string, string>;
}

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [purchaseType, setPurchaseType] = useState<"subscription" | "credits">(
    "subscription",
  );

  const sessionId = searchParams.get("session_id");
  const type = searchParams.get("type");

  const fetchSessionStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      console.log("=== PROCESSING PAYMENT SUCCESS ===");
      console.log("Session ID:", sessionId);
      console.log("Purchase type:", purchaseType);

      const response = await fetch("/api/stripe/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to verify session");
      }

      const { session, billingData } = await response.json();
      console.log("Session data:", session);
      console.log("Billing data saved:", billingData);

      setSessionData(session);

      if (session.payment_status === "paid") {
        setStatus("success");
        toast.success(
          purchaseType === "credits"
            ? "Credits purchased successfully!"
            : "Subscription activated successfully!",
        );
      } else {
        setStatus("error");
      }
    } catch (error) {
      console.error("Error verifying session:", error);
      setStatus("error");
      toast.error("Failed to verify payment status");
    }
  }, [sessionId, purchaseType]);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    if (type === "credits") {
      setPurchaseType("credits");
    }

    fetchSessionStatus();
  }, [sessionId, type, fetchSessionStatus]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="border-red-200">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-red-600">
                Payment Verification Failed
              </CardTitle>
              <CardDescription>
                We couldn&apos;t verify your payment. Please contact support if
                you believe this is an error.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <Button onClick={() => router.push("/billing")} variant="outline">
                View Billing
              </Button>
              <Button onClick={() => router.push("/dashboard")}>
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card className="border-green-200">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-green-600">
              {purchaseType === "credits"
                ? "Credits Purchased!"
                : "Subscription Activated!"}
            </CardTitle>
            <CardDescription>
              {purchaseType === "credits"
                ? "Your credits have been added to your account and are ready to use."
                : "Your subscription is now active and you have access to all features."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {sessionData && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-700">
                  Payment Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">
                      {formatAmount(
                        sessionData.amount_total,
                        sessionData.currency,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">
                      {sessionData.customer_email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium text-green-600 capitalize">
                      {sessionData.payment_status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {purchaseType === "credits" ? (
                <>
                  <Button
                    onClick={() => router.push("/billing")}
                    className="w-full"
                  >
                    <Coins className="w-4 h-4 mr-2" />
                    View Credits Balance
                  </Button>
                  <Button
                    onClick={() => router.push("/dashboard")}
                    variant="outline"
                    className="w-full"
                  >
                    Start Using Credits
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => router.push("/billing")}
                    className="w-full"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Manage Subscription
                  </Button>
                  <Button
                    onClick={() => router.push("/dashboard")}
                    variant="outline"
                    className="w-full"
                  >
                    Explore Features
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                A confirmation email has been sent to{" "}
                {sessionData?.customer_email}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
