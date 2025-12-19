"use client";

import { useState, useEffect, use } from "react";
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
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Shield,
  ChevronDown,
  ChevronRight,
  Bug,
  Code,
  User,
  Calendar,
  HelpCircle,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComplianceReport } from "@/types/api";
import { DataFlowGraphComponent } from "./components/DataFlowGraph";
import {
  getStatusBadgeVariant,
  getStatusIcon,
  parseAnswers,
} from "@/utils/reports";
import { mockGraph } from "@/data/mock-data-flow-graph";
import { BackButton } from "@/components/back-button";

interface ReportDetailPageProps {
  params: Promise<{
    reportId: string;
  }>;
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const reportId = resolvedParams.reportId;

  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [expandedActionableItems, setExpandedActionableItems] = useState<
    Set<string>
  >(new Set());
  const [showActionableItems, setShowActionableItems] = useState(false);

  useEffect(() => {
    const loadReport = async () => {
      try {
        // Import the function dynamically
        const { getComplianceReportWithRulings } = await import(
          "../../actions"
        );
        const reportData = await getComplianceReportWithRulings(reportId);

        if (!reportData) {
          router.push("/compliance-reports");
          return;
        }

        setReport(reportData);
      } catch (error) {
        console.error("Error loading report:", error);
        router.push("/compliance-reports");
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportId, router]);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const toggleRule = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const toggleActionableItem = (itemId: string) => {
    const newExpanded = new Set(expandedActionableItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedActionableItems(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Report Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The report you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button asChild>
            <Link href="/compliance-reports">Back to Reports</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <BackButton className="self-start" />

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <h1 className="text-3xl font-bold tracking-tight">
                {report.name}
              </h1>
              <Badge variant={getStatusBadgeVariant(report.status)}>
                {report.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Report Metadata */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Report Information</CardTitle>
            <CardDescription>
              Basic details about this compliance report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Report ID
              </label>
              <p className="text-sm font-mono">{report.object_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Description
              </label>
              <p
                className={`text-sm ${!report.description ? "italic text-muted-foreground" : ""}`}
              >
                {report.description || "No description provided"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Template ID
              </label>
              <p className="text-sm font-mono">
                {report.template_id || "No template"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Sections</span>
              <span className="text-sm font-medium">
                {report.sections?.length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Total Rulings
              </span>
              <span className="text-sm font-medium">
                {report.total_rulings_count || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Compliance Rate
              </span>
              <span className="text-sm font-medium">
                {report.compliance_percentage !== undefined
                  ? `${Math.round(report.compliance_percentage)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Action Items
              </span>
              <span className="text-sm font-medium">
                {report.actionable_items?.length || 0}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Data flow</CardTitle>
          <CardDescription>
            Visual representation of the flow of data through the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataFlowGraphComponent graph={mockGraph} />
        </CardContent>
      </Card>
      {/* Report Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Compliance Score
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.compliance_percentage !== undefined
                ? `${Math.round(report.compliance_percentage)}%`
                : "N/A"}
            </div>
            {report.compliance_percentage !== undefined && (
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    report.compliance_percentage >= 80
                      ? "bg-green-500"
                      : report.compliance_percentage >= 60
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${report.compliance_percentage}%` }}
                ></div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Overall compliance rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {getStatusIcon(report.status)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.status}</div>
            <p className="text-xs text-muted-foreground">
              Current report status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rulings</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.total_rulings_count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Rules evaluated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Actionable Items
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.actionable_items?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Items requiring action
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Breakdown */}
      {(report.compliant_count !== undefined ||
        report.non_compliant_count !== undefined ||
        report.indeterminate_count !== undefined) && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliant</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {report.compliant_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Rules passing compliance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Non-Compliant
              </CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {report.non_compliant_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Rules failing compliance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Indeterminate
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {report.indeterminate_count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Rules with warnings
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Executive Summary */}
      {report.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Executive Summary</CardTitle>
            <CardDescription>
              High-level overview of compliance findings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{report.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Actionable Items */}
      {report.actionable_items && report.actionable_items.length > 0 && (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowActionableItems(!showActionableItems)}
              className="flex items-center justify-between w-full text-left hover:text-primary transition-colors"
            >
              <div>
                <CardTitle className="flex items-center gap-2">
                  {showActionableItems ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Actionable Items
                </CardTitle>
                <CardDescription>
                  Issues requiring immediate attention (
                  {report.actionable_items.length} items)
                </CardDescription>
              </div>
            </button>
          </CardHeader>
          {showActionableItems && (
            <CardContent>
              <div className="space-y-4">
                {report.actionable_items.map((item) => (
                  <Card
                    key={item.object_id}
                    className="border-l-4 border-l-red-500"
                  >
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Bug className="h-5 w-5 text-red-500 mt-0.5" />
                            <div className="space-y-1">
                              <button
                                onClick={() =>
                                  toggleActionableItem(item.object_id)
                                }
                                className="flex items-center gap-2 text-left hover:text-primary transition-colors"
                              >
                                {expandedActionableItems.has(item.object_id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <h4 className="font-semibold">{item.title}</h4>
                              </button>
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge
                              variant={
                                item.severity === "critical" ||
                                item.severity === "high"
                                  ? "destructive"
                                  : item.severity === "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {item.severity}
                            </Badge>
                            <Badge variant="outline">{item.priority}</Badge>
                            <Badge
                              variant={
                                item.status === "resolved"
                                  ? "default"
                                  : item.status === "in_progress"
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {item.status}
                            </Badge>
                          </div>
                        </div>

                        {expandedActionableItems.has(item.object_id) && (
                          <div className="space-y-3 pl-8">
                            {item.file_path && (
                              <div className="bg-muted rounded p-2">
                                <div className="flex items-center gap-2">
                                  <Code className="h-3 w-3 text-muted-foreground" />
                                  <p className="text-xs font-mono">
                                    {item.file_path}
                                    {item.line_number && `:${item.line_number}`}
                                  </p>
                                </div>
                              </div>
                            )}

                            {item.proposed_fix && (
                              <div>
                                <h5 className="font-medium text-sm mb-1">
                                  Proposed Fix
                                </h5>
                                <p className="text-sm text-muted-foreground">
                                  {item.proposed_fix}
                                </p>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex gap-4">
                                <span>Type: {item.problem_type}</span>
                                {item.assigned_to && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{item.assigned_to}</span>
                                  </div>
                                )}
                              </div>
                              {item.due_date && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {new Date(
                                      item.due_date
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Rulings */}
      <div className="space-y-6">
        {!report.sections || report.sections.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No rulings found in this report.</p>
            </CardContent>
          </Card>
        ) : (
          // Flatten all rulings from all sections
          report.sections
            .flatMap((section) => section.rulings || [])
            .map((ruling) => {
              // Get compliance status with proper formatting
              const getComplianceStatus = (decision: string) => {
                const lowerDecision = decision?.toLowerCase() || "";

                // Handle the actual decision values returned by the LLM
                if (
                  lowerDecision.includes("good evidence of compliance") ||
                  lowerDecision === "compliant"
                ) {
                  return {
                    text: "Compliant",
                    variant: "default" as const,
                    icon: "✅",
                  };
                } else if (
                  lowerDecision.includes("good evidence of non-compliance") ||
                  lowerDecision === "non-compliant" ||
                  lowerDecision === "non_compliant"
                ) {
                  return {
                    text: "Non-Compliant",
                    variant: "destructive" as const,
                    icon: "❌",
                  };
                } else if (
                  lowerDecision.includes("insufficient evidence") ||
                  lowerDecision === "warning"
                ) {
                  return {
                    text: "Insufficient Evidence",
                    variant: "secondary" as const,
                    icon: "⚠️",
                  };
                } else {
                  return {
                    text: "Pending",
                    variant: "outline" as const,
                    icon: "⏳",
                  };
                }
              };

              const status = getComplianceStatus(ruling.decision);
              const ruleName = ruling.rule?.name || `Rule ${ruling.rule_id}`;

              return (
                <Card
                  key={ruling.object_id}
                  className="border-l-4 border-l-blue-500"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{status.icon}</span>
                        <div>
                          <CardTitle className="text-lg">
                            {ruleName} - {status.text}
                          </CardTitle>
                          {ruling.rule?.description && (
                            <CardDescription className="mt-1">
                              {ruling.rule.description}
                            </CardDescription>
                          )}
                          {/* Display ruling status */}
                          <div className="mt-2">
                            <span className="text-sm text-muted-foreground">
                              Status:{" "}
                              <span className="font-medium capitalize">
                                {ruling.status || "pending"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={status.variant}>{status.text}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Reasoning Section */}
                    <div>
                      <h5 className="font-medium mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Reasoning
                      </h5>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {ruling.reasoning || "No reasoning provided."}
                      </p>
                    </div>

                    {/* Found Properties Section */}
                    {ruling.questions && ruling.questions.length > 0 && (
                      <div>
                        <h5 className="font-medium mb-3 flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          Found Properties
                        </h5>
                        <div className="space-y-3">
                          {ruling.questions.map((question, qIndex) => (
                            <div
                              key={qIndex}
                              className="bg-muted/50 rounded-lg p-4"
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <HelpCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    {question.question}
                                  </p>
                                  {question.answer && (
                                    <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                                      {(() => {
                                        try {
                                          const items = parseAnswers(
                                            question.answer
                                          );
                                          return items.map((ans, i) => (
                                            <div key={i} className="mb-4">
                                              <p>
                                                <strong>{ans.type}:</strong>{" "}
                                                {ans.key}
                                              </p>
                                              <p className="mt-1">
                                                {ans.value}
                                              </p>
                                              {ans.path ? (
                                                <p className="mt-1">
                                                  <strong>path:</strong>{" "}
                                                  {ans.path}
                                                </p>
                                              ) : null}
                                            </div>
                                          ));
                                        } catch {
                                          return <p>{question.answer}</p>;
                                        }
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
}
