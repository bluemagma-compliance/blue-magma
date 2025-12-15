"use client";

import { useState, useEffect } from "react";
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
  FileText,
  PlusCircle,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  ComplianceReport,
  ReportTemplate,
  UiReportTemplate,
  Codebase,
} from "@/types/api";
import { generateReport, getTemplateCodebasesWithVersions } from "../actions";
import { VersionSelectionModal } from "./VersionSelectionModal";

function getStatusIcon(status: ComplianceReport["status"]) {
  switch (status) {
    case "Completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "Failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "Running":
      return <Clock className="h-5 w-5 text-blue-500" />;
    case "Pending":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-gray-500" />;
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

export default function ComplianceReportsTab() {
  const router = useRouter();
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [templates, setTemplates] = useState<UiReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Version selection modal state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [selectedTemplateForGeneration, setSelectedTemplateForGeneration] =
    useState<UiReportTemplate | null>(null);
  const [templateCodebases, setTemplateCodebases] = useState<Codebase[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Import the functions dynamically to avoid server-side execution
        const { getComplianceReports, debugLogTemplates } = await import(
          "../actions"
        );
        const { getTemplates } = await import("../template-actions");

        const [reportsData, templatesData] = await Promise.all([
          getComplianceReports(),
          getTemplates(),
        ]);

        setReports(reportsData);
        setTemplates(templatesData);

        // Debug logging to see what templates are being returned
        console.log("=== REPORTS TAB DEBUG ===");
        console.log("Reports count:", reportsData.length);
        console.log("Templates count:", templatesData.length);
        console.log(
          "Active templates count:",
          templatesData.filter((t) => t.active).length
        );

        // Debug reports data
        console.log("=== REPORTS DATA ===");
        console.table(
          reportsData.map((r) => ({
            ID: r.object_id || r.id,
            Name: r.name,
            TemplateID: r.template_id,
            Status: r.status,
            CreatedAt: r.created_at,
          }))
        );

        // Call the detailed debug function
        await debugLogTemplates();
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Create a map of template IDs to templates for quick lookup
  const templateMap = new Map<string, UiReportTemplate>();
  templates.forEach((template) => {
    templateMap.set(template.object_id, template);
  });

  // Get active templates that don't have reports yet
  const activeTemplates = templates.filter((template) => template.active);
  const templatesWithReports = new Set(
    reports.map((report) => report.template_id).filter(Boolean)
  );
  const activeTemplatesWithoutReports = activeTemplates.filter(
    (template) => !templatesWithReports.has(template.object_id)
  );

  // Group reports by template
  const reportsByTemplate = reports.reduce(
    (acc, report) => {
      const templateId = report.template_id;
      if (!templateId) return acc;

      const template = templateMap.get(templateId);
      const key = templateId;

      if (!acc[key]) {
        acc[key] = {
          template: template,
          templateName: template?.name || report.name.replace(/\s+Report$/, ""),
          reports: [],
          mostRecent: null,
        };
      }
      acc[key].reports.push(report);

      // Find most recent report (assuming reports have a date field)
      if (
        !acc[key].mostRecent ||
        new Date(report.created_at) > new Date(acc[key].mostRecent.created_at)
      ) {
        acc[key].mostRecent = report;
      }

      return acc;
    },
    {} as Record<
      string,
      {
        template?: UiReportTemplate;
        templateName: string;
        reports: typeof reports;
        mostRecent: (typeof reports)[0] | null;
      }
    >
  );

  const templateGroups = Object.values(reportsByTemplate);

  // Separate active and inactive template groups
  const activeTemplateGroups = templateGroups.filter(
    (group) => group.template?.active === true
  );
  const archivedTemplateGroups = templateGroups.filter(
    (group) => group.template?.active === false
  );

  // Debug logging for filtering logic
  console.log("=== FILTERING DEBUG ===");
  console.log(
    "All templates:",
    templates.map((t) => ({ id: t.object_id, name: t.name, active: t.active }))
  );
  console.log(
    "Active templates:",
    activeTemplates.map((t) => ({
      id: t.object_id,
      name: t.name,
      active: t.active,
    }))
  );
  console.log("Templates with reports:", Array.from(templatesWithReports));
  console.log(
    "Active templates without reports:",
    activeTemplatesWithoutReports.map((t) => ({
      id: t.object_id,
      name: t.name,
      active: t.active,
    }))
  );
  console.log(
    "Should show Active Templates section:",
    activeTemplatesWithoutReports.length > 0
  );
  console.log(
    "Active template groups (with reports):",
    activeTemplateGroups.length
  );
  console.log(
    "Archived template groups (with reports):",
    archivedTemplateGroups.length
  );

  const handleTemplateClick = (template: UiReportTemplate) => {
    console.log("Template clicked:", template.name, template.object_id);
    // Store template data in sessionStorage to pass to the overview page
    sessionStorage.setItem("templateData", JSON.stringify(template));
    router.push(`/compliance-reports/${template.object_id}`);
  };

  const handleGenerateReport = async (templateId: string) => {
    try {
      // Find the template
      const template = templates.find((t) => t.object_id === templateId);
      if (!template) {
        console.error("Template not found:", templateId);
        return;
      }

      // Fetch codebases with versions for this template
      const codebases = await getTemplateCodebasesWithVersions(templateId);

      if (codebases.length === 0) {
        if (typeof window !== "undefined") {
          const { toast } = await import("sonner");
          toast.error("No codebases found for this template");
        }
        return;
      }

      // Check if any codebase has versions
      const hasVersions = codebases.some(
        (cb) => cb.versions && cb.versions.length > 0
      );
      if (!hasVersions) {
        if (typeof window !== "undefined") {
          const { toast } = await import("sonner");
          toast.error(
            "No versions available for the codebases in this template"
          );
        }
        return;
      }

      // Set up version selection modal
      setSelectedTemplateForGeneration(template);
      setTemplateCodebases(codebases);
      setIsVersionModalOpen(true);
    } catch (error) {
      console.error("Error preparing report generation:", error);
      if (typeof window !== "undefined") {
        const { toast } = await import("sonner");
        toast.error("Failed to prepare report generation");
      }
    }
  };

  const handleVersionSelectionConfirm = async (versionId: string) => {
    if (!selectedTemplateForGeneration) return;

    console.log("=== VERSION SELECTION CONFIRM DEBUG ===");
    console.log("Selected template:", selectedTemplateForGeneration.object_id);
    console.log("Selected version ID:", versionId);

    try {
      setIsGenerating(true);

      const result = await generateReport(
        selectedTemplateForGeneration.object_id,
        versionId
      );

      if (result.success) {
        // Refresh the data to show the new report
        const { getComplianceReports } = await import("../actions");
        const { getTemplates } = await import("../template-actions");

        const [reportsData, templatesData] = await Promise.all([
          getComplianceReports(),
          getTemplates(),
        ]);

        setReports(reportsData);
        setTemplates(templatesData);

        // Show success message
        if (typeof window !== "undefined") {
          const { toast } = await import("sonner");
          toast.success("Report generation started successfully!");
        }

        // Close modal
        setIsVersionModalOpen(false);
        setSelectedTemplateForGeneration(null);
        setTemplateCodebases([]);
      } else {
        // Show error message
        if (typeof window !== "undefined") {
          const { toast } = await import("sonner");
          toast.error(result.message);
        }
      }
    } catch (error) {
      console.error("Error generating report:", error);
      if (typeof window !== "undefined") {
        const { toast } = await import("sonner");
        toast.error("Failed to generate report");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVersionSelectionCancel = () => {
    setIsVersionModalOpen(false);
    setSelectedTemplateForGeneration(null);
    setTemplateCodebases([]);
    setIsGenerating(false);
  };

  const handleViewAllReports = (templateId: string, templateName: string) => {
    router.push(`/compliance-reports/template/${templateId || templateName}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">Compliance Reports</h3>
            <p className="text-sm text-muted-foreground">
              Loading reports and templates...
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-semibold">Compliance Reports</h3>
          <p className="text-sm text-muted-foreground">
            View reports organized by template and framework
          </p>
        </div>
      </div>

      {/* Active Templates Without Reports */}
      {activeTemplatesWithoutReports.length > 0 && (
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-semibold">Active Templates</h4>
            <p className="text-sm text-muted-foreground">
              Ready for report generation
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeTemplatesWithoutReports.map((template) => (
              <Card
                key={template.object_id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleTemplateClick(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <CardTitle className="text-base">
                        {template.name}
                      </CardTitle>
                    </div>
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Codebases</span>
                    <span>{template.codebases?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Sections</span>
                    <span>{template.sections?.length || 0}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleGenerateReport(template.object_id);
                      }}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Generate Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Templates with Reports Section */}
      {activeTemplateGroups.length > 0 && (
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-semibold">
              Active Templates with Reports
            </h4>
            <p className="text-sm text-muted-foreground">
              Active templates with previously generated compliance reports
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeTemplateGroups.map((group) => {
              const mostRecent = group.mostRecent!;
              const template = group.template;
              const isActive = template?.active || false;

              return (
                <Card
                  key={group.templateName}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => template && handleTemplateClick(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(mostRecent.status)}
                        <CardTitle className="text-lg">
                          {group.templateName}
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
                        {isActive && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                        {mostRecent.status && (
                          <Badge
                            variant={getStatusBadgeVariant(mostRecent.status)}
                          >
                            {mostRecent.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="text-sm">
                      {template?.description ||
                        `${mostRecent.framework || "Compliance"} Report`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {group.reports.length} report
                        {group.reports.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {mostRecent.status === "Completed" && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Compliance Rate</span>
                          <span className="font-medium">
                            {mostRecent.compliance_percentage !== undefined
                              ? `${Math.round(mostRecent.compliance_percentage)}%`
                              : mostRecent.complianceScore
                                ? `${mostRecent.complianceScore}%`
                                : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Non-Compliant</span>
                          <span>
                            {mostRecent.non_compliant_count !== undefined
                              ? mostRecent.non_compliant_count
                              : (mostRecent.criticalIssues || 0) +
                                (mostRecent.highIssues || 0) +
                                (mostRecent.mediumIssues || 0) +
                                (mostRecent.lowIssues || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Action Items</span>
                          <span>
                            {mostRecent.actionable_items?.length || 0}
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {mostRecent.summary}
                    </p>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleGenerateReport(template?.object_id || "");
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Archived Templates Section */}
      {archivedTemplateGroups.length > 0 && (
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-semibold">Archived Templates</h4>
            <p className="text-sm text-muted-foreground">
              Inactive templates with historical compliance reports
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {archivedTemplateGroups.map((group) => {
              const mostRecent = group.mostRecent!;
              const template = group.template;

              return (
                <Card
                  key={group.templateName}
                  className="hover:shadow-md transition-shadow cursor-pointer border-orange-200 bg-orange-50/30"
                  onClick={() => template && handleTemplateClick(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(mostRecent.status)}
                        <CardTitle className="text-lg">
                          {group.templateName}
                        </CardTitle>
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant="secondary"
                          className="text-xs bg-orange-100 text-orange-800"
                        >
                          Archived
                        </Badge>
                      </div>
                    </div>
                    {template?.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Last run:{" "}
                        {new Date(mostRecent.created_at).toLocaleDateString()}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {group.reports.length} report
                        {group.reports.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {mostRecent.status === "completed" && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Issues Found</span>
                          <span>
                            {(mostRecent.criticalIssues || 0) +
                              (mostRecent.highIssues || 0) +
                              (mostRecent.mediumIssues || 0) +
                              (mostRecent.lowIssues || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault();
                        // Don't stop propagation - let the card click handler work too
                        if (template) {
                          handleTemplateClick(template);
                        }
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Reports
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {activeTemplateGroups.length === 0 &&
        archivedTemplateGroups.length === 0 &&
        activeTemplatesWithoutReports.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No Reports or Templates
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                You haven&apos;t created any templates or generated any
                compliance reports yet. Create and activate a template first,
                then generate reports from it.
              </p>
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>Understanding These Reports</CardTitle>
          <CardDescription>
            Compliance reports are typically generated on a periodic basis or
            upon significant organizational changes. They consolidate various
            pieces of evidence required by auditors and regulatory bodies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Ensure all relevant policies are up-to-date and linked within the
              report sections.
            </li>
            <li>
              Regularly review and update evidence, especially after system
              changes or new feature deployments.
            </li>
            <li>
              Consult with your legal and compliance teams to ensure accuracy
              and completeness.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Version Selection Modal */}
      <VersionSelectionModal
        isOpen={isVersionModalOpen}
        onOpenChange={setIsVersionModalOpen}
        templateId={selectedTemplateForGeneration?.object_id || ""}
        templateName={selectedTemplateForGeneration?.name || ""}
        codebases={templateCodebases}
        isGenerating={isGenerating}
        onConfirm={handleVersionSelectionConfirm}
        onCancel={handleVersionSelectionCancel}
      />
    </div>
  );
}
