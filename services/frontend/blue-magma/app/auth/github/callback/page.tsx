"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle, AlertCircle, Github } from "lucide-react";

export default function GitHubCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get URL parameters
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Handle OAuth errors
        if (error) {
          const message =
            error === "access_denied"
              ? "GitHub login was cancelled. You can try again if you changed your mind."
              : `GitHub OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`;

          setErrorMessage(message);
          setStatus("error");
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setErrorMessage(
            "Invalid OAuth callback parameters. Please try logging in again.",
          );
          setStatus("error");
          return;
        }

        // The actual token exchange is handled by the API route
        // This page is just for showing the processing state
        // The API route will redirect on success, so if we get here with valid params,
        // we should redirect to the API route
        window.location.href = `/api/auth/github/callback?code=${code}&state=${state}`;
      } catch (error) {
        console.error("GitHub callback processing error:", error);
        setErrorMessage("An unexpected error occurred during GitHub login.");
        setStatus("error");
      }
    };

    processCallback();
  }, [searchParams]);

  const handleRetry = () => {
    router.push("/login");
  };

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  if (status === "processing") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-xl">Processing GitHub Login</CardTitle>
            <CardDescription>
              Please wait while we complete your GitHub authentication...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <Github className="h-4 w-4" />
              <span>Connecting with GitHub</span>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-16 h-16 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">Login Successful!</CardTitle>
            <CardDescription>
              You have successfully logged in with GitHub.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGoToDashboard} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Error state
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-xl">Login Failed</CardTitle>
          <CardDescription>
            There was a problem with your GitHub login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>

          <div className="flex flex-col space-y-2">
            <Button onClick={handleRetry} variant="default" className="w-full">
              Try Again
            </Button>
            <Button
              onClick={handleGoToDashboard}
              variant="outline"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
