"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  Edit,
  Calendar,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAuditorsPaginated,
  getAuditReportsPaginated,
  runAuditor,
  deleteAuditor,
  type Auditor,
  type AuditReport,
  type AuditReportListResponse,
} from "../actions";
import { EditAuditorDialog } from "./edit-auditor-dialog";
import { ViewAuditorDetailsDialog } from "./view-auditor-details-dialog";
import { CreateAuditorDialog } from "./create-auditor-dialog";

interface AIAuditsTabProps {
  projectId: string;
  onRefreshAudits?: () => void;
  refreshTrigger?: number;
}

// Helper function to convert cron schedule to readable text
function getScheduleLabel(schedule: string): string {
  if (!schedule) return "Manual";

  const scheduleMap: Record<string, string> = {
    "0 0 * * *": "Daily at midnight",
    "0 0 * * 1": "Weekly on Monday",
    "0 0 1 * *": "Monthly on 1st",
    "0 0 1 */3 *": "Quarterly",
  };

  return scheduleMap[schedule] || schedule;
}

const AUDITORS_PAGE_SIZE = 20;
const REPORTS_PAGE_SIZE = 10;

export function AIAuditsTab({ projectId, onRefreshAudits, refreshTrigger }: AIAuditsTabProps) {
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [auditorTotal, setAuditorTotal] = useState(0);
  const [auditorPages, setAuditorPages] = useState(0);
  const [auditorPage, setAuditorPage] = useState(0);
  const [expandedAuditorId, setExpandedAuditorId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, AuditReportListResponse>>({});
  const [reportPage, setReportPage] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReports, setIsLoadingReports] = useState<Record<string, boolean>>({});
  const [isRunning, setIsRunning] = useState<Record<string, boolean>>({});
  const [editingAuditor, setEditingAuditor] = useState<Auditor | null>(null);
  const [viewingAuditorId, setViewingAuditorId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingAuditorId, setDeletingAuditorId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

	  const loadAuditors = useCallback(async () => {
	    try {
	      console.log("📋 [AIAuditsTab.loadAuditors] Starting to load auditors for projectId:", projectId);
	      setIsLoading(true);
	      const offset = auditorPage * AUDITORS_PAGE_SIZE;
	      const data = await getAuditorsPaginated(projectId, {
	        limit: AUDITORS_PAGE_SIZE,
	        offset,
	      });
	      console.log(
	        "📋 [AIAuditsTab.loadAuditors] Successfully loaded",
	        data.items.length,
	        "auditors (page)",
	        auditorPage,
	        "of",
	        data.pages,
	      );
	      setAuditors(data.items);
	      setAuditorTotal(data.total ?? data.items.length);
	      setAuditorPages(data.pages ?? 0);
	      console.log("📋 [AIAuditsTab.loadAuditors] Auditors state updated");
	    } catch (error) {
	      console.error("❌ [AIAuditsTab.loadAuditors] Error loading auditors:", error);
	      toast.error("Failed to load auditors");
	    } finally {
	      setIsLoading(false);
	    }
	  }, [projectId, auditorPage]);

  // Load auditors on mount
  useEffect(() => {
    console.log("📋 [AIAuditsTab] Component mounted, loading auditors for projectId:", projectId);
    loadAuditors();
  }, [projectId, loadAuditors]);

  // Listen for refresh events from AI chat via refreshTrigger
  useEffect(() => {
    console.log("📋 [AIAuditsTab] refreshTrigger changed:", refreshTrigger);
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log("🔄 [AIAuditsTab] Refresh signal received (trigger:", refreshTrigger, "), reloading auditors...");
      loadAuditors();
    }
  }, [refreshTrigger, loadAuditors]);

	  const loadReports = async (auditorId: string, page: number = 0) => {
	    try {
	      setIsLoadingReports(prev => ({ ...prev, [auditorId]: true }));
	      const offset = page * REPORTS_PAGE_SIZE;
	      const data = await getAuditReportsPaginated(projectId, auditorId, {
	        limit: REPORTS_PAGE_SIZE,
	        offset,
	      });
	      setReports(prev => ({ ...prev, [auditorId]: data }));
	      setReportPage(prev => ({ ...prev, [auditorId]: page }));
	    } catch (error) {
	      console.error("Error loading reports:", error);
	      toast.error("Failed to load audit reports");
	    } finally {
	      setIsLoadingReports(prev => ({ ...prev, [auditorId]: false }));
	    }
	  };

	  const handleToggleExpand = async (auditorId: string) => {
	    if (expandedAuditorId === auditorId) {
	      setExpandedAuditorId(null);
	    } else {
	      setExpandedAuditorId(auditorId);
	      // Load first page of reports if not already loaded
	      if (!reports[auditorId]) {
	        await loadReports(auditorId, 0);
	      }
	    }
	  };

  const handleRunAuditor = async (auditorId: string) => {
    try {
      setIsRunning(prev => ({ ...prev, [auditorId]: true }));
      const result = await runAuditor(projectId, auditorId);
      if (result.success) {
        toast.success("Audit started successfully");
        // Reload auditors to get updated status
        await loadAuditors();
      } else {
        toast.error(result.error || "Failed to run audit");
      }
    } catch (error) {
      console.error("Error running auditor:", error);
      toast.error("Failed to run audit");
    } finally {
      setIsRunning(prev => ({ ...prev, [auditorId]: false }));
    }
  };

  const handleEditSuccess = () => {
    loadAuditors();
    setEditingAuditor(null);
  };

  const handleCreateSuccess = () => {
    loadAuditors();
    setIsCreating(false);
  };

  const handleDeleteAuditor = async (auditorId: string) => {
    try {
      setIsDeleting(true);
      const result = await deleteAuditor(projectId, auditorId);
      if (result.success) {
        toast.success("Auditor deleted successfully");
        setDeletingAuditorId(null);
        loadAuditors();
      } else {
        toast.error(result.error || "Failed to delete auditor");
      }
    } catch (error) {
      console.error("Error deleting auditor:", error);
      toast.error("Failed to delete auditor");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "passed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "text-xs font-normal";
    switch (status.toLowerCase()) {
      case "passed":
        return (
          <Badge variant="outline" className={`${baseClasses} text-green-600 border-green-200 bg-green-50`}>
            {getStatusIcon(status)}
            <span className="ml-1">Passed</span>
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className={`${baseClasses} text-red-600 border-red-200 bg-red-50`}>
            {getStatusIcon(status)}
            <span className="ml-1">Failed</span>
          </Badge>
        );
      case "running":
        return (
          <Badge variant="outline" className={`${baseClasses} text-blue-600 border-blue-200 bg-blue-50`}>
            {getStatusIcon(status)}
            <span className="ml-1">Running</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className={`${baseClasses} text-gray-600 border-gray-200 bg-gray-50`}>
            {getStatusIcon(status)}
            <span className="ml-1">{status}</span>
          </Badge>
        );
    }
  };

	  const totalAuditors = auditorTotal;
	  const auditorPageCount =
	    auditorPages || (totalAuditors > 0 ? Math.ceil(totalAuditors / AUDITORS_PAGE_SIZE) : 0);
	  const auditorFrom = totalAuditors === 0 ? 0 : auditorPage * AUDITORS_PAGE_SIZE + 1;
	  const auditorTo = totalAuditors === 0 ? 0 : auditorFrom + auditors.length - 1;

	  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

	  if (totalAuditors === 0) {
    return (
      <>
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h4 className="font-medium mb-2">No auditors yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create auditors to run compliance audits on this project.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Auditor
            </Button>
          </CardContent>
        </Card>

        {/* Create Auditor Dialog */}
        <CreateAuditorDialog
          projectId={projectId}
          open={isCreating}
          onOpenChange={setIsCreating}
          onSuccess={handleCreateSuccess}
        />
      </>
    );
  }

	  return (
	    <>
	      <div className="space-y-6">
        {/* Auditors List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Auditors</h3>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Auditor
            </Button>
          </div>

          <Card>
	            <div className="w-full overflow-x-auto">
	              <Table className="w-full">
	              <TableHeader>
	                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead className="w-[280px]">Name</TableHead>
	                  <TableHead>Status</TableHead>
	                  <TableHead>Schedule</TableHead>
	                  <TableHead>Last Run</TableHead>
	                  <TableHead>Runs</TableHead>
	                  <TableHead className="w-[100px]"></TableHead>
	                </TableRow>
	              </TableHeader>
	              <TableBody>
	                {auditors.map((auditor) => {
	                  const auditorReports = reports[auditor.object_id];
	                  const currentReportPage = reportPage[auditor.object_id] ?? 0;
	                  const items = auditorReports?.items ?? [];
	                  const reportTotal = auditorReports?.total ?? items.length;
	                  const reportPages =
	                    auditorReports?.pages ??
	                    (reportTotal > 0
	                      ? Math.ceil(reportTotal / REPORTS_PAGE_SIZE)
	                      : 0);
	                  const hasReports = items.length > 0;

	                  return (
	                    <React.Fragment key={auditor.object_id}>
	                      <TableRow
	                        className="cursor-pointer hover:bg-muted/50"
	                        onClick={() => handleToggleExpand(auditor.object_id)}
	                      >
	                        <TableCell>
	                          <Button
	                            variant="ghost"
	                            size="sm"
	                            className="h-6 w-6 p-0"
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              handleToggleExpand(auditor.object_id);
	                            }}
	                          >
	                            {expandedAuditorId === auditor.object_id ? (
	                              <ChevronDown className="h-4 w-4" />
	                            ) : (
	                              <ChevronRight className="h-4 w-4" />
	                            )}
	                          </Button>
	                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <div className="space-y-1">
                            <div className="font-medium truncate">{auditor.name}</div>
                            <div className="text-sm text-muted-foreground line-clamp-1 break-words">
                              {auditor.description}
                            </div>
                          </div>
                        </TableCell>
	                        <TableCell>
	                          {auditor.is_active ? (
	                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
	                              Active
	                            </Badge>
	                          ) : (
	                            <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">
	                              Inactive
	                            </Badge>
	                          )}
	                        </TableCell>
	                        <TableCell>
	                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
	                            <Calendar className="h-3 w-3" />
	                            {getScheduleLabel(auditor.schedule)}
	                          </div>
	                        </TableCell>
	                        <TableCell className="text-muted-foreground">
	                          {auditor.last_run_at
	                            ? new Date(auditor.last_run_at).toLocaleDateString()
	                            : "Never"}
	                        </TableCell>
	                        <TableCell>{auditor.run_count || 0}</TableCell>
	                        <TableCell>
	                          <div className="flex items-center gap-1">
	                            <Button
	                              variant="ghost"
	                              size="sm"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                handleRunAuditor(auditor.object_id);
	                              }}
	                              disabled={isRunning[auditor.object_id]}
	                              title="Run audit"
	                            >
	                              {isRunning[auditor.object_id] ? (
	                                <Loader2 className="h-4 w-4 animate-spin" />
	                              ) : (
	                                <Play className="h-4 w-4" />
	                              )}
	                            </Button>
	                            <Button
	                              variant="ghost"
	                              size="sm"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                setViewingAuditorId(auditor.object_id);
	                              }}
	                              title="View details"
	                            >
	                              <Eye className="h-4 w-4" />
	                            </Button>
	                            <Button
	                              variant="ghost"
	                              size="sm"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                setEditingAuditor(auditor);
	                              }}
	                              title="Edit auditor"
	                            >
	                              <Edit className="h-4 w-4" />
	                            </Button>
	                            <Button
	                              variant="ghost"
	                              size="sm"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                setDeletingAuditorId(auditor.object_id);
	                              }}
	                              title="Delete auditor"
	                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
	                            >
	                              <Trash2 className="h-4 w-4" />
	                            </Button>
	                          </div>
	                        </TableCell>
	                      </TableRow>

	                      {/* Expanded Reports Section */}
                      {expandedAuditorId === auditor.object_id && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-0">
                            <div className="p-4">
	                              {isLoadingReports[auditor.object_id] ? (
	                                <div className="flex items-center justify-center py-8">
	                                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
	                                </div>
	                              ) : !hasReports ? (
	                                <div className="text-center py-8 text-muted-foreground">
	                                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
	                                  <p className="text-sm">No audit reports yet</p>
	                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold mb-1">Audit Reports</h4>
	                                  <div className="w-full overflow-x-auto">
	                                    <Table className="w-full">
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Report #</TableHead>
                                          <TableHead>Status</TableHead>
                                          <TableHead>Score</TableHead>
                                          <TableHead>Date</TableHead>
                                          <TableHead>Duration</TableHead>
                                          <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {items.map((report, index) => (
                                          <TableRow key={report.object_id}>
                                            <TableCell className="font-medium">
                                              #{
                                                reportTotal -
                                                  (currentReportPage * REPORTS_PAGE_SIZE + index)
                                              }
                                            </TableCell>
                                            <TableCell>{getStatusBadge(report.status)}</TableCell>
                                            <TableCell className="font-medium">
                                              {report.score.toFixed(1)}/100
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {new Date(report.executed_at).toLocaleDateString()} at{" "}
                                              {new Date(report.executed_at).toLocaleTimeString()}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                              {report.duration}s
                                            </TableCell>
                                            <TableCell>
                                              <Button variant="ghost" size="sm">
                                                <Eye className="h-4 w-4" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
	                                  <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
	                                    <span>
	                                      {reportTotal === 0
	                                        ? "No reports"
	                                        : `Showing ${
	                                            currentReportPage * REPORTS_PAGE_SIZE + 1
	                                          }-${
	                                            currentReportPage * REPORTS_PAGE_SIZE +
	                                            items.length
	                                          } of ${reportTotal} reports`}
	                                    </span>
	                                    <div className="flex items-center gap-2">
	                                      <Button
	                                        variant="outline"
							                size="sm"
	                                        onClick={() => {
	                                          if (currentReportPage > 0) {
	                                            loadReports(auditor.object_id, currentReportPage - 1);
	                                          }
	                                        }}
	                                        disabled={currentReportPage === 0}
	                                      >
	                                        Previous
	                                      </Button>
	                                      <span>
	                                        Page {reportPages === 0 ? 1 : currentReportPage + 1} of{" "}
	                                        {reportPages || 1}
	                                      </span>
	                                      <Button
	                                        variant="outline"
							                size="sm"
	                                        onClick={() => {
	                                          if (reportPages === 0) return;
	                                          if (currentReportPage + 1 < reportPages) {
	                                            loadReports(auditor.object_id, currentReportPage + 1);
	                                          }
	                                        }}
	                                        disabled={reportPages === 0 || currentReportPage + 1 >= reportPages}
	                                      >
	                                        Next
	                                      </Button>
	                                    </div>
	                                  </div>
	                                </div>
	                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
	              <span>
	                {totalAuditors === 0
	                  ? "No auditors"
	                  : `Showing ${auditorFrom}-${auditorTo} of ${totalAuditors} auditors`}
	              </span>
	              <div className="flex items-center gap-2">
	                <Button
	                  variant="outline"
				                  size="sm"
	                  onClick={() => {
	                    if (auditorPage > 0) {
	                      setAuditorPage((prev) => Math.max(prev - 1, 0));
	                    }
	                  }}
	                  disabled={auditorPage === 0}
	                >
	                  Previous
	                </Button>
	                <span>
	                  Page {auditorPageCount === 0 ? 1 : auditorPage + 1} of {auditorPageCount || 1}
	                </span>
	                <Button
	                  variant="outline"
				                  size="sm"
	                  onClick={() => {
	                    if (auditorPageCount === 0) return;
	                    setAuditorPage((prev) =>
	                      prev + 1 < auditorPageCount ? prev + 1 : prev,
	                    );
	                  }}
	                  disabled={auditorPageCount === 0 || auditorPage + 1 >= auditorPageCount}
	                >
	                  Next
	                </Button>
	              </div>
	            </div>
	          </Card>
        </div>
      </div>

      {/* Edit Auditor Dialog */}
      {editingAuditor && (
        <EditAuditorDialog
          projectId={projectId}
          auditor={editingAuditor}
          open={!!editingAuditor}
          onOpenChange={(open) => !open && setEditingAuditor(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* View Auditor Details Dialog */}
      {viewingAuditorId && (
        <ViewAuditorDetailsDialog
          projectId={projectId}
          auditorId={viewingAuditorId}
          open={!!viewingAuditorId}
          onOpenChange={(open) => !open && setViewingAuditorId(null)}
        />
      )}

      {/* Create Auditor Dialog */}
      <CreateAuditorDialog
        projectId={projectId}
        open={isCreating}
        onOpenChange={setIsCreating}
        onSuccess={handleCreateSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAuditorId} onOpenChange={(open) => !open && setDeletingAuditorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Auditor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this auditor? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAuditorId && handleDeleteAuditor(deletingAuditorId)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

