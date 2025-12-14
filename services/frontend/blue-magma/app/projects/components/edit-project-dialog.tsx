"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronDown, ChevronRight, Code, ExternalLink } from "lucide-react";
import { getCodebases } from "@/app/codebases/actions";
import type { Codebase } from "@/types/api";
import type { Project } from "../actions";
import Link from "next/link";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onUpdateProject: (projectData: {
    name?: string;
    description?: string;
    status?: "initializing" | "active" | "up-to-date" | "out-of-date" | "audit-ready" | "completed" | "on-hold";
  }) => Promise<{ success: boolean; error?: string }>;
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  onUpdateProject,
}: EditProjectDialogProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState<"initializing" | "active" | "up-to-date" | "out-of-date" | "audit-ready" | "completed" | "on-hold">(project.status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data sources state
  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [isLoadingCodebases, setIsLoadingCodebases] = useState(false);
  const [selectedCodebases, setSelectedCodebases] = useState<Set<string>>(new Set());
  const [isCodebasesExpanded, setIsCodebasesExpanded] = useState(false);

  // Load codebases when dialog opens
  useEffect(() => {
    if (open) {
      loadCodebases();
    }
  }, [open]);

  const loadCodebases = async () => {
    setIsLoadingCodebases(true);
    try {
      const data = await getCodebases();
      const codebaseList = data || [];
      setCodebases(codebaseList);
      // Select all by default
      setSelectedCodebases(new Set(codebaseList.map(cb => cb.object_id)));
    } catch (err) {
      console.error("Failed to load codebases:", err);
      setCodebases([]);
      setSelectedCodebases(new Set());
    } finally {
      setIsLoadingCodebases(false);
    }
  };

  const toggleAllCodebases = (checked: boolean) => {
    if (checked) {
      setSelectedCodebases(new Set(codebases.map(cb => cb.object_id)));
    } else {
      setSelectedCodebases(new Set());
    }
  };

  const toggleCodebase = (codebaseId: string, checked: boolean) => {
    const newSelected = new Set(selectedCodebases);
    if (checked) {
      newSelected.add(codebaseId);
    } else {
      newSelected.delete(codebaseId);
    }
    setSelectedCodebases(newSelected);
  };

  const allCodebasesSelected = codebases.length > 0 && selectedCodebases.size === codebases.length;

  // Update form when project changes
  useEffect(() => {
    setName(project.name);
    setDescription(project.description);
    setStatus(project.status);
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onUpdateProject({
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });

      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to update project");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      if (!newOpen) {
        // Reset form to project values when closing
        setName(project.name);
        setDescription(project.description);
        setStatus(project.status);
        setError(null);
        setSelectedCodebases(new Set());
        setIsCodebasesExpanded(false);
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update project details and settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="e.g., HIPAA Compliance Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe the purpose and scope of this project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={4}
              />
            </div>

            {/* Status Field */}
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value: "initializing" | "active" | "up-to-date" | "out-of-date" | "audit-ready" | "completed" | "on-hold") => setStatus(value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="initializing">Initializing</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="up-to-date">Up to Date</SelectItem>
                  <SelectItem value="out-of-date">Out of Date</SelectItem>
                  <SelectItem value="audit-ready">Audit Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data Sources Section */}
            <div className="space-y-3 pt-2 border-t">
              <Label>Data Sources (Optional)</Label>

              {isLoadingCodebases ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading data sources...
                </div>
              ) : codebases.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">There&apos;s nothing here... 👀</p>
                    <p className="mb-4">
                      We could just stare at each other, but my guess is you probably just want to add some data sources instead 😉
                    </p>
                  </div>
                  <Link href="/knowledge-base" onClick={() => handleOpenChange(false)}>
                    <Button variant="outline" size="sm" type="button">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Add Data Sources
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 border rounded-md p-3">
                  {/* Select All Checkbox */}
                  <div className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                    <Checkbox
                      id="edit-select-all-codebases"
                      checked={allCodebasesSelected}
                      onCheckedChange={toggleAllCodebases}
                      disabled={isSubmitting}
                    />
                    <label
                      htmlFor="edit-select-all-codebases"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      Codebases ({selectedCodebases.size}/{codebases.length} selected)
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="h-6 w-6 p-0"
                      onClick={() => setIsCodebasesExpanded(!isCodebasesExpanded)}
                    >
                      {isCodebasesExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Individual Codebases */}
                  {isCodebasesExpanded && (
                    <div className="mt-2 space-y-1 ml-6 max-h-48 overflow-y-auto">
                      {codebases.map((codebase) => (
                        <div key={codebase.object_id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50">
                          <Checkbox
                            id={`edit-codebase-${codebase.object_id}`}
                            checked={selectedCodebases.has(codebase.object_id)}
                            onCheckedChange={(checked) => toggleCodebase(codebase.object_id, checked as boolean)}
                            disabled={isSubmitting}
                          />
                          <label
                            htmlFor={`edit-codebase-${codebase.object_id}`}
                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            <div className="flex items-center gap-2">
                              <Code className="h-3 w-3 text-muted-foreground" />
                              <span>{codebase.codebase_name}</span>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

