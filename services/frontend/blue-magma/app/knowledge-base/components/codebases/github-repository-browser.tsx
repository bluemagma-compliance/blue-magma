"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Github,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  Archive,
  Plus,
  ExternalLink,
  AlertTriangle,
  Building,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getGitHubInstallations,
  getGitHubRepositories,
  linkGitHubRepository,
  startGitHubInstallation,
  type GitHubInstallation,
  type GitHubRepository,
} from "../../../integrations/github/actions";
import type { Codebase } from "@/types/api";

interface GitHubRepositoryBrowserProps {
  onCodebaseAdded: (codebase: Codebase) => void;
  onClose: () => void;
}

export function GitHubRepositoryBrowser({ onCodebaseAdded, onClose }: GitHubRepositoryBrowserProps) {
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [filteredRepositories, setFilteredRepositories] = useState<GitHubRepository[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCodebaseType, setSelectedCodebaseType] = useState("backend");
  const [isLoadingInstallations, setIsLoadingInstallations] = useState(true);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLinking, setIsLinking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInstallations = useCallback(async () => {
    try {
      setIsLoadingInstallations(true);
      setError(null);
      const data = await getGitHubInstallations();
      setInstallations(data);

      // Auto-select first installation if only one exists
      if (data.length === 1) {
        const installationId = data[0].installation_id ?? data[0].id;
        setSelectedInstallation(installationId);
        await loadRepositories(installationId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load GitHub installations";
      setError(errorMessage);
    } finally {
      setIsLoadingInstallations(false);
    }
  }, []);

  const loadRepositories = async (installationId: number) => {
    try {
      setIsLoadingRepositories(true);
      setSelectedInstallation(installationId);
      const repos = await getGitHubRepositories(installationId);
      setRepositories(repos);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load repositories";
      toast.error(errorMessage);
    } finally {
      setIsLoadingRepositories(false);
    }
  };

  // Load installations on component mount
  useEffect(() => {
    loadInstallations();
  }, [loadInstallations]);

  // Filter repositories based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredRepositories(repositories);
    } else {
      const filtered = repositories.filter(
        (repo) =>
          repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          repo.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRepositories(filtered);
    }
  }, [repositories, searchTerm]);

  const handleConnectGitHub = async () => {
    try {
      setIsConnecting(true);
      const returnUrl = "/data-sources?tab=codebases&github=connected";
      const { install_url } = await startGitHubInstallation(returnUrl);
      
      // Open in new window to avoid losing modal state
      window.open(install_url, "_blank", "width=800,height=600");
      
      toast.info("Complete the GitHub installation in the new window, then refresh this page.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start GitHub installation";
      toast.error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLinkRepository = async (repo: GitHubRepository) => {
    try {
      setIsLinking(repo.id.toString());
      const result = await linkGitHubRepository(repo, selectedCodebaseType);
      
      // Create a mock codebase object for the UI
      const newCodebase: Codebase = {
        object_id: result.object_id,
        codebase_name: result.codebase_name,
        codebase_repo_url: `https://github.com/${repo.full_name}`,
        codebase_description: `GitHub repository: ${repo.full_name}`,
        codebase_type: selectedCodebaseType,
        source_type: "github",
        api_key: "", // Will be set by backend
        rule_assignments: [], // Will be set by backend
        versions: [], // Will be set by backend
      };

      // Use the backend response directly so we keep source_type, api_key, etc.
      onCodebaseAdded(result);
      toast.success(`Successfully linked ${repo.full_name} to a new codebase`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to link repository";
      toast.error(errorMessage);
    } finally {
      setIsLinking(null);
    }
  };


  if (isLoadingInstallations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading GitHub integrations...</span>
        </div>
      </div>
    );
  }

  // No GitHub installations
  if (installations.length === 0) {
    return (
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        <div className="text-center space-y-4 py-8">
          <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
            <Github className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Connect GitHub Organization</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Connect your GitHub organization to import repositories as codebases automatically.
            </p>
          </div>
          <Button onClick={handleConnectGitHub} disabled={isConnecting} size="lg">
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Connect GitHub Organization
              </>
            )}
          </Button>
        </div>

        <div className="border-t pt-6">
          <h4 className="font-semibold text-sm mb-3">GitHub Integration Benefits</h4>
          <div className="grid gap-3 text-sm">
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>Automatic repository discovery and synchronization</span>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>Real-time webhook updates for code changes</span>
            </div>
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>Organization-wide repository access</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Installation Selector */}
      {installations.length > 1 && (
        <div>
          <Label htmlFor="installation">GitHub Organization</Label>
          <Select
            value={selectedInstallation?.toString() || ""}
            onValueChange={(value) => loadRepositories(parseInt(value))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select GitHub organization" />
            </SelectTrigger>
            <SelectContent>
              {installations.map((installation) => {
                const installationId = installation.installation_id ?? installation.id;
                return (
                  <SelectItem key={installationId} value={installationId.toString()}>
                    <div className="flex items-center space-x-2">
                      <Building className="h-4 w-4" />
                      <span>{installation.account_login}</span>
                      <Badge variant="secondary" className="text-xs">
                        {installation.account_type}
                      </Badge>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Repository Browser */}
      {selectedInstallation && (
        <>
          {/* Search and Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="search">Search Repositories</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search repositories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="codebaseType">Codebase Type</Label>
              <Select value={selectedCodebaseType} onValueChange={setSelectedCodebaseType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="frontend">Frontend</SelectItem>
                  <SelectItem value="backend">Backend</SelectItem>
                  <SelectItem value="fullstack">Full Stack</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="library">Library</SelectItem>
                  <SelectItem value="microservice">Microservice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Repository List */}
          {isLoadingRepositories ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading repositories...</span>
              </div>
            </div>
          ) : filteredRepositories.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">
                  Available Repositories ({filteredRepositories.length})
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadRepositories(selectedInstallation)}
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Refresh
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {filteredRepositories.map((repo) => (
                  <Card key={repo.full_name} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            {repo.private ? (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Unlock className="h-4 w-4 text-muted-foreground" />
                            )}
                            {repo.archived && (
                              <Archive className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{repo.full_name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {repo.default_branch} • {repo.private ? "Private" : "Public"}
                              {repo.archived && " • Archived"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={`https://github.com/${repo.full_name}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleLinkRepository(repo)}
                            disabled={repo.archived || repo.disabled || isLinking === repo.full_name}
                          >
                            {isLinking === repo.full_name ? (
                              <>
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                Linking...
                              </>
                            ) : (
                              <>
                                <Plus className="mr-2 h-3 w-3" />
                                Import
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {searchTerm ? `No repositories match "${searchTerm}"` : "No repositories found"}
              </p>
            </div>
          )}
        </>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
