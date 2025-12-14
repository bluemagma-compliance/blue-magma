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
import { DeleteCodebaseDialog } from "./delete-codebase-dialog";

interface DeleteCodebaseCardProps {
  codebaseId: string;
  codebaseName: string;
}

export function DeleteCodebaseCard({
  codebaseId,
  codebaseName,
}: DeleteCodebaseCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <Trash2 className="mr-2 h-5 w-5" />
            Delete Codebase
          </CardTitle>
          <CardDescription>
            Permanently delete this codebase and all its associated data,
            including scan reports and history. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setIsDialogOpen(true)}>
            Delete {codebaseName}
          </Button>
        </CardContent>
      </Card>
      <DeleteCodebaseDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        codebaseId={codebaseId}
        codebaseName={codebaseName}
      />
    </>
  );
}
