"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/app/auth/password-reset-actions";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }

    startTransition(async () => {
      const result = await requestPasswordReset(trimmed);

      if (!result.success) {
        toast.error(result.message || "Unable to request password reset.");
        return;
      }

      setSubmitted(true);
      toast.success(
        "If an account exists for that email, you'll receive a reset link shortly.",
      );
    });
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
          <h1 className="text-3xl font-bold text-gray-900">Forgot password</h1>
          <p className="text-gray-600">
            Enter the email associated with your account and we&apos;ll send you a
            link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              If an account exists for <span className="font-medium">{email}</span>,
              you&apos;ll receive an email with a link to reset your password. The
              link will expire after a short time for security.
            </p>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Back to login
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Sending reset link..." : "Send reset link"}
            </Button>

            <p className="pt-2 text-center text-sm text-gray-600">
              Remember your password?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

