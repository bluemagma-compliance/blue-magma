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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import TemplateEditor from "./template-editor";
import TemplateManager from "./template-manager";
import type {
  ReportTemplate,
  Codebase,
  TemplateImportData,
  UiReportTemplate,
} from "@/types/api";
import {
  getCodebases,
  createTemplate,
  createTemplateSection,
  createRule,
  importTemplate,
  exportTemplate,
} from "../template-actions";
import { toast } from "sonner";
import { Plus, Search, Copy, Upload, Star } from "lucide-react";

// Feature flag for industry templates
const SHOW_INDUSTRY_TEMPLATES = false;

// Using the ReportTemplate from types/api.ts now
// Removed mock templates - will use real data from backend

export default function ReportTemplatesTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTemplate, setEditingTemplate] =
    useState<UiReportTemplate | null>(null);
  const [templateSaveCounter, setTemplateSaveCounter] = useState(0);

  // Industry template state - only needed when feature is enabled
  const [isCodebaseModalOpen, setIsCodebaseModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<UiReportTemplate | null>(null);
  const [selectedCodebases, setSelectedCodebases] = useState<string[]>([]);
  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [loadingCodebases, setLoadingCodebases] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Import/Export state
  const [isImporting, setIsImporting] = useState(false);

  // Load codebases when component mounts - only if industry templates are enabled
  useEffect(() => {
    if (SHOW_INDUSTRY_TEMPLATES) {
      loadCodebases();
    }
  }, []);

  const loadCodebases = async () => {
    if (!SHOW_INDUSTRY_TEMPLATES) return;

    try {
      setLoadingCodebases(true);
      const codebasesData = await getCodebases();
      setCodebases(codebasesData || []);
    } catch (error) {
      console.error("Failed to load codebases:", error);
      setCodebases([]);
    } finally {
      setLoadingCodebases(false);
    }
  };

  // Filter templates based on search query
  const filterTemplates = (templates: UiReportTemplate[]) => {
    if (!searchQuery.trim()) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        (template.framework &&
          template.framework.toLowerCase().includes(query)) ||
        template.description.toLowerCase().includes(query) ||
        (template.category && template.category.toLowerCase().includes(query)),
    );
  };

  // No more mock templates - industry templates will be loaded from backend when feature is enabled
  const allPremadeTemplates: UiReportTemplate[] = [];

  const premadeTemplates = filterTemplates(allPremadeTemplates);

  const handleSaveTemplate = (template: UiReportTemplate) => {
    // TODO: Save template to backend using template actions
    console.log("Saving template:", template);
    setEditingTemplate(null);
    // Trigger refresh of template list in TemplateManager
    setTemplateSaveCounter((prev) => prev + 1);
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
  };

  const handleCopyTemplate = (template: UiReportTemplate) => {
    // Create a copy of the template with a new name and ID
    const copiedTemplate: UiReportTemplate = {
      ...template,
      object_id: `custom-${Date.now()}`,
      name: `${template.name} (Copy)`,
      active: false, // Start as inactive so user can configure it
      isPremade: false,
    };

    // Open the template editor with the copied template
    setEditingTemplate(copiedTemplate);
  };

  const handleConfirmCopyTemplate = async () => {
    if (!SHOW_INDUSTRY_TEMPLATES || !selectedTemplate) return;

    try {
      setIsCreating(true);

      // Step 1: Create the base template
      const newTemplate = await createTemplate({
        name: `${selectedTemplate.name} (Copy)`,
        description: selectedTemplate.description,
        active: true,
        codebases: selectedCodebases,
      });

      console.log("Created base template:", newTemplate.object_id);

      // Step 2: Copy all sections and rules from the industry template
      if (selectedTemplate.sections && selectedTemplate.sections.length > 0) {
        for (const section of selectedTemplate.sections) {
          console.log("Processing section:", section.name);

          // Create rules for this section first
          const ruleIds: string[] = [];

          if (section.rules && section.rules.length > 0) {
            for (const rule of section.rules) {
              try {
                console.log("Creating rule:", rule.name);

                const createdRule = await createRule({
                  name: rule.name,
                  description: rule.description || "",
                  rule: rule.rule || "",
                  evidence_schema: JSON.stringify(
                    rule.evidence_schema || {
                      required_documents: [],
                    },
                  ),
                  policy_name: rule.policy_name || "",
                  policy_version: rule.policy_version || "1.0",
                  public: false,
                  scope: rule.scope || "",
                  section: rule.section || "",
                  severity: rule.severity || "medium",
                  source: "custom",
                  tags: rule.tags || "",
                });

                console.log("Rule created with ID:", createdRule.object_id);
                ruleIds.push(createdRule.object_id);
              } catch (error) {
                console.error("Failed to create rule:", rule.name, error);
                toast.error(`Failed to create rule: ${rule.name}`);
                // Continue with other rules
              }
            }
          }

          // Create the section with the created rules
          try {
            console.log(
              "Creating section:",
              section.name,
              "with rules:",
              ruleIds,
            );

            await createTemplateSection({
              name: section.name,
              description: section.description || "",
              template_id: newTemplate.object_id,
              rules: ruleIds,
            });

            console.log("Section created successfully:", section.name);
          } catch (error) {
            console.error("Failed to create section:", section.name, error);
            toast.error(`Failed to create section: ${section.name}`);
            // Continue with other sections
          }
        }
      }

      toast.success(
        "Template created successfully with all sections and rules! It will now appear in reports.",
      );
      setIsCodebaseModalOpen(false);
      setSelectedTemplate(null);
      setSelectedCodebases([]);
      setTemplateSaveCounter((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to create template:", error);
      toast.error("Failed to create template");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelCopyTemplate = () => {
    if (!SHOW_INDUSTRY_TEMPLATES) return;

    setIsCodebaseModalOpen(false);
    setSelectedTemplate(null);
    setSelectedCodebases([]);
  };

  // Import template handler
  const handleImportTemplate = async (
    event: React.ChangeEvent<HTMLInputElement>,
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

      // Validate required fields
      if (!templateData.name || !templateData.description) {
        toast.error(
          "Invalid template file: missing required fields (name, description)",
        );
        return;
      }

      if (!templateData.sections || !Array.isArray(templateData.sections)) {
        toast.error("Invalid template file: sections must be an array");
        return;
      }

      // Import the template
      await importTemplate(templateData);
      toast.success("Template imported successfully!");
      setTemplateSaveCounter((prev) => prev + 1);

      // Clear the file input
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

      // Create and download the file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${template.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}_template.json`;
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

  // Show template editor if editing
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onSave={handleSaveTemplate}
        onCancel={handleCancelEdit}
      />
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Compliance Reports
          </h2>
        </div>

        {/* Header with unified create action */}
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
          <p className="text-muted-foreground">
            Access comprehensive compliance reports based on your
            organization&apos;s templates. Generate reports from templates or
            create custom ones.
          </p>
          <div className="flex flex-wrap w-full justify-end items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
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
              <Plus className="mr-1 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Industry Templates - Feature Flagged */}
        {SHOW_INDUSTRY_TEMPLATES && (
          <div>
            <h3 className="text-base font-medium text-muted-foreground mb-4">
              Industry Templates
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {filterTemplates(premadeTemplates).map((template) => (
                <Card
                  key={template.id}
                  className="hover:shadow-md transition-shadow border-blue-200"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">
                            {template.name}
                          </CardTitle>
                          {template.isPopular && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {template.framework}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {template.sections.length} section
                          {template.sections.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleCopyTemplate(template)}
                      >
                        <Copy className="mr-2 h-3 w-3" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Visual separator */}
        <div className="border-t border-border/40"></div>

        {/* Templates List - Clean and organized */}
        <div className="space-y-6">
          <TemplateManager
            onEditTemplate={setEditingTemplate}
            onTemplateSaved={() => templateSaveCounter}
            hideHeader={true}
            hideCreateButton={true}
            externalSearchQuery={searchQuery}
            onCopyTemplate={handleCopyTemplate}
            onExportTemplate={handleExportTemplate}
          />
        </div>

        {/* Codebase Selection Modal for Industry Templates - Feature Flagged */}
        {SHOW_INDUSTRY_TEMPLATES && (
          <Dialog
            open={isCodebaseModalOpen}
            onOpenChange={setIsCodebaseModalOpen}
          >
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Select Codebases for Template</DialogTitle>
                <DialogDescription>
                  Choose which codebases this template should apply to. A
                  complete copy of the template with all sections and rules will
                  be created for your organization.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {loadingCodebases ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p>Loading codebases...</p>
                  </div>
                ) : codebases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No codebases available</p>
                    <p className="text-sm mt-1">
                      Add a codebase first to use templates
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    <Label className="text-sm font-medium">
                      Available Codebases
                    </Label>
                    {codebases.map((codebase) => {
                      const isSelected = selectedCodebases.includes(
                        codebase.object_id,
                      );

                      return (
                        <div
                          key={codebase.object_id}
                          className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50"
                        >
                          <Checkbox
                            id={`industry-codebase-${codebase.object_id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCodebases([
                                  ...selectedCodebases,
                                  codebase.object_id,
                                ]);
                              } else {
                                setSelectedCodebases(
                                  selectedCodebases.filter(
                                    (id) => id !== codebase.object_id,
                                  ),
                                );
                              }
                            }}
                          />
                          <Label
                            htmlFor={`industry-codebase-${codebase.object_id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div>
                              <div className="font-medium">
                                {codebase.codebase_name}
                              </div>
                              {codebase.codebase_description && (
                                <div className="text-xs text-muted-foreground">
                                  {codebase.codebase_description}
                                </div>
                              )}
                            </div>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleCancelCopyTemplate}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmCopyTemplate}
                  disabled={isCreating || codebases.length === 0}
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating template...
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Use Template
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </>
  );
}
