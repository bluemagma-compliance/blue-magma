"use client";

import type React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, AlertTriangle, FileX, Activity } from "lucide-react";
import { CodebaseWithReport } from "./codebase-card";

interface CodebaseOverviewStatsProps {
  codebases: CodebaseWithReport[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}

function StatCard({ title, value, icon: Icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function CodebaseOverviewStats({
  codebases,
}: CodebaseOverviewStatsProps) {
  const totalCodebases = codebases.length;

  // Since the API doesn't provide report data yet, we'll show placeholder stats
  // TODO: Update these when report endpoints are available
  const codebasesWithFailedReports = codebases.filter(
    (cb) => cb.latestReport && cb.latestReport.status === "Failed"
  ).length;

  // For now, all codebases have no reports since the API doesn't provide this data yet
  const codebasesWithNoReports = codebases.length; // All codebases have no reports yet

  const codebasesWithActiveReports = codebases.filter(
    (cb) => cb.latestReport && cb.latestReport.status === "Running"
  ).length;

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Codebases"
        value={totalCodebases}
        icon={Code2}
        description="All registered codebases"
      />
      <StatCard
        title="Failed Latest Reports"
        value={codebasesWithFailedReports}
        icon={AlertTriangle}
        description="Codebases with issues in their most recent report"
      />
      <StatCard
        title="No Reports Yet"
        value={codebasesWithNoReports}
        icon={FileX}
        description="Codebases awaiting their first report"
      />
      <StatCard
        title="Active Scans"
        value={codebasesWithActiveReports}
        icon={Activity}
        description="Codebases currently being scanned"
      />
    </div>
  );
}
