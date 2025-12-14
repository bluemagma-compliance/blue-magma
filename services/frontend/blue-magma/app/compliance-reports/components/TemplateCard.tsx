import React from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Edit,
  Pause,
  Copy,
  Download,
  Play,
  EllipsisVertical,
  File,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type {
  UiReportTemplate,
  UiReportTemplateWithReports,
} from "@/types/api";
import { useRouter } from "next/navigation";

interface Section {
  object_id: string;
  name: string;
  description?: string;
  rules?: Rule[];
}

interface Rule {
  object_id: string;
  name: string;
  rule?: string;
}

interface TemplateCardProps {
  template: UiReportTemplateWithReports;
  expandedTemplates: Set<string>;
  toggleTemplate: (templateId: string) => void;
  handleUseTemplate: (template: UiReportTemplate) => void;
  handleDeactivateTemplate: (template: UiReportTemplate) => void;
  handleCopyTemplate: (template: UiReportTemplate) => void;
  handleExportTemplate: (template: UiReportTemplate) => void;
  handleEditTemplate: (template: UiReportTemplate) => void;
  handleDeleteTemplate: (templateId: string) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  expandedTemplates,
  toggleTemplate,
  handleUseTemplate,
  handleDeactivateTemplate,
  handleCopyTemplate,
  handleExportTemplate,
  handleEditTemplate,
  handleDeleteTemplate,
}) => {
  const router = useRouter();
  // const isExpanded = expandedTemplates.has(template.object_id);

  const handleViewReports = (template: UiReportTemplate) => {
    // Store template data in sessionStorage to pass to the overview page
    sessionStorage.setItem("templateData", JSON.stringify(template));
    router.push(`/compliance-reports/${template.object_id}`);
  };

  return (
    <Card key={template.object_id}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{template.name}</CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs cursor-pointer"
                  onClick={() => handleEditTemplate(template)}
                >
                  {(template.sections || []).length} section
                  {(template.sections || []).length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                {template.description}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!template.active && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUseTemplate(template)}
              >
                <Play className="h-4 w-4 mr-1" />
                Activate
              </Button>
            )}
            <div className="relative">
              <Button size="sm" onClick={() => handleViewReports(template)}>
                <File className="h-4 w-4 mr-1" />
                Reports
              </Button>
              {template.reports.length > 0 && (
                <div className="absolute -top-2 -right-2 text-xs h-5 w-5 flex items-center justify-center bg-white rounded-full border-gray-300 border-[1px] shadow-sm pointer-events-none">
                  {template.reports.length}
                </div>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="left" align="start">
                <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopyTemplate(template)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportTemplate(template)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
                {template.active && (
                  <DropdownMenuItem
                    onClick={() => handleDeactivateTemplate(template)}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Deactivate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => handleDeleteTemplate(template.object_id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
