"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar,
  Target,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getAuditorById, type AuditorDetail } from "../actions";

interface ViewAuditorDetailsDialogProps {
  projectId: string;
  auditorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewAuditorDetailsDialog({
  projectId,
  auditorId,
  open,
  onOpenChange,
}: ViewAuditorDetailsDialogProps) {
  const [auditor, setAuditor] = useState<AuditorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAuditorDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAuditorById(projectId, auditorId);
      setAuditor(data);
    } catch (error) {
      console.error("Error loading auditor details:", error);
      toast.error("Failed to load auditor details");
    } finally {
      setIsLoading(false);
    }
  }, [auditorId, projectId]);

  useEffect(() => {
    if (open && auditorId) {
      loadAuditorDetails();
    }
  }, [open, auditorId, loadAuditorDetails]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] w-full sm:!max-w-[1400px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Auditor Details</DialogTitle>
          <DialogDescription>
            View what this auditor checks and how it evaluates compliance
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !auditor ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load auditor details</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6">
              {/* Header Info */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{auditor.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {auditor.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Schedule:</span>
                    <span className="font-mono">
                      {auditor.schedule || "Manual"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Passing Score:</span>
                    <span className="font-semibold">
                      {auditor.instructions.passing_score}/100
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      auditor.is_active
                        ? "text-green-600 border-green-200 bg-green-50"
                        : "text-gray-600 border-gray-200 bg-gray-50"
                    }
                  >
                    {auditor.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Requirements */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-semibold">
                    Compliance Requirements ({auditor.instructions.requirements.length})
                  </h4>
                </div>

                <div className="space-y-6">
                  {auditor.instructions.requirements.map((req, index) => (
                    <div
                      key={req.id}
                      className="border rounded-lg p-4 space-y-3 bg-muted/30"
                    >
                      {/* Requirement Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{index + 1}
                            </span>
                            <h5 className="font-semibold">{req.title}</h5>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {req.description}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          Weight: {req.weight}%
                        </Badge>
                      </div>

                      {/* Context */}
                      {req.context && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                            📋 Context
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {req.context}
                          </p>
                        </div>
                      )}

                      {/* Success Criteria */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">
                            Success Criteria
                          </span>
                        </div>
                        <ul className="space-y-1.5 ml-6">
                          {req.success_criteria.map((criteria, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <span className="text-green-600 mt-0.5">✓</span>
                              <span>{criteria}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Failure Criteria */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-900 dark:text-red-100">
                            Failure Criteria
                          </span>
                        </div>
                        <ul className="space-y-1.5 ml-6">
                          {req.failure_criteria.map((criteria, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <span className="text-red-600 mt-0.5">✗</span>
                              <span>{criteria}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Stats */}
              <Separator />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {auditor.instructions.requirements.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Requirements</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {auditor.instructions.requirements.reduce(
                      (sum, req) => sum + req.weight,
                      0
                    )}
                    %
                  </p>
                  <p className="text-xs text-muted-foreground">Total Weight</p>
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {auditor.instructions.passing_score}
                  </p>
                  <p className="text-xs text-muted-foreground">Passing Score</p>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

