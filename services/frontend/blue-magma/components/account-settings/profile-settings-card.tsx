"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Building, Palette, Languages, Lock } from "lucide-react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/app/auth/password-reset-actions";
import { updateOrganizationName } from "@/app/settings/user-actions";
interface ProfileSettingsCardProps {
  currentOrgName: string;
  currentUserRole?: string;
  currentUserEmail?: string;
}

export function ProfileSettingsCard({
  currentOrgName,
  currentUserRole,
  currentUserEmail,
}: ProfileSettingsCardProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState("en");
  const [orgName, setOrgName] = useState(currentOrgName);
  const [isSavingOrgName, setIsSavingOrgName] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOrgName(currentOrgName);
  }, [currentOrgName]);

  const isOwner = currentUserRole === "owner";

  if (!mounted) return null; // Avoid hydration mismatch

  return (
    <div className="space-y-8">
      {/* Organization Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building className="mr-2 h-5 w-5" />
            Organization Profile
          </CardTitle>
          <CardDescription>
            Update your organization&apos;s basic information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <div className="flex gap-2">
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  readOnly={!isOwner || isSavingOrgName}
                  className={isOwner ? "" : "bg-muted"}
                  placeholder="Organization name"
                />
                {isOwner && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isSavingOrgName || orgName.trim().length === 0}
                    onClick={async () => {
                      try {
                        setIsSavingOrgName(true);
                        await updateOrganizationName(orgName.trim());
                        toast.success("Organization name updated");
                      } catch (error) {
                        toast.error("Failed to update organization name", {
                          description:
                            error instanceof Error
                              ? error.message
                              : "An unexpected error occurred",
                        });
                      } finally {
                        setIsSavingOrgName(false);
                      }
                    }}
                  >
                    {isSavingOrgName ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isOwner
                  ? "Organization name can be managed by the organization owner."
                  : "Organization name is managed by your organization owner."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Password & Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="mr-2 h-5 w-5" />
            Password &amp; Security
          </CardTitle>
          <CardDescription>
            Manage how you sign in by sending yourself a secure password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Account email</Label>
            <div className="text-sm font-medium text-foreground">
              {currentUserEmail || "Not available"}
            </div>
            <p className="text-xs text-muted-foreground">
              We&apos;ll send password reset links to your primary account email.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Reset your password</div>
              <p>
                We&apos;ll email you a secure link to reset your password. The link
                will expire after a short time for security.
              </p>
            </div>
            <Button
              type="button"
              disabled={!currentUserEmail || isSendingReset}
              onClick={async () => {
                if (!currentUserEmail) {
                  toast.error("Unable to send reset link", {
                    description: "We couldn&apos;t determine your account email.",
                  });
                  return;
                }

                setIsSendingReset(true);
                setResetMessage(null);
                try {
                  const result = await requestPasswordReset(currentUserEmail);
                  if (!result.success) {
                    const description =
                      result.message ||
                      "Unable to request password reset. Please try again.";
                    toast.error("Couldn&apos;t send reset link", { description });
                    setResetMessage(description);
                    return;
                  }

                  const successMessage =
                    "If an account exists for that email, you&apos;ll receive a reset link shortly.";
                  toast.success("Reset link sent", {
                    description: successMessage,
                  });
                  setResetMessage(successMessage);
                } catch (error) {
                  const description =
                    error instanceof Error
                      ? error.message
                      : "An unexpected error occurred. Please try again.";
                  toast.error("Couldn&apos;t send reset link", { description });
                  setResetMessage(description);
                } finally {
                  setIsSendingReset(false);
                }
              }}
            >
              {isSendingReset ? "Sending..." : "Send reset link"}
            </Button>
          </div>

          {resetMessage && (
            <p className="text-xs text-muted-foreground">{resetMessage}</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Appearance Settings Section */}

      {/* Appearance Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Palette className="mr-2 h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize the look and feel of the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="language" className="flex items-center">
              <Languages className="mr-2 h-4 w-4 text-muted-foreground" />{" "}
              Language
            </Label>
            <Select value={language} onValueChange={setLanguage} disabled>
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only English is currently supported. Additional languages coming soon.
            </p>
          </div>

          {/* <div className="space-y-2">
            <Label>Color Theme</Label>
            <RadioGroup
              value={theme}
              onValueChange={setTheme}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light">Light</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark">Dark</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system">System</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Theme changes are applied instantly and saved automatically.
            </p>
          </div> */}
        </CardContent>
      </Card>

      {/* Delete Account Section - HIDDEN: Only 1 user per org currently */}
      {/* <Separator />

      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <Trash2 className="mr-2 h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Remove your account from this organization. This action cannot be
            undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-background border border-destructive/20 rounded-md">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium text-destructive">
                    Remove Account
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {isOwner
                      ? "As the organization owner, you must transfer ownership before deleting your account."
                      : "This will remove your account from the organization and revoke all access."}
                  </p>
                  {isOwner ? (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-xs font-medium text-yellow-700 mb-1">
                        Required before deletion:
                      </p>
                      <ul className="text-xs text-yellow-600 space-y-0.5">
                        <li>• Transfer ownership to another administrator</li>
                        <li>
                          • Go to the &quot;Users & Access&quot; tab to transfer
                          ownership
                        </li>
                        <li>• Then return here to delete your account</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-destructive mb-1">
                        What will happen:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>
                          • Your account will be removed from this organization
                        </li>
                        <li>• You will lose access to all organization data</li>
                        <li>• This action cannot be undone</li>
                      </ul>
                    </div>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="ml-4 shrink-0"
                      disabled={isDeletingAccount || isOwner}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {isOwner ? "Transfer Ownership First" : "Delete Account"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center text-destructive">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Confirm Account Deletion
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {isOwner
                          ? "You cannot delete your account while you are the organization owner. Please transfer ownership to another administrator first, then return to delete your account."
                          : "Are you sure you want to delete your account from this organization? This action is permanent and cannot be undone. You will lose access to all organization data."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeletingAccount}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={isDeletingAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeletingAccount
                          ? "Deleting..."
                          : "Yes, Delete My Account"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card> */}
    </div>
  );
}
