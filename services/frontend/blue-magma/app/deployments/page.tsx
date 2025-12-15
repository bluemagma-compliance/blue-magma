"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { FeatureGate, ComingSoonBadge } from "@/components/feature-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  ArrowLeft,
  Settings,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";

// Mock deployment data (for when feature is enabled)
const mockDeployments = [
  {
    id: "dep_001",
    name: "Production Release - Q2",
    environment: "production",
    status: "active",
    version: "v2.1.0",
    lastDeployed: "2024-06-11T10:30:00Z",
    health: "healthy",
    codebases: ["Frontend Web App", "Backend API Service"],
  },
  {
    id: "dep_002",
    name: "Staging Environment",
    environment: "staging",
    status: "deploying",
    version: "v2.2.0-beta",
    lastDeployed: "2024-06-12T14:15:00Z",
    health: "deploying",
    codebases: ["Frontend Web App", "Backend API Service", "Mobile SDK"],
  },
  {
    id: "dep_003",
    name: "Development Environment",
    environment: "development",
    status: "stopped",
    version: "v2.2.0-alpha",
    lastDeployed: "2024-06-10T09:00:00Z",
    health: "stopped",
    codebases: ["Frontend Web App"],
  },
];

function DeploymentCard({
  deployment,
}: {
  deployment: (typeof mockDeployments)[0];
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-100";
      case "deploying":
        return "text-blue-600 bg-blue-100";
      case "stopped":
        return "text-gray-600 bg-gray-100";
      case "failed":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4" />;
      case "deploying":
        return <RotateCcw className="h-4 w-4 animate-spin" />;
      case "stopped":
        return <Pause className="h-4 w-4" />;
      default:
        return <Pause className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{deployment.name}</CardTitle>
          <div
            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
              deployment.status,
            )}`}
          >
            {getStatusIcon(deployment.status)}
            <span className="capitalize">{deployment.status}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Environment:</span>
            <p className="font-medium capitalize">{deployment.environment}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Version:</span>
            <p className="font-medium">{deployment.version}</p>
          </div>
        </div>

        <div className="text-sm">
          <span className="text-muted-foreground">Codebases:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {deployment.codebases.map((codebase) => (
              <span
                key={codebase}
                className="px-2 py-1 bg-gray-100 rounded text-xs"
              >
                {codebase}
              </span>
            ))}
          </div>
        </div>

        <div className="flex space-x-2 pt-2">
          <Button size="sm" variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
          <Button size="sm" variant="outline">
            View Logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DeploymentsContent() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Deployments</h2>
          <p className="text-muted-foreground">
            Manage and monitor your application deployments across environments
          </p>
        </div>
        <Button>
          <Rocket className="mr-2 h-4 w-4" />
          New Deployment
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockDeployments.map((deployment) => (
          <DeploymentCard key={deployment.id} deployment={deployment} />
        ))}
      </div>
    </div>
  );
}

function DeploymentsDisabled() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-3xl font-bold tracking-tight">Deployments</h2>
            <ComingSoonBadge feature="deployments" />
          </div>
          <p className="text-muted-foreground">
            Deployment management is coming soon
          </p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Rocket className="h-16 w-16 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            Deployments Coming Soon
          </h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            We&apos;re working on deployment management features that will allow
            you to deploy, monitor, and manage your applications across
            different environments.
          </p>

          <div className="grid gap-4 md:grid-cols-3 w-full max-w-2xl">
            <div className="text-center p-4 border rounded-lg">
              <Play className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h4 className="font-medium">Deploy</h4>
              <p className="text-sm text-muted-foreground">
                One-click deployments
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Settings className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h4 className="font-medium">Monitor</h4>
              <p className="text-sm text-muted-foreground">
                Real-time monitoring
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <RotateCcw className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h4 className="font-medium">Rollback</h4>
              <p className="text-sm text-muted-foreground">Safe rollbacks</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeploymentsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="w-full h-full p-4 md:p-8">
      <FeatureGate feature="deployments" fallback={<DeploymentsDisabled />}>
        <DeploymentsContent />
      </FeatureGate>
    </div>
  );
}
