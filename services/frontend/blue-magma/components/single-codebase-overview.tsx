"use client";

import type React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  FileText,
  CheckCircle,
  XCircle,
  CalendarDays,
  AlertCircle,
  Clock,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Codebase } from "@/types/api";
import { CodebaseVersionWithReports } from "@/app/codebases/[codebaseid]/components/versions-list";
import { getVersionNumber } from "@/app/codebases/[codebaseid]/utils";

function StatDisplay({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number | React.ReactNode;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground p-4 shadow",
        className
      )}
    >
      <div className="flex flex-row items-center justify-between space-y-0 pb-1">
        <h3 className="text-sm font-medium tracking-tight text-muted-foreground">
          {title}
        </h3>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function getOverallStatus(versions: CodebaseVersionWithReports[]): {
  status: string;
  date: string | null;
} {
  if (!versions || versions.length === 0) {
    return { status: "No Reports", date: null };
  }
  const latestVersion = versions[0];
  if (!latestVersion.reports || latestVersion.reports.length === 0) {
    return { status: "No Reports for Latest Version", date: null };
  }
  // Assuming reports are sorted with the latest first
  const latestReport = latestVersion.reports[0];
  return { status: latestReport.status, date: latestReport.created_at };
}

function ReportStatusBadgeMini({ status }: { status: string }) {
  let icon = <AlertCircle className="h-3 w-3" />;
  let textColor = "text-gray-600";

  switch (status) {
    case "Completed":
      icon = <CheckCircle className="h-3 w-3" />;
      textColor = "text-green-600";
      break;
    case "Failed":
      icon = <XCircle className="h-3 w-3" />;
      textColor = "text-red-600";
      break;
    case "Running":
      icon = <Clock className="h-3 w-3 animate-spin" />;
      textColor = "text-blue-600";
      break;
    case "Pending":
      icon = <AlertCircle className="h-3 w-3" />;
      textColor = "text-yellow-600";
      break;
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-1.5 py-0.5 border-transparent",
        textColor
      )}
    >
      <span className="flex items-center gap-1">
        {icon}
        {status}
      </span>
    </Badge>
  );
}

export function SingleCodebaseOverview({
  versions,
  codebase,
}: {
  versions: CodebaseVersionWithReports[];
  codebase?: Codebase;
}) {
  const latestVersion = versions[0];
  const latestVersionNumber = latestVersion
    ? getVersionNumber(latestVersion)
    : "-";
  const totalReports = versions.reduce((sum, v) => sum + v.reports.length, 0);

  const { status: overallStatus, date: lastScanDate } =
    getOverallStatus(versions);

  // Get the latest version with a summary
  const latestVersionWithSummary = codebase?.versions?.find(
    (v) => v.summary && v.summary.trim() !== ""
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatDisplay
          title="Latest Version"
          value={latestVersionNumber}
          icon={GitBranch}
        />
        <StatDisplay
          title="Total Reports"
          value={totalReports}
          icon={FileText}
        />
        <StatDisplay
          title="Last Scan"
          value={
            <div className="flex flex-col">
              <span className="text-2xl font-bold">
                {lastScanDate
                  ? new Date(lastScanDate).toLocaleDateString()
                  : "-"}
              </span>
              {overallStatus && (
                <ReportStatusBadgeMini status={overallStatus} />
              )}
            </div>
          }
          icon={CalendarDays}
        />
      </div>

      {/* AI Summary Section */}
      {latestVersionWithSummary && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">AI Summary</CardTitle>
              <Badge variant="secondary" className="text-xs">
                AI Generated
              </Badge>
            </div>
            <CardDescription>
              Automated analysis of the {latestVersionWithSummary.branch_name}{" "}
              branch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {latestVersionWithSummary.summary}
            </p>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Branch:{" "}
                <code className="bg-muted px-1 py-0.5 rounded">
                  {latestVersionWithSummary.branch_name}
                </code>
              </span>
              <span>
                Commit:{" "}
                <code className="bg-muted px-1 py-0.5 rounded">
                  {latestVersionWithSummary.commit_hash.substring(0, 8)}
                </code>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
