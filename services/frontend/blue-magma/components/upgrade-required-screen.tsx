"use client";

import Link from "next/link";
import { Lock, ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UpgradeRequiredScreenProps {
  featureName: string;
  description?: string;
}

// Generic upgrade gate for free-plan users trying to access paid-only pages.
// Used by Integrations and Knowledge Base pages so free users see a clear
// "Upgrade to unlock" experience even on direct URL access.
export function UpgradeRequiredScreen({
  featureName,
  description,
}: UpgradeRequiredScreenProps) {
  return (
    <div className="flex w-full h-full items-center justify-center py-16 px-4">
      <Card className="max-w-xl w-full shadow-sm border-dashed">
        <CardHeader className="flex flex-col items-center text-center gap-2">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Lock className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">
            {featureName} is available on paid plans
          </CardTitle>
          <CardDescription>
            {description ||
              "Upgrade your plan to unlock this feature for your organization."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button asChild className="w-full sm:w-auto gap-2">
            <Link href="/subscription">
              Upgrade plan
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto gap-2 text-muted-foreground"
          >
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

