"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowRight } from "lucide-react";

export function BillingLinkCard() {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="mr-2 h-5 w-5" />
          Billing & Subscription
        </CardTitle>
        <CardDescription>
          Manage your subscription, view billing history, and purchase credits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => router.push("/billing")} className="w-full">
          Open Billing Dashboard
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          View your current plan, manage subscriptions, and purchase additional
          credits.
        </p>
      </CardContent>
    </Card>
  );
}
