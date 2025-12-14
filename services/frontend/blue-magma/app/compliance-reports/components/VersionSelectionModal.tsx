"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GitBranch, GitCommit, Loader2 } from "lucide-react";
import type { Codebase, CodebaseVersion } from "@/types/api";

interface VersionSelectionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
  codebases: Codebase[];
  isGenerating: boolean;
  onConfirm: (versionId: string) => void;
  onCancel: () => void;
}

export const VersionSelectionModal: React.FC<VersionSelectionModalProps> = ({
  isOpen,
  onOpenChange,
  templateId,
  templateName,
  codebases,
  isGenerating,
  onConfirm,
  onCancel,
}) => {
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedCodebaseId, setSelectedCodebaseId] = useState<string>("");

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedVersionId("");
      setSelectedCodebaseId("");
      
      // If there's only one codebase, auto-select it
      if (codebases.length === 1) {
        setSelectedCodebaseId(codebases[0].object_id);
      }
    }
  }, [isOpen, codebases]);

  const selectedCodebase = codebases.find(cb => cb.object_id === selectedCodebaseId);
  const availableVersions = selectedCodebase?.versions || [];

  // Define formatVersionDisplay function before using it
  const formatVersionDisplay = (version: CodebaseVersion) => {
    const shortHash = version.commit_hash?.substring(0, 7) || "unknown";
    return `v${shortHash}`;
  };

  // Create a map of version ID to display value for the select
  const versionDisplayMap = availableVersions.reduce((acc, version) => {
    acc[version.object_id] = formatVersionDisplay(version);
    return acc;
  }, {} as Record<string, string>);

  const handleConfirm = () => {
    if (selectedVersionId) {
      onConfirm(selectedVersionId);
    }
  };

  const handleCancel = () => {
    setSelectedVersionId("");
    setSelectedCodebaseId("");
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Select Version for Report Generation</DialogTitle>
          <DialogDescription>
            Choose which version of the codebase to use for generating the &ldquo;{templateName}&rdquo; report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Codebase Selection (if multiple codebases) */}
          {codebases.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="codebase-select">Codebase</Label>
              <Select
                value={selectedCodebaseId}
                onValueChange={setSelectedCodebaseId}
              >
                <SelectTrigger id="codebase-select">
                  <SelectValue placeholder="Select a codebase" />
                </SelectTrigger>
                <SelectContent>
                  {codebases.map((codebase) => (
                    <SelectItem key={codebase.object_id} value={codebase.object_id}>
                      <div className="flex flex-col w-full min-w-0">
                        <span className="font-medium truncate">{codebase.codebase_name}</span>
                        {codebase.codebase_description && (
                          <span className="text-xs text-muted-foreground truncate">
                            {codebase.codebase_description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Single Codebase Display */}
          {codebases.length === 1 && (
            <div className="space-y-2">
              <Label>Codebase</Label>
              <div className="p-3 border rounded-md bg-muted/30">
                <div className="font-medium">{codebases[0].codebase_name}</div>
                {codebases[0].codebase_description && (
                  <div className="text-sm text-muted-foreground">
                    {codebases[0].codebase_description}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Version Selection */}
          {selectedCodebase && (
            <div className="space-y-2">
              <Label htmlFor="version-select">Version</Label>
              {availableVersions.length === 0 ? (
                <div className="p-3 border rounded-md bg-muted/30 text-center text-muted-foreground">
                  No versions available for this codebase
                </div>
              ) : (
                <div className="w-[100px]">
                  <Select
                    value={selectedVersionId}
                    onValueChange={setSelectedVersionId}
                  >
                    <SelectTrigger className="w-full text-sm font-mono">
                      <SelectValue placeholder="Select">
                        {selectedVersionId ? versionDisplayMap[selectedVersionId] : "Select"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-[100px]">
                      {availableVersions.map((version) => (
                        <SelectItem
                          key={version.object_id}
                          value={version.object_id}
                          className="text-sm font-mono justify-center"
                        >
                          {formatVersionDisplay(version)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}


        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedVersionId || isGenerating || availableVersions.length === 0}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              "Generate Report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
