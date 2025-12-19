"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { sendInvitation } from "@/services/inviteServices";
import { useAuth } from "@/context/AuthContext";

export function SendInvitationForm() {
  const [formData, setFormData] = useState({
    email: "",
    role: "",
    firstName: "",
    lastName: "",
  });
  const [isPending, startTransition] = useTransition();
  const { organizationId } = useAuth();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      role: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      toast.error("Organization ID not found");
      return;
    }

    startTransition(async () => {
      try {
        // Get access token from cookies (you might need to implement this)
        const accessToken = document.cookie
          .split("; ")
          .find((row) => row.startsWith("access_token="))
          ?.split("=")[1];

        if (!accessToken) {
          toast.error("Authentication required");
          return;
        }

        const invitationData = {
          email: formData.email,
          role: formData.role,
          first_name: formData.firstName || undefined,
          last_name: formData.lastName || undefined,
        };

        const result = await sendInvitation(
          organizationId,
          invitationData,
          accessToken,
        );

        if (result.success) {
          toast.success("Invitation sent successfully!");
          // Reset form
          setFormData({
            email: "",
            role: "",
            firstName: "",
            lastName: "",
          });
        } else {
          toast.error(result.message || "Failed to send invitation");
        }
      } catch (error) {
        console.error("Send invitation error:", error);
        toast.error("An unexpected error occurred. Please try again.");
      }
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-6 rounded-lg bg-white p-6 shadow-lg">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Send Invitation</h2>
        <p className="text-gray-600">
          Invite a new user to join your organization.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="user@example.com"
            required
            className="mt-1"
            value={formData.email}
            onChange={handleInputChange}
            disabled={isPending}
          />
        </div>

        <div>
          <Label htmlFor="role">Role *</Label>
          <Select
            value={formData.role}
            onValueChange={handleRoleChange}
            disabled={isPending}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              type="text"
              placeholder="Jane"
              className="mt-1"
              value={formData.firstName}
              onChange={handleInputChange}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              name="lastName"
              type="text"
              placeholder="Doe"
              className="mt-1"
              value={formData.lastName}
              onChange={handleInputChange}
              disabled={isPending}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700"
          disabled={isPending || !formData.email || !formData.role}
        >
          {isPending ? "Sending Invitation..." : "Send Invitation"}
        </Button>
      </form>
    </div>
  );
}
