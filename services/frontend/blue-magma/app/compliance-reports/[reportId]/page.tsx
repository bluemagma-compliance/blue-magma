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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  FileText,
  Shield,
  Users,
  ChartNoAxesCombined,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReportTemplate, ComplianceReport, Codebase } from "@/types/api";
import { VersionSelectionModal } from "../components/VersionSelectionModal";
import { ReportsTable } from "@/components/ReportsTable";

interface TemplateOverviewPageProps {
  params: Promise<{
    reportId: string; // This is actually a template ID
  }>;
}

export default function TemplateOverviewPage({
  params,
}: TemplateOverviewPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const templateId = resolvedParams.reportId; // This is actually a template ID

  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [templateReports, setTemplateReports] = useState<ComplianceReport[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Version selection modal state
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [templateCodebases, setTemplateCodebases] = useState<Codebase[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get template data from sessionStorage
        const templateData = sessionStorage.getItem("templateData");
        if (!templateData) {
          router.push("/compliance-reports");
          return;
        }

        const parsedTemplate: ReportTemplate = JSON.parse(templateData);

        // Verify this is the correct template (allow both active and archived)
        if (parsedTemplate.object_id !== templateId) {
          router.push("/compliance-reports");
          return;
        }

        setTemplate(parsedTemplate);

        // Get all reports and filter by this template
        const { getComplianceReports } = await import("../actions");
        const allReports = await getComplianceReports();
        const filteredReports = allReports.filter(
          (report) => report.template_id === templateId
        );
        setTemplateReports(filteredReports);
      } catch (error) {
        console.error("Error loading template data:", error);
        router.push("/compliance-reports");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [templateId, router]);

  const handleGenerateReport = async () => {
    if (!template) return;

    try {
      // Import the function to fetch codebases with versions
      const { getTemplateCodebasesWithVersions } = await import("../actions");

      // Fetch codebases with versions for this template
      const codebases = await getTemplateCodebasesWithVersions(
        template.object_id
      );

      if (codebases.length === 0) {
        const { toast } = await import("sonner");
        toast.error("No codebases found for this template");
        return;
      }

      // Check if any codebase has versions
      const hasVersions = codebases.some(
        (cb) => cb.versions && cb.versions.length > 0
      );
      if (!hasVersions) {
        const { toast } = await import("sonner");
        toast.error("No versions available for the codebases in this template");
        return;
      }

      // Set up version selection modal
      setTemplateCodebases(codebases);
      setIsVersionModalOpen(true);
    } catch (error) {
      console.error("Error preparing report generation:", error);
      const { toast } = await import("sonner");
      toast.error("Failed to prepare report generation");
    }
  };

  const handleVersionSelectionConfirm = async (versionId: string) => {
    if (!template) return;

    console.log("=== TEMPLATE OVERVIEW VERSION SELECTION DEBUG ===");
    console.log("Template:", template.object_id);
    console.log("Version ID:", versionId);

    try {
      setIsGenerating(true);

      // Import the function dynamically
      const { generateReport } = await import("../actions");

      const result = await generateReport(template.object_id, versionId);

      if (result.success) {
        // Refresh the reports data
        const { getComplianceReports } = await import("../actions");
        const allReports = await getComplianceReports();
        const filteredReports = allReports.filter(
          (report) => report.template_id === templateId
        );
        setTemplateReports(filteredReports);

        // Show success message
        const { toast } = await import("sonner");
        toast.success("Report generation started successfully!");

        // Close modal
        setIsVersionModalOpen(false);
        setTemplateCodebases([]);
      } else {
        // Show error message
        const { toast } = await import("sonner");
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      const { toast } = await import("sonner");
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVersionSelectionCancel = () => {
    setIsVersionModalOpen(false);
    setTemplateCodebases([]);
    setIsGenerating(false);
  };

  // Calculate stats from reports
  const totalReports = templateReports.length;
  const completedReports = templateReports.filter(
    (r) => r.status === "Completed"
  ).length;
  const mostRecentReport =
    templateReports.length > 0
      ? templateReports.reduce((latest, current) =>
          new Date(current.created_at) > new Date(latest.created_at)
            ? current
            : latest
        )
      : null;

  if (loading) {
    return (
      <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex-1 space-y-8 p-4 pt-6 md:p-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Template Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The template you&apos;re looking for doesn&apos;t exist.
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/compliance-reports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Link>
          </Button>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <FileText
                className={`h-8 w-8 ${
                  template.active ? "text-blue-500" : "text-orange-500"
                }`}
              />
              <h1 className="text-3xl font-bold tracking-tight">
                {template.name}
              </h1>
            </div>
            <p className="text-muted-foreground">{template.description}</p>
          </div>

          {template.active && (
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <ChartNoAxesCombined className="mr-1 h-4 w-4" />
                  Generate New Report
                </>
              )}
            </Button>
          )}
          {!template.active && (
            <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800 font-medium">
                This template is archived
              </p>
              <p className="text-xs text-orange-600 mt-1">
                New reports cannot be generated from archived templates
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Template Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <ChartNoAxesCombined className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground">
              Generated from this template
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Reports
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedReports}</div>
            <p className="text-xs text-muted-foreground">
              Successfully completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assigned Codebases
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {template.codebases?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Codebases using template
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Template Sections
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {template.sections?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Compliance sections</p>
          </CardContent>
        </Card>
      </div>

      {/* Template Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Template Description */}
          <Card>
            <CardHeader>
              <CardTitle>Template Overview</CardTitle>
              <CardDescription>
                Description and configuration of this compliance template
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{template.description}</p>
            </CardContent>
          </Card>

          {/* Reports Generated from this Template */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Reports</CardTitle>
              <CardDescription>
                All reports generated from this template (
                {templateReports.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templateReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No reports generated yet</p>
                  {template.active ? (
                    <p className="text-sm">
                      Click &quot;Generate New Report&quot; to create the first
                      report
                    </p>
                  ) : (
                    <p className="text-sm">
                      This archived template has no historical reports
                    </p>
                  )}
                </div>
              ) : (
                <ReportsTable reports={templateReports} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Template Name
                </label>
                <p className="text-sm">{template.name}</p>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <div className="flex items-center gap-2 mt-1">
                  {template.active ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Active</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Archived</span>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Assigned Codebases
                </label>
                <p className="text-sm">
                  {template.codebases?.length || 0} codebases
                </p>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Template Sections
                </label>
                <p className="text-sm">
                  {template.sections?.length || 0} sections
                </p>
              </div>

              {mostRecentReport && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Last Report
                    </label>
                    <p className="text-sm">
                      {new Date(
                        mostRecentReport.created_at
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Version Selection Modal */}
      <VersionSelectionModal
        isOpen={isVersionModalOpen}
        onOpenChange={setIsVersionModalOpen}
        templateId={template?.object_id || ""}
        templateName={template?.name || ""}
        codebases={templateCodebases}
        isGenerating={isGenerating}
        onConfirm={handleVersionSelectionConfirm}
        onCancel={handleVersionSelectionCancel}
      />
    </div>
  );
}
