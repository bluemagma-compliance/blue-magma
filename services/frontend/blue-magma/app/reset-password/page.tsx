"use client";

import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmPasswordReset,
  validateResetToken,
} from "@/app/auth/password-reset-actions";
import { toast } from "sonner";

type Status = "validating" | "missing" | "invalid" | "ready";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("validating");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [token, setToken] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const rawToken = searchParams.get("token") || "";

    if (!rawToken) {
      setStatus("missing");
      setStatusMessage(
        "This reset link is missing a token. Please use the link from your email or request a new one.",
      );
      return;
    }

    setToken(rawToken);
    setStatus("validating");
    setStatusMessage(undefined);

    validateResetToken(rawToken)
      .then((res) => {
        if (!res.valid) {
          setStatus("invalid");
          setStatusMessage(
            res.message || "This password reset link is invalid or has expired.",
          );
        } else {
          setStatus("ready");
        }
      })
      .catch((err) => {
        console.error("Error validating reset token", err);
        setStatus("invalid");
        setStatusMessage("Unable to validate reset link. Please try again.");
      });
  }, [searchParams]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!token) {
      toast.error("Reset token is missing or invalid.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await confirmPasswordReset(
        token,
        newPassword,
        confirmPassword,
      );

      if (!result.success) {
        toast.error(result.message || "Unable to reset password.");
        return;
      }

      toast.success("Your password has been reset. You can now log in.");
      router.push("/login");
    });
  };

  const renderContent = () => {
    if (status === "validating") {
      return (
        <p className="text-sm text-gray-700">
          Validating your reset link, please wait...
        </p>
      );
    }

    if (status === "missing" || status === "invalid") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {statusMessage ||
              "This password reset link is invalid or has expired."}
          </p>
          <div className="space-y-2">
            <Link href="/forgot-password">
              <Button className="w-full">Request a new reset link</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Back to login
              </Button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="password">New password</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Use at least 8 characters. A mix of letters, numbers, and symbols is
            recommended.
          </p>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            className="mt-1"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Resetting password..." : "Reset password"}
        </Button>

        <p className="pt-2 text-center text-sm text-gray-600">
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Back to login
          </Link>
        </p>
      </form>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-xl">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Image
            src="/logos/pngs/24 Black Horizontal.png"
            alt="Blue Magma"
            width={200}
            height={45}
            className="h-18 w-auto"
          />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Reset password</h1>
          <p className="text-gray-600">
            Choose a new password for your Blue Magma account.
          </p>
        </div>

        {renderContent()}
      </div>
    </main>
  );
}

