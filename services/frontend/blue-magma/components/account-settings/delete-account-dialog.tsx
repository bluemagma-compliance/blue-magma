"use client";

import { useState } from "react";
import { deleteOrganizationAction } from "@/app/settings/user-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  orgId: string;
  orgName: string;
}

export function DeleteAccountDialog({
  isOpen,
  onOpenChange,
  orgId,
  orgName,
}: DeleteAccountDialogProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (confirmationText !== orgName) {
      toast.error(`Please type "${orgName}" to confirm deletion.`);
      return;
    }

    setIsLoading(true);

    try {
      const result = await deleteOrganizationAction();

      // If result is returned, the organization deletion or logout did not redirect.
      if (!result?.success) {
        toast.error(
          result?.error ||
            "Failed to delete organization. Please try again or contact support.",
        );
        return;
      }
    } catch (error) {
      const typedError = error as { message?: string; digest?: string };
      const message = typedError?.message;
      const digest = typedError?.digest;

      // Allow Next.js redirect() (NEXT_REDIRECT) to bubble up so navigation works
      // properly instead of being treated as an error.
      if (
        message === "NEXT_REDIRECT" ||
        (typeof digest === "string" && digest.includes("NEXT_REDIRECT"))
      ) {
        throw error;
      }

      console.error("Error deleting organization:", error);
      toast.error(
        "An unexpected error occurred while deleting the organization. Please try again.",
      );
      return;
    } finally {
      setIsLoading(false);
    }

    // On successful delete, deleteOrganizationAction will call logoutAction,
    // which revokes tokens, clears cookies, and redirects to /login.
    // Any code below this point is unlikely to run due to the redirect.
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Organization: {orgName}?</DialogTitle>
          <DialogDescription>
            This action is irreversible. It will permanently delete the{" "}
            <strong>{orgName}</strong> organization, all its codebases, users,
            scan reports, billing information, and any other associated data. To
            confirm, please type{" "}
            <strong className="text-foreground">{orgName}</strong> in the box
            below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="orgConfirmation" className="sr-only">
            Type organization name to confirm
          </Label>
          <Input
            id="orgConfirmation"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={`Type "${orgName}" here`}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmationText !== orgName || isLoading}
          >
            {isLoading ? "Deleting Account..." : `Delete ${orgName} Account`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
