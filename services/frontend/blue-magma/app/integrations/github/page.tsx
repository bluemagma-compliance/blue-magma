"use client";

import { useState, useEffect } from "react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  GitBranch,
  Plus,
  Settings,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Building,
  User,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  getGitHubInstallations,
  startGitHubInstallation,
  triggerGitHubBaseline,
  getGitHubProxyInstallations,
  type GitHubInstallation,
} from "./actions";

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function getRepositoryCountText(installation: GitHubInstallation): string {
  if (installation.repository_selection === "all") {
    return `All repositories`;
  } else {
    const repoCount = installation.repositories.length;
    return `${repoCount} repository${repoCount !== 1 ? "ies" : ""}`;
  }
}

const InstallationCard = ({
  installation,
  onTriggerBaseline,
}: {
  installation: GitHubInstallation;
  onTriggerBaseline: (accountLogin: string) => Promise<void>;
}) => {
  const account: GitHubInstallation["accounts"][number] | null =
    installation.accounts[0];
  if (!account) {
    return null;
  }
  return (
    <Card key={installation.id} className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {installation.target_type === "Organization" ? (
              <Building className="h-5 w-5 text-muted-foreground" />
            ) : (
              <User className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-lg">{account.login}</CardTitle>
              <CardDescription>
                {getRepositoryCountText(installation)}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {installation.suspended_at ? (
              <Badge variant="destructive">Suspended</Badge>
            ) : (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800"
              >
                Active
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Connected:</span>
              <p className="font-medium">
                {formatDate(installation.created_at)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Sync:</span>
              <p className="font-medium">
                {formatDate(installation.updated_at)}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTriggerBaseline(account.login)}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Sync Repositories
            </Button>

            <Button variant="outline" size="sm" asChild>
              <Link
                href={
                  installation.target_type === "User"
                    ? `https://github.com/settings/installations/${installation.id}`
                    : `https://github.com/organizations/${account.login}/settings/installations/${installation.id}`
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-3 w-3" />
                Manage on GitHub
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function GitHubIntegrationPage() {
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [proxyInstallations, setProxyInstallations] =
    useState<GitHubInstallation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load installations on component mount
  useEffect(() => {
    loadInstallations();
  }, []);

  const loadInstallations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [data, proxyData] = await Promise.all([
        getGitHubInstallations(),
        getGitHubProxyInstallations().catch(() => []), // Gracefully handle proxy fetch errors
      ]);
      setInstallations(data);
      setProxyInstallations(proxyData);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to load GitHub installations";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      setIsConnecting(true);
      const returnUrl = "/integrations/github/success";
      const { install_url } = await startGitHubInstallation(returnUrl);

      // Redirect to GitHub
      window.location.href = install_url;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to start GitHub installation";
      toast.error(errorMessage);
      setIsConnecting(false);
    }
  };

  const handleTriggerBaseline = async (accountLogin: string) => {
    try {
      await triggerGitHubBaseline();
      toast.success(`Baseline sync started for ${accountLogin}`);

      // Refresh installations to update last_baseline_at
      await loadInstallations();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to trigger baseline sync";
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading GitHub integrations...</span>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/integrations">← Back to Integrations</Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <div className="p-2 bg-gray-900 rounded-lg mr-3">
                <GitBranch className="h-6 w-6 text-white" />
              </div>
              GitHub Integration
            </h1>
            <p className="text-muted-foreground">
              Connect your GitHub repositories for automated compliance scanning
              and monitoring.
            </p>
          </div>

          <Button
            onClick={handleConnectGitHub}
            disabled={isConnecting}
            size="lg"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Connected Organizations */}
        {installations.length > 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Connected Organizations
              </h2>
              <div className="grid gap-4">
                {installations.map((installation) => (
                  <InstallationCard
                    key={installation.id}
                    installation={installation}
                    onTriggerBaseline={handleTriggerBaseline}
                  />
                ))}
              </div>
            </div>

            {/* Proxy Installations Info */}
            {proxyInstallations.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Integration Details</h2>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">GitHub App Installations</CardTitle>
                    <CardDescription>
                      Information about your GitHub App installations and permissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {proxyInstallations.map((installation) => {
                        const account = installation.accounts[0];
                        return (
                          <div key={installation.id} className="p-4 border rounded-lg space-y-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-base">{account?.login || "Unknown"}</p>
                                <p className="text-sm text-muted-foreground">
                                  Installation ID: {installation.id}
                                </p>
                              </div>
                              <Badge variant="outline">
                                {installation.target_type}
                              </Badge>
                            </div>

                            <Separator />

                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground text-xs">Repository Selection</p>
                                <p className="font-medium capitalize">
                                  {installation.repository_selection}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">Repositories</p>
                                <p className="font-medium">
                                  {installation.repositories.length}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">App ID</p>
                                <p className="font-medium">{installation.app_id}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs">App Slug</p>
                                <p className="font-medium">{installation.app_slug}</p>
                              </div>
                            </div>

                            {/* Permissions */}
                            {Object.keys(installation.permissions).length > 0 && (
                              <>
                                <Separator />
                                <div>
                                  <p className="text-sm font-medium mb-2">Permissions</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(installation.permissions).map(([key, value]) => (
                                      <Badge key={key} variant="secondary" className="capitalize">
                                        {key}: {value}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Events */}
                            {installation.events.length > 0 && (
                              <>
                                <Separator />
                                <div>
                                  <p className="text-sm font-medium mb-2">Subscribed Events</p>
                                  <div className="flex flex-wrap gap-2">
                                    {installation.events.map((event) => (
                                      <Badge key={event} variant="outline" className="capitalize">
                                        {event}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Connected Repositories */}
                            {installation.repositories.length > 0 && (
                              <>
                                <Separator />
                                <div>
                                  <p className="text-sm font-medium mb-2">Connected Repositories</p>
                                  <div className="flex flex-wrap gap-2">
                                    {installation.repositories.map((repo) => (
                                      <Badge key={repo.id} variant="secondary">
                                        {repo.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Timestamps */}
                            <Separator />
                            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                              <div>
                                <p>Connected: {formatDate(installation.created_at)}</p>
                              </div>
                              <div>
                                <p>Last Updated: {formatDate(installation.updated_at)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-4">
                <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                  <GitBranch className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    No GitHub Organizations Connected
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Connect your GitHub organization to start automatically
                    scanning your repositories for compliance issues.
                  </p>
                </div>
                <Button
                  onClick={handleConnectGitHub}
                  disabled={isConnecting}
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Connect Your First Organization
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Integration Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>GitHub Integration Benefits</CardTitle>
            <CardDescription>
              Streamline your compliance workflow with GitHub integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Automatic Repository Scanning
                </h4>
                <p className="text-sm text-muted-foreground">
                  Automatically scan all connected repositories for compliance
                  issues without manual intervention.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-blue-500" />
                  Real-time Webhook Updates
                </h4>
                <p className="text-sm text-muted-foreground">
                  Get instant updates when code is pushed, ensuring your
                  compliance reports are always current.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <Building className="mr-2 h-4 w-4 text-purple-500" />
                  Organization-wide Coverage
                </h4>
                <p className="text-sm text-muted-foreground">
                  Connect entire GitHub organizations to monitor all
                  repositories from a single integration.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <Settings className="mr-2 h-4 w-4 text-orange-500" />
                  Flexible Repository Selection
                </h4>
                <p className="text-sm text-muted-foreground">
                  Choose to monitor all repositories or select specific ones
                  based on your compliance needs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
