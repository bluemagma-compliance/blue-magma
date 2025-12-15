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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Eye,
  ChevronDown,
  ChevronRight,
  Edit,
  Plus,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { getComplianceReports } from "../../actions";
import type { ComplianceReport, UiReportTemplate } from "@/types/api";

interface PageProps {
  params: Promise<{
    templateId: string;
  }>;
}

function getStatusIcon(status: ComplianceReport["status"]) {
  switch (status) {
    case "Completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "Failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "Running":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "Pending":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusBadgeVariant(status: ComplianceReport["status"]) {
  switch (status) {
    case "Completed":
      return "default";
    case "Failed":
      return "destructive";
    case "Running":
      return "secondary";
    case "Pending":
      return "outline";
    default:
      return "outline";
  }
}

function getTrendIcon(
  current: number | undefined,
  previous: number | undefined
) {
  if ((current || 0) > (previous || 0)) {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  } else if ((current || 0) < (previous || 0)) {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  } else {
    return <Minus className="h-4 w-4 text-gray-500" />;
  }
}

// Mock template data - in real app, this would come from API
const getTemplateByFramework = (framework: string): UiReportTemplate | null => {
  const templates: UiReportTemplate[] = [
    {
      id: "hipaa-template",
      name: "HIPAA Compliance Template",
      framework: "HIPAA",
      description:
        "Comprehensive template for Healthcare Insurance Portability and Accountability Act compliance reporting.",
      category: "healthcare",
      isPremade: true,
      active: true,
      codebases: [],
      object_id: "hipaa-template",
      organization_id: "org_123",
      sections: [
        {
          object_id: "admin-safeguards",
          template_id: "hipaa-template",
          name: "Administrative Safeguards",
          description:
            "Policies and procedures for managing PHI access and security",
          order: 1,
          rules: [
            {
              object_id: "hipaa-rule-1",
              name: "Security Officer Assignment",
              rule: "Assign security responsibility to a specific individual",
              policy_name: "HIPAA Security Rule §164.308(a)(2)",
              policy_version: "1.0",
              evidence_schema: {
                required_documents: [
                  "security_officer_assignment",
                  "job_description",
                ],
              },
              scope: "Organization-wide",
              tags: "administrative,security,assignment",
              public: true,
              source: "HIPAA",
              description:
                "Covered entities must assign security responsibility to a specific individual who has been granted access authority",
              organization_id: 0,
              severity: "high",
              section: "Administrative Safeguards",
            },
            {
              object_id: "hipaa-rule-2",
              name: "Workforce Training",
              rule: "Implement procedures for workforce security training",
              policy_name: "HIPAA Security Rule §164.308(a)(5)",
              policy_version: "1.0",
              evidence_schema: {
                required_documents: [
                  "training_records",
                  "training_materials",
                  "completion_certificates",
                ],
              },
              scope: "All workforce members",
              tags: "training,workforce,security",
              public: true,
              source: "HIPAA",
              description:
                "Implement procedures to ensure that all members of its workforce have appropriate access to PHI",
              organization_id: 0,
              severity: "medium",
              section: "Administrative Safeguards",
            },
          ],
        },
        {
          object_id: "physical-safeguards",
          template_id: "hipaa-template",
          name: "Physical Safeguards",
          description:
            "Physical protection of electronic information systems and equipment",
          order: 2,
          rules: [
            {
              object_id: "hipaa-rule-3",
              name: "Facility Access Controls",
              rule: "Implement procedures to limit physical access to facilities",
              policy_name: "HIPAA Security Rule §164.310(a)(1)",
              policy_version: "1.0",
              evidence_schema: {
                required_documents: [
                  "access_logs",
                  "facility_security_plan",
                  "visitor_logs",
                ],
              },
              scope: "Physical facilities",
              tags: "physical,access,facility",
              public: true,
              source: "HIPAA",
              description:
                "Limit physical access to its electronic information systems and the facility or facilities in which they are housed",
              organization_id: 0,
              severity: "high",
              section: "Physical Safeguards",
            },
          ],
        },
        {
          object_id: "technical-safeguards",
          template_id: "hipaa-template",
          name: "Technical Safeguards",
          description:
            "Technology controls that protect and control access to PHI",
          order: 3,
          rules: [
            {
              object_id: "hipaa-rule-4",
              name: "Access Control",
              rule: "Implement technical policies and procedures for electronic information systems",
              policy_name: "HIPAA Security Rule §164.312(a)(1)",
              policy_version: "1.0",
              evidence_schema: {
                required_documents: [
                  "access_control_policies",
                  "user_access_reviews",
                  "system_logs",
                ],
              },
              scope: "Electronic information systems",
              tags: "technical,access,electronic",
              public: true,
              source: "HIPAA",
              description:
                "Allow access only to those persons or software programs that have been granted access rights",
              organization_id: 0,
              severity: "high",
              section: "Technical Safeguards",
            },
          ],
        },
      ],
    },
  ];

  return templates.find((t) => t.framework === framework) || null;
};

function sum(...args: (number | undefined)[]) {
  return args.reduce<number>((total, num) => total + (num || 0), 0);
}

export default function TemplateReportsPage({ params }: PageProps) {
  const [allReports, setAllReports] = useState<ComplianceReport[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateStructureExpanded, setTemplateStructureExpanded] =
    useState(true);

  // Unwrap the params Promise
  const resolvedParams = use(params);

  // Decode the templateId (format: framework-codebase)
  const decodedTemplateId = decodeURIComponent(resolvedParams.templateId);
  const [framework, ...codebaseParts] = decodedTemplateId.split("-");
  const codebaseName = codebaseParts.join("-");

  // Get template structure
  const template = getTemplateByFramework(framework);

  // Filter reports for this specific template
  const templateReports = allReports.filter(
    (report) =>
      report.framework === framework && report.codebaseName === codebaseName
  );

  useEffect(() => {
    const fetchReports = async () => {
      const reports = await getComplianceReports();
      setAllReports(reports);
    };
    fetchReports();
  }, []);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Sort reports by date (most recent first)
  const sortedReports = templateReports.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const mostRecentReport = sortedReports[0];
  const previousReport = sortedReports[1];
  const templateName =
    mostRecentReport?.name.replace(/ Report$/, "") || `${framework} Template`;

  if (templateReports.length === 0) {
    return (
      <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/compliance-reports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
            <p className="text-muted-foreground text-center">
              No reports have been generated for this template yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/compliance-reports">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Reports
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">{templateName}</h2>
          <p className="text-muted-foreground">
            {framework} compliance reports for {codebaseName}
          </p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Generate New Report
        </Button>
      </div>

      {/* Most Recent Report Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Latest Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(mostRecentReport.status)}
              <span className="text-2xl font-bold">
                {mostRecentReport.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(mostRecentReport.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {mostRecentReport.complianceScore}%
              </span>
              {previousReport &&
                getTrendIcon(
                  mostRecentReport.complianceScore,
                  previousReport.complianceScore
                )}
            </div>
            {previousReport && (
              <p className="text-xs text-muted-foreground mt-1">
                {(mostRecentReport.complianceScore || 0) >
                (previousReport.complianceScore || 0)
                  ? "+"
                  : ""}
                {(mostRecentReport.complianceScore || 0) -
                  (previousReport.complianceScore || 0)}
                % from previous
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {sum(
                  mostRecentReport.criticalIssues,
                  mostRecentReport.highIssues,
                  mostRecentReport.mediumIssues,
                  mostRecentReport.lowIssues
                )}
              </span>
              {previousReport &&
                getTrendIcon(
                  sum(
                    previousReport.criticalIssues,
                    previousReport.highIssues,
                    previousReport.mediumIssues,
                    previousReport.lowIssues
                  ),
                  sum(
                    mostRecentReport.criticalIssues,
                    mostRecentReport.highIssues,
                    mostRecentReport.mediumIssues,
                    mostRecentReport.lowIssues
                  )
                )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {mostRecentReport.criticalIssues} critical,{" "}
              {mostRecentReport.highIssues} high
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{sortedReports.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Generated reports
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Most Recent Report Details */}
      <Card>
        <CardHeader>
          <CardTitle>Latest Report Details</CardTitle>
          <CardDescription>
            Generated on{" "}
            {new Date(mostRecentReport.created_at).toLocaleDateString()} at{" "}
            {new Date(mostRecentReport.created_at).toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(mostRecentReport.status)}
              <span className="font-medium">{mostRecentReport.status}</span>
              <Badge variant={getStatusBadgeVariant(mostRecentReport.status)}>
                {mostRecentReport.framework}
              </Badge>
            </div>
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              View Full Report
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {mostRecentReport.summary}
          </p>

          {mostRecentReport.status === "Completed" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {mostRecentReport.criticalIssues}
                </div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">
                  {mostRecentReport.highIssues}
                </div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {mostRecentReport.mediumIssues}
                </div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {mostRecentReport.lowIssues}
                </div>
                <div className="text-xs text-muted-foreground">Low</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Structure */}
      {template && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() =>
                  setTemplateStructureExpanded(!templateStructureExpanded)
                }
              >
                {templateStructureExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <div>
                  <CardTitle>Template Structure</CardTitle>
                  <CardDescription>
                    Sections and rules that make up this compliance template (
                    {template.sections.length} sections,{" "}
                    {template.sections.reduce(
                      (total, section) => total + section.rules.length,
                      0
                    )}{" "}
                    rules)
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      View All Reports
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>All Reports for {templateName}</DialogTitle>
                      <DialogDescription>
                        Complete history of reports generated from this template
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Generated</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Issues</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedReports.map((report) => (
                            <TableRow
                              key={report.id}
                              className="cursor-pointer hover:bg-muted/50"
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="font-medium">
                                      {new Date(
                                        report.created_at
                                      ).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(
                                        report.created_at
                                      ).toLocaleTimeString()}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(report.status)}
                                  <Badge
                                    variant={getStatusBadgeVariant(
                                      report.status
                                    )}
                                  >
                                    {report.status}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                {report.status === "Completed" ? (
                                  <div className="font-medium">
                                    {report.complianceScore}%
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {report.status === "Completed" ? (
                                  <div className="text-sm">
                                    {sum(
                                      report.criticalIssues,
                                      report.highIssues,
                                      report.mediumIssues,
                                      report.lowIssues
                                    )}{" "}
                                    total
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" asChild>
                                  <Link
                                    href={`/compliance-reports/${report.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {isEditingTemplate ? "Save Template" : "Edit Template"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {templateStructureExpanded && (
            <CardContent className="space-y-6">
              {isEditingTemplate && (
                <div className="flex justify-end mb-4">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Section
                  </Button>
                </div>
              )}

              {template.sections.map((section, sectionIndex) => (
                <div key={section.object_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1"
                      onClick={() => toggleSection(section.object_id)}
                    >
                      {expandedSections.has(section.object_id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">
                          {sectionIndex + 1}. {section.name}
                        </h4>
                        {section.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {section.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {section.rules.length} rule
                        {section.rules.length !== 1 ? "s" : ""}
                      </Badge>
                      {isEditingTemplate && (
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {(expandedSections.has(section.object_id) ||
                    isEditingTemplate) && (
                    <div className="space-y-3">
                      {isEditingTemplate && (
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline">
                            <Plus className="mr-2 h-3 w-3" />
                            Add Rule
                          </Button>
                        </div>
                      )}

                      {section.rules.map((rule, ruleIndex) => (
                        <div
                          key={rule.object_id}
                          className="border-l-4 border-l-blue-500 pl-4 py-2 bg-muted/30 rounded-r"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h5 className="font-medium">
                                  {sectionIndex + 1}.{ruleIndex + 1} {rule.name}
                                </h5>
                                {rule.policy_name && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {rule.policy_name}
                                  </Badge>
                                )}
                                {rule.public && (
                                  <Badge variant="outline" className="text-xs">
                                    Public
                                  </Badge>
                                )}
                              </div>

                              <p className="text-sm text-muted-foreground mb-2">
                                <strong>Rule:</strong> {rule.rule}
                              </p>

                              {rule.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                  <strong>Description:</strong>{" "}
                                  {rule.description}
                                </p>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
                                {rule.scope && (
                                  <div>
                                    <strong>Scope:</strong> {rule.scope}
                                  </div>
                                )}
                                {rule.source && (
                                  <div>
                                    <strong>Source:</strong> {rule.source}
                                  </div>
                                )}
                                {rule.policy_version && (
                                  <div>
                                    <strong>Policy Version:</strong>{" "}
                                    {rule.policy_version}
                                  </div>
                                )}
                                {rule.tags && (
                                  <div>
                                    <strong>Tags:</strong> {rule.tags}
                                  </div>
                                )}
                              </div>

                              {rule.evidence_schema &&
                                Object.keys(rule.evidence_schema).length >
                                  0 && (
                                  <div className="mt-3 p-2 bg-background rounded border">
                                    <strong className="text-xs">
                                      Evidence Requirements:
                                    </strong>
                                    <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                      {JSON.stringify(
                                        rule.evidence_schema,
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </div>
                                )}

                              {isEditingTemplate && (
                                <div className="ml-4">
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {template.sections.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>
                    This template doesn&apos;t have any sections defined yet.
                  </p>
                  {isEditingTemplate && (
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Section
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Historical Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>
            All reports generated for this template ({sortedReports.length}{" "}
            total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Generated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance Score</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {new Date(report.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(report.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(report.status)}
                      <Badge variant={getStatusBadgeVariant(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {report.status === "Completed" ? (
                      <div className="font-medium">
                        {report.complianceScore}%
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {report.status === "Completed" ? (
                      <div className="space-y-1">
                        <div className="text-sm">
                          {sum(
                            report.criticalIssues,
                            report.highIssues,
                            report.mediumIssues,
                            report.lowIssues
                          )}{" "}
                          total
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {report.criticalIssues}C • {report.highIssues}H •{" "}
                          {report.mediumIssues}M • {report.lowIssues}L
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {report.version}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/compliance-reports/${report.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {report.status === "Completed" && (
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
