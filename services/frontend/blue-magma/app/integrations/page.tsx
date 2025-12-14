"use client";

import { useEffect, useState } from "react";
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
import {
  GitBranch,
  Settings,
  Zap,
  ExternalLink,
  BookOpen,
  Cloud,
  MessageSquare,
  FileText,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { getGitHubInstallations } from "./github/actions";
import { getConfluenceIntegration } from "./confluence/actions";
import { getAWSInstallation } from "./aws/actions";
import { useIsFreePlan } from "@/hooks/useFreePlan";
import { UpgradeRequiredScreen } from "@/components/upgrade-required-screen";

export default function IntegrationsPage() {
  const [gitHubInstalled, setGitHubInstalled] = useState(false);
  const [confluenceInstalled, setConfluenceInstalled] = useState(false);
  const [awsInstalled, setAwsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { isFreePlan, loading: planLoading } = useIsFreePlan();

  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const [gitHubInstalls, confluenceStatus, awsInstallation] =
          await Promise.all([
            getGitHubInstallations(),
            getConfluenceIntegration(),
            getAWSInstallation().catch(() => null),
          ]);

        setGitHubInstalled(gitHubInstalls.length > 0);
        setConfluenceInstalled(confluenceStatus.connected);
        setAwsInstalled(!!awsInstallation);
      } catch (error) {
        console.error("Error checking integrations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkIntegrations();
  }, []);

  if (planLoading) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AuthenticatedLayout>
    );
  }

  if (isFreePlan) {
    return (
      <AuthenticatedLayout>
        <UpgradeRequiredScreen
          featureName="Integrations"
          description="Integrate GitHub, Confluence, AWS, and more to automate evidence collection and monitoring."
        />
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Zap className="mr-3 h-8 w-8 text-primary" />
            Integrations
          </h1>
          <p className="text-muted-foreground">
            Connect your development tools and services to streamline your
            compliance workflow.
          </p>
        </div>

        {/* Available Integrations */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* GitHub Integration */}
          <Card className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <div className="p-1.5 bg-gray-900 rounded">
                    <GitBranch className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">GitHub</CardTitle>
                    <CardDescription className="text-xs">
                      Repository scanning
                    </CardDescription>
                  </div>
                </div>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                ) : gitHubInstalled ? (
                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs py-0 px-1.5">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                    Installed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs py-0 px-1.5">
                    Available
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Automatic scanning</p>
                  <p>• Webhook updates</p>
                  <p>• Multi-repo support</p>
                </div>
                <div className="flex gap-1">
                  <Button asChild size="sm" className="flex-1 h-8 text-xs">
                    <Link href="/integrations/github">
                      <Settings className="mr-1 h-3 w-3" />
                      Configure
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" asChild>
                    <Link
                      href="https://docs.github.com/en/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confluence Integration */}
          <Card className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <div className="p-1.5 bg-blue-600 rounded">
                    <BookOpen className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Confluence</CardTitle>
                    <CardDescription className="text-xs">
                      Documentation scanning
                    </CardDescription>
                  </div>
                </div>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                ) : confluenceInstalled ? (
                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs py-0 px-1.5">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                    Installed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs py-0 px-1.5">
                    Available
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Documentation scanning</p>
                  <p>• Webhook updates</p>
                  <p>• Workspace coverage</p>
                </div>
                <div className="flex gap-1">
                  <Button asChild size="sm" className="flex-1 h-8 text-xs">
                    <Link href="/integrations/confluence">
                      <Settings className="mr-1 h-3 w-3" />
                      Configure
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" asChild>
                    <Link
                      href="https://developer.atlassian.com/cloud/confluence/apis/rest/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AWS Integration */}
          <Card className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <div className="p-1.5 bg-orange-400 rounded">
                    <Cloud className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">AWS</CardTitle>
                    <CardDescription className="text-xs">
                      Infrastructure scanning
                    </CardDescription>
                  </div>
                </div>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                ) : awsInstalled ? (
                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs py-0 px-1.5">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                    Installed
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 text-xs py-0 px-1.5"
                  >
                    Available
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Resource scanning</p>
                  <p>• Security compliance</p>
                  <p>• IAM analysis</p>
                </div>
                <div className="flex gap-1">
                  <Button asChild size="sm" className="flex-1 h-8 text-xs">
                    <Link href="/integrations/aws">
                      <Settings className="mr-1 h-3 w-3" />
                      Configure
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Slack Integration */}
          <Card className="relative opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <div className="p-1.5 bg-purple-600 rounded">
                    <MessageSquare className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Slack</CardTitle>
                    <CardDescription className="text-xs">
                      Compliance alerts
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs py-0 px-1.5">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Real-time alerts</p>
                  <p>• Daily reports</p>
                  <p>• Notifications</p>
                </div>
                <Button disabled size="sm" className="w-full h-8 text-xs">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notion Integration */}
          <Card className="relative opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <div className="p-1.5 bg-gray-800 rounded">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Notion</CardTitle>
                    <CardDescription className="text-xs">
                      Report syncing
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs py-0 px-1.5">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Report syncing</p>
                  <p>• Database integration</p>
                  <p>• Knowledge base</p>
                </div>
                <Button disabled size="sm" className="w-full h-8 text-xs">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Future Integrations - GitLab */}
          <Card className="relative opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <div className="p-1.5 bg-orange-500 rounded">
                    <GitBranch className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">GitLab</CardTitle>
                    <CardDescription className="text-xs">
                      Repository integration
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs py-0 px-1.5">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Repository integration</p>
                  <p>• CI/CD compliance</p>
                  <p>• MR scanning</p>
                </div>
                <Button disabled size="sm" className="w-full h-8 text-xs">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Future Integrations - Bitbucket */}
          <Card className="relative opacity-60">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <div className="p-1.5 bg-blue-600 rounded">
                    <GitBranch className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Bitbucket</CardTitle>
                    <CardDescription className="text-xs">
                      Atlassian integration
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs py-0 px-1.5">Coming Soon</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Repository scanning</p>
                  <p>• PR integration</p>
                  <p>• Atlassian support</p>
                </div>
                <Button disabled size="sm" className="w-full h-8 text-xs">
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>Why Use Integrations?</CardTitle>
            <CardDescription>
              Streamline your compliance workflow with automated integrations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Automated Scanning</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically scan your repositories for compliance issues
                  without manual intervention.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Real-time Updates</h4>
                <p className="text-sm text-muted-foreground">
                  Get instant notifications when new code is pushed or
                  compliance status changes.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">
                  Centralized Management
                </h4>
                <p className="text-sm text-muted-foreground">
                  Manage all your repositories and compliance reports from a
                  single dashboard.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Team Collaboration</h4>
                <p className="text-sm text-muted-foreground">
                  Share compliance reports and collaborate with your team on
                  remediation efforts.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Historical Tracking</h4>
                <p className="text-sm text-muted-foreground">
                  Track compliance improvements over time and maintain audit
                  trails.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Custom Workflows</h4>
                <p className="text-sm text-muted-foreground">
                  Configure custom compliance workflows that fit your
                  development process.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
