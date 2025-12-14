"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Search,
  Code,
  GitBranch,
  Github,
  Gitlab,
  Link2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { EnhancedAddCodebaseModal } from "./enhanced-add-codebase-modal";
import { getCodebases, deleteCodebase } from "@/app/codebases/actions";
import type { Codebase } from "@/types/api";

export function CodebasesTab() {
  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [filteredCodebases, setFilteredCodebases] = useState<Codebase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load codebases on component mount
  useEffect(() => {
    loadCodebases();
  }, []);

  // Filter codebases based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCodebases(codebases);
    } else {
      const filtered = codebases.filter(
        (codebase) =>
          codebase.codebase_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          codebase.codebase_repo_url.toLowerCase().includes(searchTerm.toLowerCase()) ||
          codebase.codebase_type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCodebases(filtered);
    }
  }, [codebases, searchTerm]);

  const loadCodebases = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCodebases();
      setCodebases(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load codebases";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodebaseAdded = useCallback((newCodebase: Codebase) => {
    setCodebases((prev) => [...prev, newCodebase]);
    toast.success(`Successfully added codebase: ${newCodebase.codebase_name}`);
  }, []);

  const handleDeleteCodebase = async (codebase: Codebase) => {
    if (
      !confirm(
        `Are you sure you want to delete "${codebase.codebase_name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteCodebase(codebase.object_id);
      setCodebases((prev) => prev.filter((cb) => cb.object_id !== codebase.object_id));
      toast.success(`Successfully deleted codebase: ${codebase.codebase_name}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete codebase";
      toast.error(errorMessage);
    }
  };

  const getRepoIcon = (url: string) => {
    if (!url) return <GitBranch className="h-4 w-4 text-muted-foreground" />;
    if (url.includes("github.com"))
      return <Github className="h-4 w-4 text-muted-foreground" />;
    if (url.includes("gitlab.com"))
      return <Gitlab className="h-4 w-4 text-muted-foreground" />;
    return <Link2 className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (codebase: Codebase) => {
    // Mock status based on codebase data
    const isGitHub = codebase.codebase_repo_url?.includes("github.com");
    const hasRecentActivity = true; // Mock data

    if (isGitHub && hasRecentActivity) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-500">
          <CheckCircle className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    } else if (isGitHub) {
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-500">
          <Clock className="mr-1 h-3 w-3" />
          Syncing
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-500">
          <Code className="mr-1 h-3 w-3" />
          Manual
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <span>Loading codebases...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search codebases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <EnhancedAddCodebaseModal onCodebaseAdded={handleCodebaseAdded}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Codebase
          </Button>
        </EnhancedAddCodebaseModal>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Codebases Grid */}
      {filteredCodebases.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCodebases.map((codebase) => (
            <Card key={codebase.object_id} className="relative group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {getRepoIcon(codebase.codebase_repo_url)}
                    <CardTitle className="text-lg truncate">
                      {codebase.codebase_name}
                    </CardTitle>
                  </div>
                  {getStatusBadge(codebase)}
                </div>
                <CardDescription className="line-clamp-2">
                  {codebase.codebase_description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <Badge variant="secondary">{codebase.codebase_type}</Badge>
                  </div>
                  
                  {codebase.codebase_repo_url && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Repository:</span>
                      <a
                        href={codebase.codebase_repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-blue-600 hover:text-blue-800 truncate max-w-[150px]"
                      >
                        <span className="truncate">
                          {codebase.codebase_repo_url.replace(/^https?:\/\//, "")}
                        </span>
                        <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  )}

                  {codebase.codebase_repo_url?.includes("github.com") && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Source:</span>
                      <div className="flex items-center text-gray-600">
                        <Github className="mr-1 h-3 w-3" />
                        <span>GitHub</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      ID: {codebase.object_id.slice(0, 8)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCodebase(codebase)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <Code className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {searchTerm ? "No codebases found" : "No codebases yet"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchTerm
                    ? `No codebases match "${searchTerm}". Try adjusting your search.`
                    : "Get started by adding your first codebase to begin monitoring compliance and security."}
                </p>
              </div>
              {!searchTerm && (
                <EnhancedAddCodebaseModal onCodebaseAdded={handleCodebaseAdded}>
                  <Button size="lg">
                    <Plus className="mr-2 h-5 w-5" />
                    Add Your First Codebase
                  </Button>
                </EnhancedAddCodebaseModal>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
