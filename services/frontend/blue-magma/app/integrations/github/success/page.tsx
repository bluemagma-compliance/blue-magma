"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  AlertCircle,
  GitBranch,
  ArrowRight,
  RefreshCw,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function GitHubSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Get URL parameters
  const connected = searchParams.get("connected");
  const installationId = searchParams.get("installation_id");
  const error = searchParams.get("error");

  // Auto-redirect after success
  useEffect(() => {
    if (connected === "1" && installationId) {
      // Show success toast
      toast.success("GitHub integration connected successfully!");

      // Auto-redirect after 3 seconds
      const timer = setTimeout(() => {
        setIsRedirecting(true);
        router.push("/integrations/github");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [connected, installationId, router]);

  // Handle error cases
  if (error === "expired") {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[600px]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl">Session Expired</CardTitle>
              <CardDescription>
                Your GitHub installation session has expired. Please try
                connecting again.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The installation session expired before it could be completed.
                  This can happen if you take too long to complete the GitHub
                  installation process.
                </AlertDescription>
              </Alert>

              <div className="flex space-x-2">
                <Button asChild className="flex-1">
                  <Link href="/integrations/github">Try Again</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/integrations">Back to Integrations</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Handle other error cases
  if (error) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[600px]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl">Connection Failed</CardTitle>
              <CardDescription>
                There was an error connecting your GitHub organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Error: {error}</AlertDescription>
              </Alert>

              <div className="flex space-x-2">
                <Button asChild className="flex-1">
                  <Link href="/integrations/github">Try Again</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/integrations">Back to Integrations</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Handle success case
  if (connected === "1" && installationId) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[600px]">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-16 h-16 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">
                GitHub Connected Successfully!
              </CardTitle>
              <CardDescription>
                Your GitHub organization has been connected and is ready for
                compliance scanning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <GitBranch className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">
                    Installation Details
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  Installation ID:{" "}
                  <code className="bg-green-100 px-1 rounded">
                    {installationId}
                  </code>
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">What happens next?</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      Your repositories are being synchronized in the background
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      You can now link repositories to codebases for compliance
                      scanning
                    </p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                    <p>
                      Automatic webhook updates will keep your compliance
                      reports current
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                {isRedirecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Redirecting to GitHub integration...</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Redirecting in a few seconds...</span>
                  </>
                )}
              </div>

              <div className="flex space-x-2">
                <Button asChild className="flex-1" disabled={isRedirecting}>
                  <Link href="/integrations/github">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Go to GitHub Integration
                  </Link>
                </Button>
                <Button variant="outline" asChild disabled={isRedirecting}>
                  <Link href="/integrations">All Integrations</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Handle case where no parameters are provided (direct access)
  return (
    <AuthenticatedLayout>
      <div className="flex items-center justify-center min-h-[600px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center">
              <GitBranch className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">GitHub Integration</CardTitle>
            <CardDescription>
              Connect your GitHub organization to get started with automated
              compliance scanning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              It looks like you accessed this page directly. To connect your
              GitHub organization, please start from the integrations page.
            </p>

            <div className="flex space-x-2">
              <Button asChild className="flex-1">
                <Link href="/integrations/github">Connect GitHub</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/integrations">All Integrations</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
