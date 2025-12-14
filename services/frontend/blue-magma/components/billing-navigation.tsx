"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreditCard, Crown, Coins, Settings, ArrowRight } from "lucide-react";

interface BillingNavigationProps {
  variant?: "button" | "card" | "links";
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function BillingNavigation({
  variant = "card",
  size = "default",
  className = "",
}: BillingNavigationProps) {
  const router = useRouter();

  const navigationItems = [
    {
      label: "Billing Dashboard",
      href: "/billing",
      icon: CreditCard,
      description: "Manage subscription and view invoices",
    },
    {
      label: "Subscription Plans",
      href: "/subscription",
      icon: Crown,
      description: "View and change subscription plans",
    },
    {
      label: "Purchase Credits",
      href: "/credits",
      icon: Coins,
      description: "Buy credits for additional features",
    },
    {
      label: "Account Settings",
      href: "/settings?tab=billing",
      icon: Settings,
      description: "Organization billing settings",
    },
  ];

  if (variant === "button") {
    return (
      <Button
        onClick={() => router.push("/billing")}
        className={className}
        size={size}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Billing
      </Button>
    );
  }

  if (variant === "links") {
    return (
      <div className={`space-y-1 ${className}`}>
        {navigationItems.map((item) => (
          <Button
            key={item.href}
            variant="ghost"
            size={size}
            onClick={() => router.push(item.href)}
            className="w-full justify-start"
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Billing & Subscription
        </CardTitle>
        <CardDescription>Quick access to billing features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {navigationItems.map((item) => (
          <Button
            key={item.href}
            variant="outline"
            size="sm"
            onClick={() => router.push(item.href)}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
            <ArrowRight className="h-3 w-3" />
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
