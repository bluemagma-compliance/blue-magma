"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart3,
  FileText,
  Download,
  Eye,
  MoreHorizontal,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Code,
  Search,
  Upload,
  Settings,
  Play,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Project } from "../types";

// Import the same components used in the main reports page
import TemplateManager from "../../compliance-reports/components/template-manager";
import TemplateEditor from "../../compliance-reports/components/template-editor";
import type { UiReportTemplate, TemplateImportData } from "@/types/api";
import {
  importTemplate,
  exportTemplate,
} from "../../compliance-reports/template-actions";

interface ProjectReportsTabProps {
  project: Project;
}

export function ProjectReportsTab({ project }: ProjectReportsTabProps) {
  const [activeTab, setActiveTab] = useState<"reports" | "templates">(
    "reports"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTemplate, setEditingTemplate] =
    useState<UiReportTemplate | null>(null);
  const [templateSaveCounter, setTemplateSaveCounter] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  // Mock data for reports - in real app this would come from API filtered by project
  const mockReports = [
    {
      id: "report-1",
      name: "HIPAA Compliance Scan",
      type: "HIPAA",
      status: "completed",
      createdAt: "2024-01-15",
      codebase: "healthcare-api",
      findings: { critical: 2, high: 5, medium: 12, low: 8 },
    },
    {
      id: "report-2",
      name: "Security Vulnerability Assessment",
      type: "Security",
      status: "completed",
      createdAt: "2024-01-10",
      codebase: "patient-portal",
      findings: { critical: 0, high: 3, medium: 7, low: 15 },
    },
    {
      id: "report-3",
      name: "Data Privacy Analysis",
      type: "Privacy",
      status: "running",
      createdAt: "2024-01-20",
      codebase: "healthcare-api",
      findings: null,
    },
  ];

  // Template management functions
  const handleSaveTemplate = (template: UiReportTemplate) => {
    console.log("Saving template:", template);
    setEditingTemplate(null);
    setTemplateSaveCounter((prev) => prev + 1);
    toast.success("Template saved successfully!");
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
  };

  const handleCopyTemplate = (template: UiReportTemplate) => {
    const copiedTemplate: UiReportTemplate = {
      ...template,
      object_id: `custom-${Date.now()}`,
      name: `${template.name} (Copy)`,
      active: false,
      isPremade: false,
    };
    setEditingTemplate(copiedTemplate);
  };

  // Import template handler
  const handleImportTemplate = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/json") {
      toast.error("Please select a valid JSON file");
      return;
    }

    try {
      setIsImporting(true);
      const fileContent = await file.text();
      const templateData: TemplateImportData = JSON.parse(fileContent);

      if (!templateData.name || !templateData.description) {
        toast.error("Invalid template file: missing required fields");
        return;
      }

      await importTemplate(templateData);
      toast.success("Template imported successfully!");
      setTemplateSaveCounter((prev) => prev + 1);
      event.target.value = "";
    } catch (error) {
      console.error("Import error:", error);
      if (error instanceof SyntaxError) {
        toast.error("Invalid JSON file format");
      } else {
        toast.error("Failed to import template: " + (error as Error).message);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Export template handler
  const handleExportTemplate = async (template: UiReportTemplate) => {
    try {
      const exportData = await exportTemplate(template.object_id);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${template.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_template.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Template exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export template: " + (error as Error).message);
    }
  };

  // Utility functions for status display
  function getStatusIcon(status: string) {
    switch (status.toLowerCase()) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case "pending":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  }

  function getStatusBadge(status: string) {
    const baseClasses = "text-xs font-normal";

    switch (status.toLowerCase()) {
      case "completed":
        return (
          <Badge
            variant="outline"
            className={`${baseClasses} text-green-600 border-green-200 bg-green-50`}
          >
            {getStatusIcon(status)}
            <span className="ml-1">Completed</span>
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className={`${baseClasses} text-red-600 border-red-200 bg-red-50`}
          >
            {getStatusIcon(status)}
            <span className="ml-1">Failed</span>
          </Badge>
        );
      case "running":
        return (
          <Badge
            variant="outline"
            className={`${baseClasses} text-blue-600 border-blue-200 bg-blue-50`}
          >
            {getStatusIcon(status)}
            <span className="ml-1">Running</span>
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className={`${baseClasses} text-gray-600 border-gray-200 bg-gray-50`}
          >
            {getStatusIcon(status)}
            <span className="ml-1">{status}</span>
          </Badge>
        );
    }
  }

  // Calculate stats
  const stats = {
    total: mockReports.length,
    completed: mockReports.filter((r) => r.status.toLowerCase() === "completed")
      .length,
    failed: mockReports.filter((r) => r.status.toLowerCase() === "failed")
      .length,
    running: mockReports.filter((r) => r.status.toLowerCase() === "running")
      .length,
  };

  // Show template editor if editing
  if (editingTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleCancelEdit}>
            ← Back to Reports
          </Button>
          <h3 className="text-lg font-semibold">
            {editingTemplate.object_id.startsWith("custom-")
              ? "Create"
              : "Edit"}{" "}
            Template
          </h3>
        </div>
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Compliance Reports</h3>
          <p className="text-sm text-muted-foreground">
            Manage templates and generate compliance reports for {project.name}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "reports" | "templates")
        }
      >
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="reports" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Reports</span>
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="flex items-center space-x-2"
          >
            <Settings className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          {/* Stats */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>{stats.total} reports</span>
            </div>
            <div className="flex items-center gap-2">
              <span>•</span>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>{stats.completed} completed</span>
            </div>
            {stats.failed > 0 && (
              <div className="flex items-center gap-2">
                <span>•</span>
                <XCircle className="h-4 w-4 text-red-600" />
                <span>{stats.failed} failed</span>
              </div>
            )}
            {stats.running > 0 && (
              <div className="flex items-center gap-2">
                <span>•</span>
                <Clock className="h-4 w-4 text-blue-600" />
                <span>{stats.running} running</span>
              </div>
            )}
          </div>

          {/* Reports Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Run Report
            </Button>
          </div>

          {/* Reports Table */}
          {mockReports.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Name</TableHead>
                    <TableHead>Codebase</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Findings</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{report.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {report.type} Analysis
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{report.codebase}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {report.findings ? (
                          <div className="flex items-center gap-2 text-xs">
                            {report.findings.critical > 0 && (
                              <span className="text-red-600">
                                {report.findings.critical} Critical
                              </span>
                            )}
                            {report.findings.high > 0 && (
                              <span className="text-orange-600">
                                {report.findings.high} High
                              </span>
                            )}
                            {report.findings.medium > 0 && (
                              <span className="text-yellow-600">
                                {report.findings.medium} Medium
                              </span>
                            )}
                            {report.findings.low > 0 && (
                              <span className="text-gray-600">
                                {report.findings.low} Low
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/projects/${project.id}/reports/${report.id}`}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Report
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h4 className="font-medium mb-2">No reports yet</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate compliance reports to analyze the codebases in this
                  project.
                </p>
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  Run First Report
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-6">
          {/* Template Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>

              {/* Import Template Button */}
              <div className="relative">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportTemplate}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isImporting}
                />
                <Button variant="outline" disabled={isImporting}>
                  <Upload className="mr-1 h-4 w-4" />
                  {isImporting ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>

            <Button
              onClick={() =>
                setEditingTemplate({
                  object_id: `custom-${Date.now()}`,
                  name: "New Custom Template",
                  description: "",
                  active: true,
                  organization_id: "1",
                  codebases: [],
                  sections: [],
                  framework: "Custom",
                  category: "general",
                  isPremade: false,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>

          {/* Template Manager */}
          <TemplateManager
            onEditTemplate={setEditingTemplate}
            onTemplateSaved={() => templateSaveCounter}
            hideHeader={true}
            hideCreateButton={true}
            externalSearchQuery={searchQuery}
            onCopyTemplate={handleCopyTemplate}
            onExportTemplate={handleExportTemplate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
