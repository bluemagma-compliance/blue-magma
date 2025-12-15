"use client";

import type React from "react";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

interface ScanRetentionCardProps {
  codebaseId: string;
}

export function ScanRetentionCard({ codebaseId }: ScanRetentionCardProps) {
  const [retentionPolicy, setRetentionPolicy] = useState("7days"); // Default: 7 days
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Saving retention policy for codebase:", codebaseId, {
      retentionPolicy,
    });
    toast.success("Retention Policy Updated", {
      description: "Scan data retention settings have been saved.",
    });
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <ArchiveRestore className="mr-2 h-5 w-5" />
          Scan Data Retention
        </CardTitle>
        <CardDescription>
          Choose how long to keep code scan data after it&apos;s generated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="retention-policy">Retention Policy</Label>
            <Select value={retentionPolicy} onValueChange={setRetentionPolicy}>
              <SelectTrigger id="retention-policy" className="w-full max-w-md">
                <SelectValue placeholder="Select retention policy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediately">
                  Delete Immediately After Use
                </SelectItem>
                <SelectItem value="7days">Delete After 7 Days</SelectItem>
                <SelectItem value="30days">Delete After 30 Days</SelectItem>
                <SelectItem value="90days">Delete After 90 Days</SelectItem>
                <SelectItem value="never">
                  Keep Indefinitely (Not Recommended for large volumes)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Retention Policy"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
