"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Code2,
  Rocket,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import type { Codebase, ComplianceReport } from "@/types/api";

// Extended codebase type that includes potential report data
export type CodebaseWithReport = Codebase & {
  latestReport?: ComplianceReport;
  latestVersion?: string;
};

interface CodebaseCardProps {
  codebase: CodebaseWithReport;
}

function ReportStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "Completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "Running":
      return <Clock className="h-4 w-4 animate-spin text-blue-500" />;
    case "Failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "Pending":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
  }
}

export function CodebaseCard({ codebase }: CodebaseCardProps) {
  // Use the correct field names from the API
  const displayName = codebase.codebase_name || "Unnamed Codebase";

  // Get the latest version from the versions array
  const latestVersion = codebase.versions?.[0];
  const displayVersion = latestVersion
    ? `${latestVersion.branch_name || "main"}@${latestVersion.commit_hash?.substring(0, 8) || "unknown"}`
    : "No versions";

  const codebaseId = codebase.object_id;

  return (
    <Link
      href={`/codebases/${codebaseId}?type=${codebase.source_type}`}
      className="flex flex-col h-full group"
    >
      <Card className="flex flex-col overflow-hidden transition-all group-hover:shadow-lg flex-grow">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg font-semibold">
              {displayName}
            </CardTitle>
            <Code2 className="h-5 w-5 flex-shrink-0 text-primary" />
          </div>
          <CardDescription>Latest Version: {displayVersion}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-3 pt-0">
          <h4 className="text-sm font-medium text-muted-foreground">
            Most Recent Report:
          </h4>
          {codebase.latestReport ? (
            <div className="space-y-1 rounded-md border border-orange-tint bg-orange-tint/30 p-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>
                  {new Date(
                    codebase.latestReport.created_at
                  ).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  <ReportStatusIcon status={codebase.latestReport.status} />
                  <span>{codebase.latestReport.status}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {codebase.latestReport.summary}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                No reports run for this version yet.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="mt-auto border-t bg-muted/20 p-4">
          <Button
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.preventDefault(); // Prevent navigation
              // Add logic to run new report here, e.g., open a modal or call an API
              console.log(`Run new report for ${displayName}`);
            }}
          >
            <Rocket className="mr-2 h-3.5 w-3.5" />
            Run New Report
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
