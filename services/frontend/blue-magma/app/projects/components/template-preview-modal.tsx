"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, BookOpen } from "lucide-react";
import { getProjectTemplateById } from "@/app/projects/actions";
import type { ProjectTemplateDetailResponse } from "@/app/projects/actions";

interface TemplatePreviewModalProps {
  templateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: (templateId: string) => void;
}

export function TemplatePreviewModal({
  templateId,
  open,
  onOpenChange,
  onUseTemplate,
}: TemplatePreviewModalProps) {
  const [template, setTemplate] = useState<ProjectTemplateDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setIsLoading(true);
    setError(null);
    try {
      console.log("[TemplatePreviewModal] Loading template:", templateId);
      const data = await getProjectTemplateById(templateId);
      console.log("[TemplatePreviewModal] Received data:", data);
      if (data) {
        setTemplate(data);
      } else {
        console.warn("[TemplatePreviewModal] No data returned from API");
        setError("Template not found");
      }
    } catch (err) {
      console.error("[TemplatePreviewModal] Failed to load template:", err);
      setError("Failed to load template details");
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (open && templateId) {
      loadTemplate();
    }
  }, [open, templateId, loadTemplate]);

  const handleClose = () => {
    setTemplate(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {isLoading ? "Loading Template..." : error ? "Error" : template?.name || "Template Preview"}
          </DialogTitle>
          {!isLoading && !error && template && (
            <DialogDescription>{template.description}</DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading template...</span>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        ) : template ? (
          <>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{template.category}</Badge>
              {template.active && <Badge variant="default">Active</Badge>}
            </div>

            <Tabs defaultValue="documentation" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="documentation">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Documentation ({template.documentation.length})
                </TabsTrigger>
                <TabsTrigger value="policies">
                  <FileText className="h-4 w-4 mr-2" />
                  Policies ({template.policies.length})
                </TabsTrigger>
              </TabsList>

              {/* Documentation Tab */}
              <TabsContent value="documentation" className="space-y-3">
                {template.documentation.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    No documentation pages
                  </div>
                ) : (
                  <div className="space-y-2">
                    {template.documentation.map((page) => (
                      <div
                        key={page.id}
                        className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{page.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {page.content.substring(0, 100)}...
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Policies Tab */}
              <TabsContent value="policies" className="space-y-3">
                {template.policies.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    No policies included
                  </div>
                ) : (
                  <div className="space-y-2">
                    {template.policies.map((policy) => (
                      <div
                        key={policy.id}
                        className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{policy.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {policy.description}
                            </p>
                          </div>
                          <Badge variant="outline" className="flex-shrink-0">
                            {policy.category}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => onUseTemplate(template.id)}>
                Use This Template
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

