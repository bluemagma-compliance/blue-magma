"use client";

import { useAuth } from "@/context/AuthContext";
import { SendInvitationForm } from "@/components/admin/SendInvitationForm";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InvitationsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">User Invitations</h1>
          <p className="text-gray-600 mt-2">
            Manage user invitations for your organization
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <SendInvitationForm />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              How it works
            </h3>
            <div className="bg-white p-6 rounded-lg shadow-lg space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">
                  1. Send Invitation
                </h4>
                <p className="text-sm text-gray-600">
                  Enter the user&apos;s email and select their role. An
                  invitation email will be sent to them.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">
                  2. User Receives Email
                </h4>
                <p className="text-sm text-gray-600">
                  The user will receive an email with a secure invitation link
                  that expires in 7 days.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">
                  3. Account Creation
                </h4>
                <p className="text-sm text-gray-600">
                  When they click the link, they&apos;ll be taken to a signup
                  page where they can create their account.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">
                  4. Automatic Access
                </h4>
                <p className="text-sm text-gray-600">
                  Once they complete signup, they&apos;ll automatically have
                  access to your organization with the assigned role.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">
                Test Invitation Link
              </h4>
              <p className="text-sm text-blue-800 mb-2">
                For testing purposes, you can use this sample invitation link:
              </p>
              <code className="text-xs bg-blue-100 p-2 rounded block break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}
                /invite/sample-token-123
              </code>
              <p className="text-xs text-blue-700 mt-2">
                Note: This is just for UI testing. Real invitations will have
                secure tokens.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
