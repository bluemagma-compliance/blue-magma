"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Code,
  Plus,
  Eye,
  FileText,
  FolderKanban,
  Database,
  Users,
  Shield,
  Zap,
  GitBranch,
  Package,
  CheckCircle2,
  Pause,
  Loader2,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getDashboardData, getOrganizationUsers, getOrganization } from "./actions";
import { getProjects } from "@/app/projects/actions";
import { getGitHubInstallations } from "@/app/integrations/github/actions";
import { getConfluenceIntegration } from "@/app/integrations/confluence/actions";
import { getDataSources } from "@/app/knowledge-base/actions";
import { OnboardingChatPanel } from "./components/onboarding-chat-panel";
import type { DataSource } from "@/app/knowledge-base/types";
import { isFeatureEnabled } from "@/config/features";
import type {
  CodebaseHealth,
  RecentReport,
  DashboardMetrics,
  Codebase,
  UserOverview,
} from "@/types/api";

import type { Project as BackendProject } from "@/app/projects/actions";

// Helper function to get status badge for projects
function getStatusBadge(status: string) {
  switch (status) {
    case 'initializing':
      return (
        <Badge variant="outline" className="text-purple-600 border-purple-500">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Initializing
        </Badge>
      );
    case 'active':
      return (
        <Badge variant="outline" className="text-green-600 border-green-500">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    case 'up-to-date':
      return (
        <Badge variant="outline" className="text-green-600 border-green-500">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Up to Date
        </Badge>
      );
    case 'out-of-date':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-500">
          <AlertCircle className="mr-1 h-3 w-3" />
          Out of Date
        </Badge>
      );
    case 'audit-ready':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-500">
          <Zap className="mr-1 h-3 w-3" />
          Audit Ready
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-500">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Completed
        </Badge>
      );
    case 'on-hold':
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-500">
          <Pause className="mr-1 h-3 w-3" />
          On Hold
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Helper function to get compliance color
function getComplianceColor(score: number) {
  if (score >= 90) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

// Helper function to get compliance progress color
function getComplianceProgressColor(score: number) {
  if (score >= 90) return 'bg-green-600';
  if (score >= 70) return 'bg-yellow-600';
  return 'bg-red-600';
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading, organizationId } = useAuth();
  const router = useRouter();
  

  // State for dashboard data
  const [codebaseHealth, setCodebaseHealth] = useState<CodebaseHealth[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [dashboardMetrics, setDashboardMetrics] =
    useState<DashboardMetrics | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<BackendProject[]>([]);
  const [users, setUsers] = useState<UserOverview[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [gitHubInstalled, setGitHubInstalled] = useState(false);
  const [confluenceInstalled, setConfluenceInstalled] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<string | null>(null);
  const [showOnboardingChat, setShowOnboardingChat] = useState(false);

  // Helper function to map codebase types
  const mapCodebaseType = (
    codebaseType: string,
  ): "frontend" | "backend" | "application" | "infrastructure" => {
    switch (codebaseType.toLowerCase()) {
      case "frontend":
        return "frontend";
      case "backend":
        return "backend";
      case "application":
        return "application";
      case "infrastructure":
        return "infrastructure"; // Keep infrastructure as separate type
      case "database":
        return "backend"; // Map database to backend
      default:
        return "backend"; // Default fallback
    }
  };

  // Function to handle when a new codebase is added
  const handleCodebaseAdded = useCallback((newCodebase: Codebase) => {
    // Create a new CodebaseHealth entry for the new codebase
    const newCodebaseHealth: CodebaseHealth = {
      id: newCodebase.object_id,
      name: newCodebase.codebase_name,
      version: "1.0.0",
      lastScanDate: new Date().toISOString(),
      status: "Good Standing",
      criticalIssues: 0,
      highIssues: 0,
      mediumIssues: 0,
      lowIssues: 0,
      trend: "new",
      healthScore: 100,
      type: mapCodebaseType(newCodebase.codebase_type || "backend"),
    };

    // Update codebase health state
    setCodebaseHealth((prev) => [...prev, newCodebaseHealth]);

    // Update dashboard metrics
    setDashboardMetrics((prev) =>
      prev
        ? {
            ...prev,
            totalCodebases: prev.totalCodebases + 1,
            averageComplianceScore:
              prev.totalCodebases === 0 ? 100 : prev.averageComplianceScore,
            compliancePercentage:
              prev.totalCodebases === 0 ? 100 : prev.compliancePercentage,
          }
        : null,
    );
  }, []);

  // Debug: log when dashboard render gating changes
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Dashboard] Render gating", {
        organizationId,
        showOnboardingChat,
        onboardStatus,
      });
    }
  }, [organizationId, showOnboardingChat, onboardStatus]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoadingData(true);
        setError(null);

        // Fetch all data in parallel
        const [dashboardData, projectsData, usersData, dataSourcesData, orgData] = await Promise.all([
          getDashboardData(),
          getProjects(),
          getOrganizationUsers(),
          getDataSources().catch(() => ({ data_sources: [] })),
          getOrganization().catch(() => ({ onboard_status: null })),
        ]);

        setCodebaseHealth(dashboardData.codebaseHealth);
        setRecentReports(dashboardData.recentReports);
        setDashboardMetrics(dashboardData.dashboardMetrics);
        setProjects(projectsData);
        setUsers(usersData);
        setDataSources(dataSourcesData.data_sources);

        // Default integration state when integrations are disabled or unavailable
        let gitHubData: unknown[] = [];
        let confluenceData: { connected: boolean } = { connected: false };

        // Only fetch integrations when the feature flag is enabled
        if (isFeatureEnabled("integrations")) {
          [gitHubData, confluenceData] = await Promise.all([
            getGitHubInstallations().catch(() => []),
            getConfluenceIntegration().catch(() => ({ connected: false })),
          ]);
        }

        setGitHubInstalled(gitHubData.length > 0);
        setConfluenceInstalled(confluenceData.connected);

        // Treat missing onboard_status as "onboarding" for first-time orgs
        const effectiveOnboardStatus = orgData.onboard_status ?? "onboarding";
        const hasProjects = Array.isArray(projectsData) && projectsData.length > 0;

        setOnboardStatus(effectiveOnboardStatus);
        // Auto-open onboarding chat when:
        // - the org is explicitly onboarding, OR
        // - there are no projects yet and the org is not marked as completed.
        const shouldShowOnboardingChat =
          effectiveOnboardStatus === "onboarding" ||
          (!hasProjects && effectiveOnboardStatus !== "completed");

        console.log("[Dashboard] Onboarding chat condition", {
          rawOnboardStatus: orgData.onboard_status,
          effectiveOnboardStatus,
          projectsCount: Array.isArray(projectsData) ? projectsData.length : "non-array",
          hasProjects,
          shouldShowOnboardingChat,
        });

        setShowOnboardingChat(shouldShowOnboardingChat);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data. Please try again.");
      } finally {
        setIsLoadingData(false);
      }
    };

    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return null; // Let the layout handle loading
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  // Show loading state while fetching dashboard data
  if (isLoadingData) {
    return (
      <div className="w-full h-full p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if data fetching failed
  if (error) {
    return (
      <div className="w-full h-full p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Failed to load dashboard</p>
            </div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate organizational metrics from real data
  const totalCodebases = codebaseHealth.length;

  // Calculate total issues across organization
  const totalCriticalIssues = codebaseHealth.reduce(
    (sum, cb) => sum + cb.criticalIssues,
    0,
  );
  const totalHighIssues = codebaseHealth.reduce(
    (sum, cb) => sum + cb.highIssues,
    0,
  );
  const totalMediumIssues = codebaseHealth.reduce(
    (sum, cb) => sum + cb.mediumIssues,
    0,
  );
  const totalLowIssues = codebaseHealth.reduce(
    (sum, cb) => sum + cb.lowIssues,
    0,
  );
  const totalIssues =
    totalCriticalIssues + totalHighIssues + totalMediumIssues + totalLowIssues;

  // Calculate compliance percentage (codebases without critical/high issues)
  const compliantCodebases = codebaseHealth.filter(
    (cb) => cb.criticalIssues === 0 && cb.highIssues === 0,
  ).length;
  const compliancePercentage =
    totalCodebases > 0
      ? Math.round((compliantCodebases / totalCodebases) * 100)
      : 0;

  console.log(
    "Codebase Types:",
    codebaseHealth.map((cb) => cb.type),
  );

  // Calculate codebase types breakdown
  const frontendCodebases = codebaseHealth.filter(
    (cb) => cb.type === "frontend",
  ).length;
  const backendCodebases = codebaseHealth.filter(
    (cb) => cb.type === "backend",
  ).length;
  const applicationCodebases = codebaseHealth.filter(
    (cb) => cb.type === "application",
  ).length;
  const infrastructureCodebases = codebaseHealth.filter(
    (cb) => cb.type === "infrastructure",
  ).length;

  // Removed mock integrations data - now using live data from API

  // Show empty state for new accounts with no projects (all plans)
  if (totalCodebases === 0 && projects.length === 0) {
    console.log("[Dashboard] Showing empty state for new account");
    return (
      <>
        <div className="w-full h-full space-y-8 p-4 md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          </div>

          {/* Welcome message for new accounts */}
          <div className="text-center py-12">
            <div className="mx-auto max-w-md">
              <Package className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">
                Start Your First Project
              </h3>
              <p className="text-muted-foreground mb-6">
                Create a compliance project to organize your codebases,
                documents, and track progress.
              </p>
              <Button size="lg" asChild>
                <Link href="/projects">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Project
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick start guide */}
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Start Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-start space-x-3 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        1
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Create a Project</h4>
                      <p className="text-sm text-muted-foreground">
                        Start a compliance project (e.g., HIPAA, GDPR)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        2
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Add Resources</h4>
                      <p className="text-sm text-muted-foreground">
                        Connect codebases, documents, and team members
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        3
                      </span>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Track Progress</h4>
                      <p className="text-sm text-muted-foreground">
                        Monitor compliance and complete tasks
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Onboarding Chat - Show when showOnboardingChat is true */}
        {showOnboardingChat && organizationId && (
          <OnboardingChatPanel
            organizationId={organizationId}
            isOnboarding={onboardStatus === "onboarding"}
            onClose={() => setShowOnboardingChat(false)}
          />
        )}

        {/* Re-open Onboarding Chat Button - Show whenever chat is closed */}
        {!showOnboardingChat && organizationId && (
          <div className="fixed bottom-4 right-4 z-40">
            <Button
              onClick={() => setShowOnboardingChat(true)}
              className="rounded-full shadow-lg gap-2"
              size="lg"
            >
              <MessageCircle className="h-5 w-5" />
              Onboarding Assistant
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="w-full h-full space-y-8 p-4 md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <FolderKanban className="h-6 w-6 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{projects.length}</div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Database className="h-6 w-6 text-green-600" />
              <div>
                <div className="text-2xl font-bold">
                  {dataSources.length}
                </div>
                <p className="text-sm text-muted-foreground">Knowledge Base</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Zap className="h-6 w-6 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">
                  {(gitHubInstalled ? 1 : 0) + (confluenceInstalled ? 1 : 0)}
                </div>
                <p className="text-sm text-muted-foreground">Connected Integrations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

	      {/* SCF quick access section was removed to avoid a large centered CTA on the dashboard. */}

	      {/* Projects Section */}
	      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold tracking-tight">Projects</h3>
          <Button asChild>
            <Link href="/projects">
              <Eye className="mr-2 h-4 w-4" />
              View All
            </Link>
          </Button>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Button asChild>
                <Link href="/projects">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.slice(0, 3).map((project) => {
                // NOTE: Use the real backend compliance_score for all statuses.
                // The previous 68% hard-coded value for active projects was
                // mock/demo data and has been removed so dashboard tiles show
                // accurate project compliance.
                const displayComplianceScore = project.compliance_score;

              return (
              <Link key={project.object_id} href={`/projects/${project.object_id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{project.name}</CardTitle>
                        {getStatusBadge(project.status)}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Compliance Score */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Compliance Score</span>
                        <span className={`text-2xl font-bold ${getComplianceColor(displayComplianceScore)}`}>
                          {displayComplianceScore}%
                        </span>
                      </div>
                      <Progress
                        value={displayComplianceScore}
                        className="h-2"
                        indicatorClassName={getComplianceProgressColor(displayComplianceScore)}
                      />
                    </div>

                    {/* Data sources placeholder */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                      <div className="flex items-center">
                        <Code className="mr-1 h-3 w-3" />
                        0
                      </div>
                      <div className="flex items-center">
                        <FileText className="mr-1 h-3 w-3" />
                        0
                      </div>
                      <div className="flex items-center">
                        <Users className="mr-1 h-3 w-3" />
                        0
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
            })}
          </div>
        )}
	      </div>

	      {/* Knowledge Base and Integrations */}
	      <div className="grid gap-6 md:grid-cols-2">
        {/* Knowledge Base */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Knowledge Base
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/knowledge-base">
                <Eye className="mr-2 h-4 w-4" />
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Code className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-medium">Repositories</div>
                    <div className="text-sm text-muted-foreground">
                      Connected codebases
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">{dataSources.filter(ds => ds.type === 'repo').length}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">Documentation</div>
                    <div className="text-sm text-muted-foreground">
                      Docs & policies
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">{dataSources.filter(ds => ds.type === 'documentation').length}</Badge>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg flex items-center">
              <Zap className="mr-2 h-5 w-5" />
              Integrations
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/integrations">
                <Eye className="mr-2 h-4 w-4" />
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">GitHub</div>
                    <div className="text-sm text-muted-foreground">
                      Repository scanning
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {gitHubInstalled ? (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      Available
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Confluence</div>
                    <div className="text-sm text-muted-foreground">
                      Documentation scanning
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {confluenceInstalled ? (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      Available
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
	      </div>

	      </div>

      {/* Onboarding Chat - Show when showOnboardingChat is true */}
      {showOnboardingChat && organizationId && (
        <OnboardingChatPanel
          organizationId={organizationId}
          isOnboarding={onboardStatus === "onboarding"}
          onClose={() => setShowOnboardingChat(false)}
        />
      )}

      {/* Re-open Onboarding Chat Button - Show whenever chat is closed */}
      {!showOnboardingChat && organizationId && (
        <div className="fixed bottom-4 right-4 z-40">
          <Button
            onClick={() => setShowOnboardingChat(true)}
            className="rounded-full shadow-lg gap-2"
            size="lg"
          >
            <MessageCircle className="h-5 w-5" />
            Onboarding Assistant
          </Button>
        </div>
      )}
    </>
  );
}
