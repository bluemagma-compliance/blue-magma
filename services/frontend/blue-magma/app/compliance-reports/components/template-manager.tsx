"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  getTemplates,
  deleteTemplate,
  getCodebases,
  updateTemplate,
} from "../template-actions";
import {
  type ReportTemplate,
  type Codebase,
  UiReportTemplateWithReports,
  UiReportTemplate,
} from "@/types/api";
import { CodebaseSelectionModal } from "./CodebaseSelectionModal";
import { TemplateCard } from "./TemplateCard";
import { getComplianceReports } from "../actions";

interface TemplateManagerProps {
  onTemplateCreated?: (template: UiReportTemplate) => void;
  onEditTemplate?: (template: UiReportTemplate) => void;
  onCreateTemplate?: () => void;
  onTemplateSaved?: () => number;
  hideHeader?: boolean;
  hideCreateButton?: boolean;
  externalSearchQuery?: string;
  onCopyTemplate?: (template: UiReportTemplate) => void;
  onExportTemplate?: (template: UiReportTemplate) => void;
}

export default function TemplateManager({
  onTemplateCreated,
  onEditTemplate,
  onCreateTemplate,
  onTemplateSaved,
  hideHeader = false,
  hideCreateButton = false,
  externalSearchQuery = "",
  onCopyTemplate,
  onExportTemplate,
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<UiReportTemplateWithReports[]>([]);
  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(
    new Set(),
  );

  // Codebase selection modal state
  const [isCodebaseModalOpen, setIsCodebaseModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<UiReportTemplate | null>(null);
  const [selectedCodebases, setSelectedCodebases] = useState<string[]>([]);
  const [isActivating, setIsActivating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  // Refresh templates when a template is saved from the editor
  useEffect(() => {
    if (onTemplateSaved) {
      const counter = onTemplateSaved();
      if (counter > 0) {
        loadData();
      }
    }
  }, [onTemplateSaved]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [templatesData, codebasesData, complianceReports] =
        await Promise.all([
          getTemplates(),
          getCodebases(),
          getComplianceReports(),
        ]);

      setTemplates(
        (templatesData || []).map((template) => ({
          ...template,
          reports: (complianceReports || []).filter(
            (report) => report.template_id === template.object_id,
          ),
        })),
      );
      setCodebases(codebasesData || []);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load templates and data");
      // Set empty arrays on error to prevent null reference errors
      setTemplates([]);
      setCodebases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate(templateId);

      setTemplates((templates || []).filter((t) => t.object_id !== templateId));
      toast.success("Template deleted successfully");
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template");
    }
  };

  const handleUseTemplate = (template: UiReportTemplate) => {
    // Open the codebase selection modal
    setSelectedTemplate(template);
    setSelectedCodebases(
      template.codebases?.map((cb) =>
        typeof cb === "string" ? cb : cb.object_id,
      ) || [],
    );
    setIsCodebaseModalOpen(true);
  };

  const handleConfirmUseTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setIsActivating(true);
      await updateTemplate(selectedTemplate.object_id, {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        active: true,
        codebases: selectedCodebases,
      });

      // Update the template in the list
      setTemplates(
        templates.map((t) =>
          t.object_id === selectedTemplate.object_id
            ? {
                ...t,
                active: true,
                codebases: selectedCodebases
                  .map((id) => codebases.find((cb) => cb.object_id === id))
                  .filter(Boolean) as Codebase[],
              }
            : t,
        ),
      );

      toast.success(
        "Template activated successfully! It will now appear in reports.",
      );
      setIsCodebaseModalOpen(false);
      setSelectedTemplate(null);
      setSelectedCodebases([]);
    } catch (error) {
      console.error("Failed to activate template:", error);
      toast.error("Failed to activate template");
    } finally {
      setIsActivating(false);
    }
  };

  const handleCancelUseTemplate = () => {
    setIsCodebaseModalOpen(false);
    setSelectedTemplate(null);
    setSelectedCodebases([]);
  };

  const handleDeactivateTemplate = async (template: UiReportTemplate) => {
    try {
      await updateTemplate(template.object_id, {
        name: template.name,
        description: template.description,
        active: false,
        codebases:
          template.codebases?.map((cb) =>
            typeof cb === "string" ? cb : cb.object_id,
          ) || [],
      });

      // Update the template in the list
      setTemplates(
        templates.map((t) =>
          t.object_id === template.object_id ? { ...t, active: false } : t,
        ),
      );

      toast.success(
        "Template deactivated successfully! It will no longer appear in reports.",
      );
    } catch (error) {
      console.error("Failed to deactivate template:", error);
      toast.error("Failed to deactivate template");
    }
  };

  const handleEditTemplate = (template: UiReportTemplate) => {
    onEditTemplate?.(template);
  };

  const handleCreateTemplate = () => {
    if (onCreateTemplate) {
      onCreateTemplate();
    }
  };

  const handleCopyTemplate = (template: UiReportTemplate) => {
    onCopyTemplate?.(template);
  };

  const handleExportTemplate = (template: UiReportTemplate) => {
    onExportTemplate?.(template);
  };

  const toggleTemplate = (templateId: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId);
    } else {
      newExpanded.add(templateId);
    }
    setExpandedTemplates(newExpanded);
  };

  // Use external search query when header is hidden, otherwise use local search
  const activeSearchQuery = hideHeader ? externalSearchQuery : searchQuery;
  const filteredTemplates = (templates || []).filter(
    (template) =>
      template.name.toLowerCase().includes(activeSearchQuery.toLowerCase()) ||
      template.description
        .toLowerCase()
        .includes(activeSearchQuery.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Conditional Header */}
      {!hideHeader && (
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-semibold">Template Management</h3>
            <p className="text-sm text-muted-foreground">
              Create and manage compliance report templates, sections, and rules
            </p>
          </div>
          {!hideCreateButton && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCreateTemplate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Conditional Search - only show if header is hidden (search moved to parent) */}
      {!hideHeader && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {filteredTemplates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {activeSearchQuery
                  ? `No templates match "${activeSearchQuery}"`
                  : "You haven't created any templates yet."}
              </p>
              {!activeSearchQuery && !hideCreateButton && (
                <Button onClick={handleCreateTemplate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredTemplates.map((template) => (
            <TemplateCard
              key={template.object_id}
              template={template}
              expandedTemplates={expandedTemplates}
              toggleTemplate={toggleTemplate}
              handleUseTemplate={handleUseTemplate}
              handleDeactivateTemplate={handleDeactivateTemplate}
              handleCopyTemplate={handleCopyTemplate}
              handleExportTemplate={handleExportTemplate}
              handleEditTemplate={handleEditTemplate}
              handleDeleteTemplate={handleDeleteTemplate}
            />
          ))
        )}
      </div>

      {/* Codebase Selection Modal */}
      <CodebaseSelectionModal
        isOpen={isCodebaseModalOpen}
        onOpenChange={setIsCodebaseModalOpen}
        codebases={codebases}
        selectedCodebases={selectedCodebases}
        setSelectedCodebases={setSelectedCodebases}
        isActivating={isActivating}
        onCancel={handleCancelUseTemplate}
        onConfirm={handleConfirmUseTemplate}
      />
    </div>
  );
}
