"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

interface OrganizationSignupClientProps {
  defaultFormData?: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
  };
}

export function OrganizationSignupClient({
  defaultFormData,
}: OrganizationSignupClientProps) {
  const [formData, setFormData] = useState(
    defaultFormData || {
      firstName: "",
      lastName: "",
      email: "test@example.com",
      password: "",
      phone: "",
    },
  );
  const [isPending, startTransition] = useTransition();
  const { signupUser } = useAuth();
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

    startTransition(async () => {
      try {
        const signupData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
        };

        const result = await signupUser(signupData);

        if (result.success) {
          toast.success("Account created successfully!");
          router.push("/dashboard");
        } else {
          toast.error(result.message || "Signup failed");
        }
      } catch (error) {
        console.error("Signup error:", error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    });
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
        <h1 className="text-3xl font-bold text-gray-900">
          Set Up Your Organization
        </h1>
        <p className="text-gray-600">
          Just a few more details to create your account and organization.
        </p>
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
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="(555) 123-4567"
            required
            className="mt-1"
            value={formData.phone}
            onChange={handleInputChange}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="test@example.com"
            required
            className="mt-1"
            value={formData.email}
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
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Creating Account..." : "Create Organization & Account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-gray-500">
        By clicking the button above, you agree to our{" "}
        <Link
          href="/terms"
          className="font-medium text-primary hover:underline"
        >
          Terms & Conditions
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="font-medium text-primary hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>
        .
      </p>
    </div>
  );
}
