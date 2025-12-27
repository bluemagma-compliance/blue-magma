"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Step = "credentials" | "code" | "success";

interface SuperAdminLoginResponse {
  success?: boolean;
  message?: string;
}

interface SuperAdminVerify2FAResponse extends SuperAdminLoginResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

async function postJson<T>(url: string, body: unknown): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
}> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data: T | null = null;
  try {
    data = (await response.json()) as T;
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

export default function SuperAdminLoginClient() {
  const [step, setStep] = useState<Step>("credentials");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { ok, data } = await postJson<SuperAdminLoginResponse>(
        "/super-admin/api/login",
        {
          login_identifier: loginIdentifier,
          password,
        },
      );

      if (!ok || !data?.success) {
        const message = data?.message || "Super admin login failed";
        setError(message);
        toast.error(message);
        return;
      }

      toast.success("2FA code sent to configured super admin addresses.");
      setStep("code");
    } catch (err) {
      console.error("Super admin login error:", err);
      const message = "Network error during super admin login";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { ok, data } = await postJson<SuperAdminVerify2FAResponse>(
        "/super-admin/api/verify-2fa",
        {
          login_identifier: loginIdentifier,
          code,
        },
      );

      if (!ok || !data?.success || !data.access_token) {
        const message = data?.message || "2FA verification failed";
        setError(message);
        toast.error(message);
        return;
      }

      setToken(data.access_token);
      setExpiresIn(data.expires_in ?? null);
      setStep("success");
      toast.success("Super admin authentication successful.");
    } catch (err) {
      console.error("Super admin 2FA verification error:", err);
      const message = "Network error during 2FA verification";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "success") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-900">
            Super admin token issued
          </h2>
          <p className="text-sm text-gray-600">
            Use this token as a Bearer token when calling super admin APIs
            from your secure tooling.
          </p>
        </div>
        {token && (
          <div className="space-y-1">
            <Label htmlFor="token">Access token</Label>
            <textarea
              id="token"
              className="w-full rounded-md border border-gray-300 bg-gray-50 p-2 text-xs font-mono break-all"
              rows={4}
              readOnly
              value={token}
            />
            {typeof expiresIn === "number" && (
              <p className="text-xs text-gray-500">
                Expires in approximately {Math.round(expiresIn / 60)} minutes.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {step === "credentials" && (
        <form className="space-y-4" onSubmit={handleCredentialsSubmit}>
          <div className="space-y-1">
            <Label htmlFor="login-identifier">Login identifier</Label>
            <Input
              id="login-identifier"
              type="text"
              autoComplete="off"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending 2FA code..." : "Continue"}
          </Button>
        </form>
      )}

      {step === "code" && (
        <form className="space-y-4" onSubmit={handleCodeSubmit}>
          <div className="space-y-1">
            <Label htmlFor="code">2FA code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-gray-500">
              Enter the 6-digit code sent to the configured super admin email
              addresses.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Verifying..." : "Verify and get token"}
          </Button>
        </form>
      )}
    </div>
  );
}

