"use client";

import type React from "react";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  XCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Code2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCodebasesWithIssues } from "@/app/dashboard/actions";

type IssueItem = {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  reportId: string;
  reportLink: string;
};

type CodebaseWithIssues = {
  id: string;
  name: string;
  version: string;
  status: string;
  issues: IssueItem[];
};

function IssueSeverityBadge({ severity }: { severity: IssueItem["severity"] }) {
  let icon = <Info className="h-3 w-3" />;
  let textColor = "text-gray-600 dark:text-gray-400";
  let bgColor = "bg-gray-100 dark:bg-gray-700/30";
  let borderColor = "border-gray-300 dark:border-gray-600";

  switch (severity) {
    case "Critical":
      icon = <XCircle className="h-3 w-3" />;
      textColor = "text-red-700 dark:text-red-400";
      bgColor = "bg-red-100 dark:bg-red-900/30";
      borderColor = "border-red-300 dark:border-red-700";
      break;
    case "High":
      icon = <AlertTriangle className="h-3 w-3" />;
      textColor = "text-orange-700 dark:text-orange-400";
      bgColor = "bg-orange-100 dark:bg-orange-900/30";
      borderColor = "border-orange-300 dark:border-orange-700";
      break;
    case "Medium":
      icon = <AlertCircle className="h-3 w-3" />;
      textColor = "text-yellow-700 dark:text-yellow-400";
      bgColor = "bg-yellow-100 dark:bg-yellow-900/30";
      borderColor = "border-yellow-300 dark:border-yellow-700";
      break;
    case "Low":
      icon = <Info className="h-3 w-3" />;
      textColor = "text-blue-700 dark:text-blue-400";
      bgColor = "bg-blue-100 dark:bg-blue-900/30";
      borderColor = "border-blue-300 dark:border-blue-700";
      break;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-2 py-0.5",
        textColor,
        bgColor,
        borderColor,
      )}
    >
      <span className="flex items-center gap-1">
        {icon}
        {severity}
      </span>
    </Badge>
  );
}

function CodebaseStatusBadge({ status }: { status: string }) {
  let textColor = "text-gray-600";
  let bgColor = "bg-gray-100";
  let borderColor = "border-gray-300";

  switch (status) {
    case "Healthy":
      textColor = "text-green-700 dark:text-green-400";
      bgColor = "bg-green-100 dark:bg-green-900/30";
      borderColor = "border-green-300 dark:border-green-700";
      break;
    case "Issues":
      textColor = "text-orange-700 dark:text-orange-400";
      bgColor = "bg-orange-100 dark:bg-orange-900/30";
      borderColor = "border-orange-300 dark:border-orange-700";
      break;
    case "Critical":
      textColor = "text-red-700 dark:text-red-400";
      bgColor = "bg-red-100 dark:bg-red-900/30";
      borderColor = "border-red-300 dark:border-red-700";
      break;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium px-2 py-0.5",
        textColor,
        bgColor,
        borderColor,
      )}
    >
      {status}
    </Badge>
  );
}

interface IssuesBreakdownModalProps {
  children: React.ReactNode;
}

export function IssuesBreakdownModal({ children }: IssuesBreakdownModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [codebasesWithIssues, setCodebasesWithIssues] = useState<
    CodebaseWithIssues[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch codebases with issues when modal opens
  useEffect(() => {
    const fetchCodebasesWithIssues = async () => {
      if (!isOpen) return;

      try {
        setIsLoading(true);
        setError(null);

        // Use server action to fetch issues (bypasses CORS)
        const data = await getCodebasesWithIssues();
        // Filter out codebases with no issues
        setCodebasesWithIssues(
          data.filter((codebase) => codebase.issues.length > 0),
        );
      } catch (err) {
        console.error("Failed to fetch codebases with issues:", err);
        setError("Failed to load issues data");
        setCodebasesWithIssues([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCodebasesWithIssues();
  }, [isOpen]);

  // Calculate totals
  const totalIssues = codebasesWithIssues.reduce(
    (sum, codebase) => sum + codebase.issues.length,
    0,
  );
  const criticalIssues = codebasesWithIssues.reduce(
    (sum, codebase) =>
      sum +
      codebase.issues.filter((issue) => issue.severity === "Critical").length,
    0,
  );
  const highIssues = codebasesWithIssues.reduce(
    (sum, codebase) =>
      sum + codebase.issues.filter((issue) => issue.severity === "High").length,
    0,
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Issues Breakdown
          </DialogTitle>
          <DialogDescription>
            Detailed view of all issues across your codebases. Total:{" "}
            {totalIssues} issues ({criticalIssues} critical, {highIssues} high
            priority)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-6">
            <div className="space-y-6 py-4">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading issues...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-muted-foreground">
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
                  <h3 className="text-lg font-medium mb-2 text-red-600">
                    Failed to Load Issues
                  </h3>
                  <p className="text-sm">{error}</p>
                </div>
              ) : codebasesWithIssues.length > 0 ? (
                codebasesWithIssues.map((codebase) => (
                  <div
                    key={codebase.id}
                    className="border rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Code2 className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-semibold text-lg">
                            {codebase.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                              Version: {codebase.version}
                            </span>
                            <CodebaseStatusBadge status={codebase.status} />
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div>
                          <div className="text-sm font-medium">
                            {codebase.issues.length} Issues
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {
                              codebase.issues.filter(
                                (i) => i.severity === "Critical",
                              ).length
                            }{" "}
                            Critical,{" "}
                            {
                              codebase.issues.filter(
                                (i) => i.severity === "High",
                              ).length
                            }{" "}
                            High
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            const reportLink = codebase.issues[0]?.reportLink;
                            if (reportLink) {
                              window.open(
                                reportLink,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }
                          }}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline"
                        >
                          <FileText className="h-3 w-3" />
                          View Report
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {codebase.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className="block p-3 rounded-md border border-muted"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm">
                                  {issue.title}
                                </h4>
                                <IssueSeverityBadge severity={issue.severity} />
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {issue.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Issues Found</h3>
                  <p className="text-sm">All your codebases are healthy!</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
