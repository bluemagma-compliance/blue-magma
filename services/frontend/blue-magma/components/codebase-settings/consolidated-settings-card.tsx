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
import { usePermissions } from "@/hooks/usePermissions";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteCodebaseDialog } from "./delete-codebase-dialog";
import { IngestionCommandCard } from "./ingestion-command-card";
import type { Codebase } from "@/types/api";

interface ConsolidatedSettingsCardProps {
  codebaseId: string;
  codebaseName: string;
  codebase: Codebase;
}

export function ConsolidatedSettingsCard({
  codebaseId,
  codebaseName,
  codebase,
}: ConsolidatedSettingsCardProps) {
  const {
    permissions,
    loading: permissionsLoading,
    canManageOrganization,
    canDeleteOrganization,
    getRoleDisplayName,
  } = usePermissions();

  // Retention settings state (current form value)
  const [retentionPolicy, setRetentionPolicy] = useState("never");
  const [isRetentionLoading, setIsRetentionLoading] = useState(false);

  // Saved retention settings (for overview display)
  const [savedRetentionPolicy, setSavedRetentionPolicy] = useState("never");

  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Permission checks for codebase settings
  const canModifyRetention =
    canManageOrganization() || permissions?.current_role === "legal";
  const canDeleteCodebase =
    canDeleteOrganization() && codebase.source_type === "manual";

  const handleRetentionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRetentionLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Saving retention policy for codebase:", codebaseId, {
      retentionPolicy,
    });

    // Update saved value for overview display
    setSavedRetentionPolicy(retentionPolicy);

    toast.success("Retention Policy Updated", {
      description: "Scan data retention settings have been saved.",
    });
    setIsRetentionLoading(false);
  };

  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">
            Loading permissions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Settings Overview - Compact Stats */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Settings Overview</CardTitle>
              <CardDescription>
                Current configuration summary for this codebase.
              </CardDescription>
            </div>
            {permissions && (
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-muted-foreground">Your role:</span>
                <span className="font-medium">
                  {getRoleDisplayName(permissions.current_role)}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Data Retention Status */}
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-muted-foreground">
                Data Retention
              </span>
              <span className="text-lg font-semibold">
                {savedRetentionPolicy === "immediately" && "Delete Immediately"}
                {savedRetentionPolicy === "7days" && "7 Days"}
                {savedRetentionPolicy === "30days" && "30 Days"}
                {savedRetentionPolicy === "90days" && "90 Days"}
                {savedRetentionPolicy === "never" && "Keep Forever"}
              </span>
            </div>

            {/* Access Level */}
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-muted-foreground">
                Your Access
              </span>
              <span className="text-lg font-semibold">
                {canModifyRetention ? "Full Access" : "Read Only"}
              </span>
            </div>

            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-muted-foreground">
                Last Updated
              </span>
              <span className="text-lg font-semibold">Just now</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Data Retention Card */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ArchiveRestore className="h-5 w-5 text-primary" />
              <span>Data Retention</span>
            </CardTitle>
            <CardDescription>
              Choose how long to keep scan data after reports are generated.
              {!canModifyRetention && " (Read-only access)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {canModifyRetention ? (
              <form onSubmit={handleRetentionSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="retention-policy">Retention Policy</Label>
                  <Select
                    value={retentionPolicy}
                    onValueChange={setRetentionPolicy}
                  >
                    <SelectTrigger id="retention-policy">
                      <SelectValue placeholder="Select retention policy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediately">
                        Delete Immediately After Use
                      </SelectItem>
                      <SelectItem value="7days">Delete After 7 Days</SelectItem>
                      <SelectItem value="30days">
                        Delete After 30 Days
                      </SelectItem>
                      <SelectItem value="90days">
                        Delete After 90 Days
                      </SelectItem>
                      <SelectItem value="never">Don&apos;t Delete</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    This setting affects how long scan data is stored in the
                    system.
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={isRetentionLoading}
                  className="w-full"
                >
                  {isRetentionLoading ? "Saving..." : "Save Retention Policy"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Retention Policy</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <span className="font-medium">
                      {savedRetentionPolicy === "immediately" &&
                        "Delete Immediately After Use"}
                      {savedRetentionPolicy === "7days" &&
                        "Delete After 7 Days"}
                      {savedRetentionPolicy === "30days" &&
                        "Delete After 30 Days"}
                      {savedRetentionPolicy === "90days" &&
                        "Delete After 90 Days"}
                      {savedRetentionPolicy === "never" && "Don't Delete"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You don&apos;t have permission to modify this setting.
                    Contact an administrator or legal team member.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ingestion Command Card */}
        {codebase.source_type === "manual" && (
          <IngestionCommandCard codebase={codebase} />
        )}
      </div>

      {/* Danger Zone - Delete Codebase (Only for Owners) */}
      {canDeleteCodebase && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              <span>Danger Zone</span>
            </CardTitle>
            <CardDescription>
              Irreversible actions that will permanently affect this codebase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-background border border-destructive/20 rounded-md">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium text-destructive">
                      Delete Codebase
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this codebase and all associated data.
                      This action cannot be undone.
                    </p>
                    <div className="mt-3">
                      <p className="text-xs font-medium text-destructive mb-1">
                        What will be deleted:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li>• All scan reports and historical data</li>
                        <li>• Access permissions and settings</li>
                        <li>• Integration configurations</li>
                      </ul>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="ml-4 shrink-0"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <DeleteCodebaseDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        codebaseId={codebaseId}
        codebaseName={codebaseName}
      />
    </div>
  );
}
