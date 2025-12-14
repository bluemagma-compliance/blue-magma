"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { DeleteAccountDialog } from "./delete-account-dialog";

interface DeleteAccountCardProps {
  orgId: string;
  orgName: string;
}

export function DeleteAccountCard({ orgId, orgName }: DeleteAccountCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <Trash2 className="mr-2 h-5 w-5" />
            Delete Organization Account
          </CardTitle>
          <CardDescription>
            Permanently delete this organization account and all its associated
            data, including all codebases, users, reports, and billing
            information. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setIsDialogOpen(true)}>
            Delete {orgName} Account
          </Button>
        </CardContent>
      </Card>
      <DeleteAccountDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        orgId={orgId}
        orgName={orgName}
      />
    </>
  );
}
