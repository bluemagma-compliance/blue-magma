"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface DeleteCodebaseDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  codebaseId: string;
  codebaseName: string;
}

export function DeleteCodebaseDialog({
  isOpen,
  onOpenChange,
  codebaseId,
  codebaseName,
}: DeleteCodebaseDialogProps) {
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    if (confirmationText !== codebaseName) {
      toast.error("Incorrect Confirmation", {
        description: `Please type "${codebaseName}" to confirm deletion.`,
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call the DELETE API endpoint which forwards to /api/v1/org/{org_id}/codebase/{codebase_id}
      const response = await fetch(
        `/api/codebases?codebaseId=${encodeURIComponent(codebaseId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete codebase");
      }

      toast.success("Codebase Deleted", {
        description: `${codebaseName} has been permanently deleted.`,
      });

      onOpenChange(false);
      router.push("/codebases"); // Redirect to codebases list after deletion
    } catch (error) {
      console.error("Error deleting codebase:", error);
      toast.error("Delete Failed", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while deleting the codebase.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Codebase: {codebaseName}?</DialogTitle>
          <DialogDescription>
            This action is irreversible and will permanently delete the
            codebase, all its scan reports, and associated data. To confirm,
            please type{" "}
            <strong className="text-foreground">{codebaseName}</strong> in the
            box below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="confirmation" className="sr-only">
            Type codebase name to confirm
          </Label>
          <Input
            id="confirmation"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={`Type "${codebaseName}" here`}
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
            disabled={confirmationText !== codebaseName || isLoading}
          >
            {isLoading ? "Deleting..." : `Delete ${codebaseName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
