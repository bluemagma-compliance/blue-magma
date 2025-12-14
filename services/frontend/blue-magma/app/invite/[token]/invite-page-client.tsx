"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { acceptInvitationAction } from "@/app/invite/actions";

interface InvitationData {
  valid: boolean;
  email: string;
  organization_name: string;
  role: string;
  inviter_name: string;
  expires_at: string;
}

interface InvitePageClientProps {
  token: string;
  invitationData: InvitationData | null;
  error: string | null;
}

export function InvitePageClient({
  token,
  invitationData,
  error,
}: InvitePageClientProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
    phone: "",
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitationData) {
      toast.error("Invalid invitation");
      return;
    }

    startTransition(async () => {
      try {
        const formDataObj = new FormData();
        formDataObj.append("token", token);
        formDataObj.append("firstName", formData.firstName);
        formDataObj.append("lastName", formData.lastName);
        formDataObj.append("password", formData.password);
        formDataObj.append("phone", formData.phone);

        const result = await acceptInvitationAction(formDataObj);

        if (result.success) {
          toast.success("Account created successfully! Please log in.");
          router.push("/login");
        } else {
          toast.error(result.message || "Failed to accept invitation");
        }
      } catch (error) {
        console.error("Accept invitation error:", error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    });
  };

  // Show error state
  if (error) {
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

        <div className="space-y-4 text-center">
          <h1 className="text-3xl font-bold text-red-600">
            Invalid Invitation
          </h1>
          <p className="text-gray-600">{error}</p>
          <div className="pt-4">
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Go to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (!invitationData) {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-xl">
        <div className="flex justify-center mb-6">
          <Image
            src="/logos/pngs/24 Black Horizontal.png"
            alt="Blue Magma"
            width={200}
            height={45}
            className="h-18 w-auto"
          />
        </div>
        <div className="text-center">
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold text-gray-900">
          Accept Your Invitation
        </h1>
        <p className="text-gray-600">
          You&apos;ve been invited to join{" "}
          <strong>{invitationData.organization_name}</strong> as a{" "}
          <strong>{invitationData.role}</strong>
        </p>
        <p className="text-sm text-gray-500">
          Invited by {invitationData.inviter_name}
        </p>
      </div>

      {/* Invitation Details */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Invitation Details</h3>
        <div className="space-y-1 text-sm text-blue-800">
          <p>
            <strong>Email:</strong> {invitationData.email}
          </p>
          <p>
            <strong>Organization:</strong> {invitationData.organization_name}
          </p>
          <p>
            <strong>Role:</strong> {invitationData.role}
          </p>
          <p>
            <strong>Expires:</strong>{" "}
            {new Date(invitationData.expires_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first-name">First Name</Label>
            <Input
              id="first-name"
              name="firstName"
              type="text"
              placeholder="Jane"
              required
              className="mt-1"
              value={formData.firstName}
              onChange={handleInputChange}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="last-name">Last Name</Label>
            <Input
              id="last-name"
              name="lastName"
              type="text"
              placeholder="Doe"
              required
              className="mt-1"
              value={formData.lastName}
              onChange={handleInputChange}
              disabled={isPending}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="phone">Phone Number (Optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(555) 123-4567"
            className="mt-1"
            value={formData.phone}
            onChange={handleInputChange}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="password">Create Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            className="mt-1"
            value={formData.password}
            onChange={handleInputChange}
            disabled={isPending}
            minLength={8}
          />
          <p className="text-xs text-gray-500 mt-1">
            Password must be at least 8 characters long
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700"
          disabled={isPending}
        >
          {isPending
            ? "Creating Account..."
            : "Accept Invitation & Create Account"}
        </Button>
      </form>

      <div className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
