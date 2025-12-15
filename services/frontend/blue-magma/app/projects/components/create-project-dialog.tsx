"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Check, Code, ListChecks } from "lucide-react";
import { getProjectTemplates } from "@/app/projects/actions";
import type { ProjectTemplateResponse } from "@/app/projects/actions";
import Link from "next/link";
import { TemplatePreviewModal } from "./template-preview-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useIsFreePlan } from "@/hooks/useFreePlan";


interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (projectData: {
    name: string;
    description?: string;
    template_id?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}


// Treat HIPAA and SOC 2 templates as "coming soon" so they are visible
// in the project creation modal but cannot be selected yet.
function isComingSoonTemplate(template: ProjectTemplateResponse): boolean {
	  const name = template.name?.toLowerCase?.() ?? "";
	  const category = template.category?.toLowerCase?.() ?? "";

	  return (
	    name.includes("hipaa") ||
	    name.includes("soc 2") ||
	    name.includes("soc2") ||
	    category.includes("hipaa") ||
	    category.includes("soc 2") ||
	    category.includes("soc2")
	  );
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
}: CreateProjectDialogProps) {
  // Step state: "template-selection" or "project-details"
  const [step, setStep] = useState<"template-selection" | "project-details">("template-selection");

  // Template state
  const [templates, setTemplates] = useState<ProjectTemplateResponse[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null | undefined>(undefined);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Project details state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isFreePlan } = useIsFreePlan();

  // Data sources state - REMOVED: Data sources are no longer part of project creation

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      loadTemplates();
      // Reset state when dialog opens
      setStep("template-selection");
      setSelectedTemplateId(undefined);
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  // Pre-fill form when template is selected and we move to step 2
  useEffect(() => {
    if (step === "project-details" && selectedTemplateId) {
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      if (selectedTemplate && !name) {
        // Only pre-fill if form is empty
        setName(selectedTemplate.name);
        setDescription(selectedTemplate.description || "");
      }
    }
  }, [step, selectedTemplateId, templates, name]);



  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await getProjectTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // REMOVED: All data source related functions have been removed

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onCreateProject({
        name: name.trim(),
        description: description.trim() || undefined,
        template_id: selectedTemplateId || undefined,
      });

      if (result.success) {
        // Reset form
        resetForm();
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to create project");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep("template-selection");
    setName("");
    setDescription("");
    setSelectedTemplateId(null);
    setError(null);
    setShowPreview(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      if (!newOpen) {
        resetForm();
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {step === "template-selection" ? (
          // STEP 1: Template Selection
          <>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Choose a template to get started with pre-configured documentation and policies, or start with a custom project.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-muted-foreground mb-4">No templates available</p>
                  <Button
                    onClick={() => {
                      if (isFreePlan) {
                        window.location.href = "/subscription";
                        return;
                      }
                      setStep("project-details");
                    }}
                    className="w-full"
                  >
                    Start Custom Project
                  </Button>
                </div>
              ) : (
                <>
	              {/* Templates Grid */}
	              <div className="grid gap-3 md:grid-cols-2">
	                {templates.map((template) => {
	                  const comingSoon = isComingSoonTemplate(template);
	                  const isDisabledTemplate = isFreePlan || comingSoon;

	                  return (
	                    <div
	                      key={template.id}
	                      className={`transition-all relative ${
	                        selectedTemplateId === template.id
	                          ? "ring-2 ring-primary"
	                          : ""
	                      } ${
	                        isDisabledTemplate
	                          ? "opacity-60 cursor-not-allowed"
	                          : "cursor-pointer"
	                      }`}
	                      onClick={() => {
	                        if (isFreePlan) {
	                          window.location.href = "/subscription";
	                          return;
	                        }

	                        if (comingSoon) {
	                          // HIPAA and SOC 2 templates are visible but not selectable yet.
	                          return;
	                        }

	                        setSelectedTemplateId(template.id);
	                      }}
	                    >
	                      <Card
	                        className={`transition-all h-full ${
	                          selectedTemplateId === template.id
	                            ? "bg-primary/5 border-primary shadow-lg"
	                            : "hover:shadow-md hover:border-primary/50"
	                        }`}
	                      >
	                        {/* Selection Checkmark */}
	                        {selectedTemplateId === template.id && !isDisabledTemplate && (
	                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
	                            <Check className="h-4 w-4" />
	                          </div>
	                        )}

	                        <CardHeader className="pb-3">
	                          <div className="flex items-start justify-between gap-2">
	                            <div className="flex-1">
	                              <CardTitle className="text-base">{template.name}</CardTitle>
	                              <CardDescription className="text-xs mt-1">
	                                {template.description}
	                              </CardDescription>
	                            </div>
	                            {isFreePlan && (
	                              <Badge
	                                variant="outline"
	                                className="text-[10px] uppercase tracking-wide bg-blue-50 text-blue-700 border-blue-200"
	                              >
	                                Upgrade
	                              </Badge>
	                            )}
	                          </div>
	                          <div className="flex gap-2 mt-2">
	                            <Badge variant="secondary" className="text-xs">
	                              {template.category}
	                            </Badge>
	                            {comingSoon ? (
	                              <Badge
	                                variant="outline"
	                                className="text-[10px] uppercase tracking-wide bg-yellow-50 text-yellow-700 border-yellow-200"
	                              >
	                                Coming soon
	                              </Badge>
	                            ) : (
	                              template.active && (
	                                <Badge variant="default" className="text-xs">
	                                  Active
	                                </Badge>
	                              )
	                            )}
	                          </div>
	                        </CardHeader>
	                        <CardContent className="pt-0">
	                          <div className="text-xs text-muted-foreground mb-3">
	                            Created {new Date(template.createdAt).toLocaleDateString()}
	                          </div>
	                          <Button
	                            variant="outline"
	                            size="sm"
	                            className="w-full"
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              setPreviewTemplateId(template.id);
	                              setShowPreview(true);
	                            }}
	                          >
	                            Preview
	                          </Button>
	                        </CardContent>
	                      </Card>
	                    </div>
	                  );
	                })}

                    {/* Start Custom Project Card */}
                    <div
                      className={`transition-all relative ${
                        selectedTemplateId === null ? "ring-2 ring-primary" : ""
                      } ${
                        isFreePlan ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      }`}
                      onClick={() => {
                        if (isFreePlan) {
                          window.location.href = "/subscription";
                          return;
                        }
                        setSelectedTemplateId(null);
                      }}
                    >
                      <Card
                        className={`transition-all h-full flex flex-col items-center justify-center min-h-[200px] ${
                          selectedTemplateId === null
                            ? "bg-primary/5 border-primary shadow-lg"
                            : "hover:shadow-md hover:border-primary/50"
                        }`}
                      >
                        {/* Selection Checkmark */}
                        {selectedTemplateId === null && !isFreePlan && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="h-4 w-4" />
                          </div>
                        )}

                        <CardContent className="flex flex-col items-center justify-center text-center py-8">
                          <Code className="h-8 w-8 text-muted-foreground mb-3" />
                          <CardTitle className="text-base mb-2">Start Custom Project</CardTitle>
                          <CardDescription className="text-xs">
                            Create a project from scratch with your own configuration
                          </CardDescription>
                          {isFreePlan && (
                            <div className="mt-3">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase tracking-wide bg-blue-50 text-blue-700 border-blue-200"
                              >
                                Upgrade
                              </Badge>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* SCF Configurator Card */}
                    <Link href="/scf" className="block">
                      <Card className="transition-all h-full flex flex-col items-center justify-center min-h-[200px] hover:shadow-md hover:border-primary/50">
                        <CardContent className="flex flex-col items-center justify-center text-center py-8">
                          <ListChecks className="h-8 w-8 text-muted-foreground mb-3" />
                          <CardTitle className="text-base mb-2">SCF Configurator</CardTitle>
                          <CardDescription className="text-xs">
                            Browse and select SCF controls before creating a project
                          </CardDescription>
                        </CardContent>
                      </Card>
                    </Link>

                  </div>

                  {/* Next Button */}
                  <div className="pt-4 border-t flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleOpenChange(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => setStep("project-details")}
                      disabled={selectedTemplateId === undefined}
                    >
                      Next
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          // STEP 2: Project Details
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setStep("template-selection")}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <DialogTitle>
                    {selectedTemplateId ? "Create Project from Template" : "Create Custom Project"}
                  </DialogTitle>
                  <DialogDescription>
                    {selectedTemplateId
                      ? "Configure your project details. Documentation and policies will be created from the template."
                      : "Set up your custom compliance project."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Selected Template Info */}
            {selectedTemplateId && templates.length > 0 && (
              <div className="mb-4 p-3 bg-muted rounded-lg border">
                {(() => {
                  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
                  return selectedTemplate ? (
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{selectedTemplate.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{selectedTemplate.description}</p>
                      </div>
                      <Badge variant="default" className="text-xs">
                        {selectedTemplate.category}
                      </Badge>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <div className="space-y-4 py-4">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Project Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., HIPAA Compliance Project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Description Field */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the purpose and scope of this project..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("template-selection")}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      {/* Template Preview Modal */}
      <TemplatePreviewModal
        templateId={previewTemplateId}
        open={showPreview}
        onOpenChange={setShowPreview}
        onUseTemplate={(templateId) => {
          setSelectedTemplateId(templateId);
          setShowPreview(false);
          setStep("project-details");
        }}
      />
    </Dialog>
  );
}

