"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  GitBranch,
  Github,
  Gitlab,
  Link2,
  FolderGit2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { createCodebase } from "@/app/codebases/actions";
import type { Codebase } from "@/types/api";

interface ManualCodebaseFormProps {
  onCodebaseAdded: (codebase: Codebase) => void;
  onClose: () => void;
}

export function ManualCodebaseForm({ onCodebaseAdded, onClose }: ManualCodebaseFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    repoUrl: "",
    description: "",
    type: "",
    pathInRepo: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate name from repository URL
  const handleRepoUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, repoUrl: url }));
    
    if (url && !formData.name) {
      // Extract repository name from URL
      const match = url.match(/\/([^\/]+?)(?:\.git)?(?:\/)?$/);
      if (match) {
        setFormData(prev => ({ ...prev, name: match[1] }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.repoUrl || !formData.type) {
      setError("Repository URL and type are required");
      return;
    }

    try {
      setIsSubmitting(true);

      const codebaseData = {
        codebase_name: formData.name || extractNameFromUrl(formData.repoUrl),
        codebase_repo_url: formData.repoUrl,
        codebase_description: formData.description,
        codebase_type: formData.type,
        codebase_path_in_repo: formData.pathInRepo || undefined,
      };

      const result = await createCodebase(codebaseData);

      // Create a mock codebase object for the UI
      const newCodebase: Codebase = {
        object_id: result.object_id,
        codebase_name: result.codebase_name,
        codebase_repo_url: codebaseData.codebase_repo_url,
        codebase_description: codebaseData.codebase_description || "",
        codebase_type: codebaseData.codebase_type,
        api_key: "", // Will be set by backend
        rule_assignments: [], // Will be set by backend
        versions: [], // Will be set by backend
        source_type: "manual", // Will be set by backend
      };

      onCodebaseAdded(newCodebase);
      toast.success(`Successfully created codebase: ${result.codebase_name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create codebase";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const extractNameFromUrl = (url: string): string => {
    const match = url.match(/\/([^\/]+?)(?:\.git)?(?:\/)?$/);
    return match ? match[1] : "New Codebase";
  };

  const getRepoIcon = (url: string) => {
    if (!url) return <GitBranch className="h-4 w-4 text-muted-foreground" />;
    if (url.includes("github.com")) return <Github className="h-4 w-4 text-muted-foreground" />;
    if (url.includes("gitlab.com")) return <Gitlab className="h-4 w-4 text-muted-foreground" />;
    return <Link2 className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Create a new codebase by providing repository details. Repository URL and type are required.
        </p>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="repoUrl">
              Repository URL <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {getRepoIcon(formData.repoUrl)}
              </div>
              <Input
                id="repoUrl"
                placeholder="https://your-git-provider.com/your-org/your-repo.git"
                value={formData.repoUrl}
                onChange={(e) => handleRepoUrlChange(e.target.value)}
                required
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Link to your repository (GitHub, GitLab, Bitbucket, or any Git URL).
            </p>
          </div>

          <div>
            <Label htmlFor="name">Codebase Name</Label>
            <Input
              id="name"
              placeholder="Repository name will be auto-populated"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Name will be auto-populated from repository URL, but you can customize it.
            </p>
          </div>

          <div>
            <Label htmlFor="type">
              Codebase Type <span className="text-red-500">*</span>
            </Label>
            <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select codebase type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frontend">Frontend</SelectItem>
                <SelectItem value="backend">Backend</SelectItem>
                <SelectItem value="fullstack">Full Stack</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="database">Database</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
                <SelectItem value="library">Library</SelectItem>
                <SelectItem value="microservice">Microservice</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pathInRepo">Path in Repository (Optional)</Label>
            <div className="relative mt-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FolderGit2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                id="pathInRepo"
                placeholder="e.g., /src, /backend, /packages/api"
                value={formData.pathInRepo}
                onChange={(e) => setFormData(prev => ({ ...prev, pathInRepo: e.target.value }))}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Specify a subdirectory if your code is not in the repository root.
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of this codebase..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Codebase"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
