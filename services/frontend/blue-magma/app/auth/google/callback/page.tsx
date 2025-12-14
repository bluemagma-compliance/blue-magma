"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function GoogleCallbackPage() {
  const [status, setStatus] = useState<"processing" | "error" | "success">(
    "processing",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();

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
              ? "Google login was cancelled. You can try again if you changed your mind."
              : `Google OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`;

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
        window.location.href = `/api/auth/google/callback?code=${code}&state=${state}`;
      } catch (error) {
        console.error("Google callback processing error:", error);
        setErrorMessage("An unexpected error occurred during Google login.");
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Completing Google Login
          </h2>
          <p className="text-gray-600">
            Please wait while we finish setting up your account...
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Login Failed
          </h2>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <div className="space-y-3">
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={handleGoToDashboard}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state (shouldn't normally be reached due to redirect)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Login Successful!
        </h2>
        <p className="text-gray-600 mb-6">
          You have been successfully logged in with Google.
        </p>
        <Button onClick={handleGoToDashboard} className="w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
