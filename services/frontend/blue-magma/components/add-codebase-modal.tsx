"use client";

import type React from "react";

import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import {
  Github,
  Gitlab,
  Link2,
  Loader2,
  FolderGit2,
  GitBranch,
} from "lucide-react"; // Added FolderGit2 and GitBranch
import type { SubjectType, Codebase } from "@/types/api";
import { getSubjectTypes } from "@/app/dashboard/actions";
import { IngestionCommandModal } from "./ingestion-command-modal";

// Utility function to extract repository name from URL
function extractRepoNameFromUrl(url: string): string {
  if (!url) return "";

  try {
    // Remove .git suffix if present
    const cleanUrl = url.replace(/\.git$/, "");

    // Extract the last part of the path
    const parts = cleanUrl.split("/");
    const repoName = parts[parts.length - 1];

    // Return the repo name, keeping original case
    return repoName || "";
  } catch {
    return "";
  }
}

interface AddCodebaseModalProps {
  children: ReactNode; // Trigger element
  onCodebaseAdded?: (codebase: Codebase) => void; // Callback when codebase is added
}

export type CodebaseType = string;

export interface CodebaseFormData {
  repoUrl: string;
  name: string;
  pathInRepo: string;
  codebaseType: CodebaseType;
  description: string;
}

export function AddCodebaseModal({
  children,
  onCodebaseAdded,
}: AddCodebaseModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState("");
  const [pathInRepo, setPathInRepo] = useState("");
  const [codebaseType, setCodebaseType] = useState<CodebaseType>("__none__");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [showIngestionModal, setShowIngestionModal] = useState(false);
  const [createdCodebase, setCreatedCodebase] = useState<Codebase | null>(null);

  // Fetch subject types when modal opens
  useEffect(() => {
    if (isOpen && subjectTypes.length === 0) {
      const fetchSubjectTypes = async () => {
        setLoadingTypes(true);
        try {
          const types = await getSubjectTypes();
          console.log("Fetched subject types:", types);
          setSubjectTypes(types);
        } catch (error) {
          console.error("Failed to fetch subject types:", error);
        } finally {
          setLoadingTypes(false);
        }
      };
      fetchSubjectTypes();
    }
  }, [isOpen, subjectTypes.length]);

  // Auto-populate name from repository URL
  useEffect(() => {
    if (repoUrl && !name) {
      const extractedName = extractRepoNameFromUrl(repoUrl);
      if (extractedName) {
        setName(extractedName);
      }
    }
  }, [repoUrl, name]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Validate repository URL is required
    if (!repoUrl || repoUrl.trim() === "") {
      setError("Repository URL is required.");
      return;
    }

    // Validate repository URL format
    try {
      new URL(repoUrl);
    } catch (_) {
      setError("Invalid Repository URL format.");
      console.log("Invalid URL format", _);
      return;
    }

    if (!codebaseType || codebaseType.trim() === "") {
      setError("Codebase type is required.");
      return;
    }

    setIsLoading(true);

    try {
      // Use provided name or extract from URL, fallback to "New Codebase"
      const finalName =
        name.trim() || extractRepoNameFromUrl(repoUrl) || "New Codebase";

      const requestBody = {
        codebase_name: finalName,
        codebase_repo_url: repoUrl.trim(),
        codebase_description: description,
        codebase_type: codebaseType.trim(),
      };

      console.log("Creating codebase with data:", requestBody);

      const response = await fetch("/api/codebases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Backend error response:", errorData);
        throw new Error(
          errorData.error || `Failed to create codebase (${response.status})`,
        );
      }

      const newCodebase = await response.json();
      console.log("Form submitted successfully", newCodebase);

      setIsOpen(false);
      resetForm();

      // Store the created codebase and show ingestion modal
      setCreatedCodebase(newCodebase);
      setShowIngestionModal(true);

      // Call the callback to update the parent component's state
      if (onCodebaseAdded) {
        onCodebaseAdded(newCodebase);
      }
    } catch (err) {
      console.error("Submission failed:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred.",
      );
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setRepoUrl("");
    setName("");
    setPathInRepo("");
    setCodebaseType("");
    setDescription("");
    setError(null);
  };

  const getRepoIcon = (url: string) => {
    if (!url) return <GitBranch className="h-4 w-4 text-muted-foreground" />;
    if (url.includes("github.com"))
      return <Github className="h-4 w-4 text-muted-foreground" />;
    if (url.includes("gitlab.com"))
      return <Gitlab className="h-4 w-4 text-muted-foreground" />;
    if (url.includes("bitbucket.org"))
      return <GitBranch className="h-4 w-4 text-muted-foreground" />;
    if (
      url.includes(".git") ||
      url.startsWith("git@") ||
      url.startsWith("ssh://")
    )
      return <GitBranch className="h-4 w-4 text-muted-foreground" />;
    return <Link2 className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add New Codebase</DialogTitle>
            <DialogDescription>
              Create a new codebase for scanning and compliance management.
              Repository URL and type are required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="repoUrl">
                Repository URL <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {getRepoIcon(repoUrl)}
                </div>
                <Input
                  id="repoUrl"
                  placeholder="https://your-git-provider.com/your-org/your-repo.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Link to your repository (GitHub, GitLab, Bitbucket, or any Git
                URL).
              </p>
            </div>
            <div>
              <Label htmlFor="name">Codebase Name</Label>
              <Input
                id="name"
                placeholder="Repository name will be auto-populated"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Name will be auto-populated from repository URL, but you can
                customize it.
              </p>
            </div>
            <div>
              <Label htmlFor="pathInRepo">Path in Repository (Optional)</Label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="pathInRepo"
                  placeholder="e.g., apps/frontend or services/api"
                  value={pathInRepo}
                  onChange={(e) => setPathInRepo(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Specify a subdirectory if scanning part of a monorepo.
              </p>
            </div>
            <div>
              <Label htmlFor="codebaseType">
                Codebase Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={codebaseType}
                onValueChange={(value: CodebaseType) => setCodebaseType(value)}
              >
                <SelectTrigger id="codebaseType" className="mt-1">
                  <SelectValue
                    placeholder={
                      loadingTypes ? "Loading types..." : "Select type..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subjectTypes
                    .filter((type) =>
                      [
                        "frontend",
                        "backend",
                        "application",
                        "infrastructure",
                      ].includes(type.object_id.toLowerCase()),
                    )
                    .map((type) => (
                      <SelectItem key={type.object_id} value={type.object_id}>
                        {type.name.charAt(0).toUpperCase() + type.name.slice(1)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select the type that best describes your codebase.
              </p>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="A brief description of the codebase."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Codebase"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ingestion Command Modal */}
      <IngestionCommandModal
        isOpen={showIngestionModal}
        onOpenChange={setShowIngestionModal}
        codebase={createdCodebase}
      />
    </>
  );
}
