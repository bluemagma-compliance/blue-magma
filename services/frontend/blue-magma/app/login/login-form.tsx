"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { siGithub, siGoogle } from "simple-icons";
import { useAuth } from "@/context/AuthContext";
import { startGitHubLogin } from "@/app/auth/github/actions";

import { toast } from "sonner";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { loginUser, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        const result = await loginUser(email, password);

        if (result.success) {
          toast.success("Login successful!");
          router.push("/dashboard");
        } else {
          toast.error(result.message || "Login failed");
        }
      } catch (error) {
        console.error("Login error:", error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    });
  };

  const handleGitHubLogin = async () => {
    try {
      setIsGitHubLoading(true);
      const result = await startGitHubLogin("/dashboard");

      if (result.success && result.oauth_url) {
        // Redirect to GitHub OAuth
        window.location.href = result.oauth_url;
      } else {
        toast.error(result.error || "Failed to start GitHub login");
        setIsGitHubLoading(false);
      }
    } catch (error) {
      console.error("GitHub login error:", error);
      toast.error("An unexpected error occurred");
      setIsGitHubLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      const result = await loginWithGoogle("/dashboard");

      if (result.success && result.oauth_url) {
        // Redirect to Google OAuth
        window.location.href = result.oauth_url;
      } else {
        toast.error(result.error || "Failed to start Google login");
        setIsGoogleLoading(false);
      }
    } catch (error) {
      console.error("Google login error:", error);
      toast.error("An unexpected error occurred");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-xl">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Image
          src="/logos/pngs/24 Black Horizontal.png"
          alt="Blue Magma"
          width={200}
          height={45}
          className="h-18 w-auto"
        />
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Log in</h1>
        <p className="text-gray-600">
          Welcome back! Please enter your details.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            className="mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            className="mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isPending}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <Separator className="my-4" />

      <div className="flex justify-center gap-4">
        {" "}
        {/* Changed from space-y-4 to flex layout */}
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isPending}
        >
          {isGoogleLoading ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d={siGoogle.path} />
              </svg>
              Continue with Google
            </>
          )}
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleGitHubLogin}
          disabled
        >
          {isGitHubLoading ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
              </svg>
              Connecting...
            </>
          ) : (
            <>
              <svg
                className="mr-2 h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d={siGithub.path} />
              </svg>
              Continue with GitHub
            </>
          )}
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-gray-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
