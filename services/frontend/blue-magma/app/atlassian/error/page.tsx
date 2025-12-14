"use client";

import { useSearchParams } from "next/navigation";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function ConfluenceErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const description = searchParams.get("description");

  const errorMessages: Record<string, string> = {
    missing_parameters: "Missing required OAuth parameters",
    auth_context: "Authentication context not found",
    callback_failed: "Failed to process Confluence callback",
    server_error: "An unexpected server error occurred",
    access_denied: "You denied access to the Confluence integration",
    invalid_scope: "Invalid scope requested",
    duplicate_installation: "Confluence workspace already connected",
  };

  const errorTitle = errorMessages[error || ""] || "Connection Error";
  const errorDesc =
    description ||
    "An error occurred while connecting to Confluence. Please try again.";

  return (
    <AuthenticatedLayout>
      <div className="flex items-center justify-center min-h-[600px]">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Confluence Connection Failed</CardTitle>
            <CardDescription>{errorTitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{errorDesc}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">What you can do:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Check that you have the correct Confluence workspace</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Ensure you have admin permissions in Confluence</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Try connecting again from the Integrations page</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button asChild className="flex-1">
                <Link href="/integrations/confluence">
                  Try Again
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/integrations">Back to Integrations</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}

