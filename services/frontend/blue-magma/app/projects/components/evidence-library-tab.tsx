"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, Loader2 } from "lucide-react";
import { getProjectEvidence, getProjectEvidenceRequests } from "../actions";
import type { Evidence, EvidenceRequest } from "../types";

interface EvidenceLibraryTabProps {
  projectId: string;
}

type InnerTab = "evidence" | "requests";

export function EvidenceLibraryTab({ projectId }: EvidenceLibraryTabProps) {
  const [activeTab, setActiveTab] = useState<InnerTab>("evidence");
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [evidenceRequests, setEvidenceRequests] = useState<EvidenceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<EvidenceRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [projectEvidence, projectEvidenceRequests] = await Promise.all([
          getProjectEvidence(projectId),
          getProjectEvidenceRequests(projectId),
        ]);

        if (!cancelled) {
          setEvidence(projectEvidence || []);
          setEvidenceRequests(projectEvidenceRequests || []);
        }
      } catch (err) {
        console.error("❌ [EvidenceLibraryTab] Failed to load evidence library:", err);
        if (!cancelled) {
          setError("Failed to load evidence library data");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const renderValueSummary = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable value]";
    }
  };

  const renderStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    const normalized = status.toLowerCase();

    let className = "text-xs font-normal";
    if (normalized.includes("completed") || normalized.includes("resolved")) {
      className += " text-green-700 border-green-200 bg-green-50";
    } else if (normalized.includes("overdue") || normalized.includes("late")) {
      className += " text-red-700 border-red-200 bg-red-50";
    } else if (normalized.includes("in-progress") || normalized.includes("open")) {
      className += " text-blue-700 border-blue-200 bg-blue-50";
    } else {
      className += " text-gray-700 border-gray-200 bg-gray-50";
    }

    return (
      <Badge variant="outline" className={className}>
        {status}
      </Badge>
    );
  };

  const renderDueDate = (dueDate?: string) => {
    if (!dueDate) return <span className="text-xs text-muted-foreground">No due date</span>;
    const date = new Date(dueDate);
    if (Number.isNaN(date.getTime())) {
      return <span className="text-xs text-muted-foreground">{dueDate}</span>;
    }
    return (
      <span className="text-xs text-muted-foreground">{date.toLocaleDateString()}</span>
    );
  };

  const closeDetailModal = () => {
    setIsDetailOpen(false);
    setSelectedRequest(null);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading evidence library…</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-10">
          <div className="flex flex-col items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      );
    }

    return (
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InnerTab)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-auto mb-4">
          <TabsTrigger
            value="evidence"
            className="h-auto whitespace-normal text-xs leading-tight px-2 py-1"
          >
            Evidence ({evidence.length})
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="h-auto whitespace-normal text-xs leading-tight px-2 py-1"
          >
            Evidence Requests ({evidenceRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="evidence" className="mt-0">
          {evidence.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No evidence has been collected for this project yet.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Name</TableHead>
                    <TableHead className="w-[15%]">Type</TableHead>
                    <TableHead className="w-[20%]">Collection</TableHead>
                    <TableHead className="w-[35%]">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidence.map((item) => (
                    <TableRow key={item.object_id} className="align-top">
                      <TableCell className="font-medium max-w-[260px] truncate" title={item.name}>
                        {item.name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.value_type || "Unknown"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {item.collection?.name || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px]">
                        <div className="line-clamp-2" title={renderValueSummary(item.value)}>
                          {renderValueSummary(item.value) || ""}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          {evidenceRequests.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No evidence requests have been created for this project yet.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Title</TableHead>
                    <TableHead className="w-[15%]">Status</TableHead>
                    <TableHead className="w-[20%]">Due Date</TableHead>
                    <TableHead className="w-[30%]">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evidenceRequests.map((request) => (
                    <TableRow
                      key={request.object_id}
                      className="align-top cursor-pointer hover:bg-muted/40"
                      onClick={() => {
                        setSelectedRequest(request);
                        setIsDetailOpen(true);
                      }}
                    >
                      <TableCell className="font-medium max-w-[260px] truncate" title={request.title}>
                        {request.title}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        {renderStatusBadge(request.status)}
                      </TableCell>
                      <TableCell>{renderDueDate(request.due_date)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px]">
                        <div className="line-clamp-2" title={request.description}>
                          {request.description || ""}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Library</CardTitle>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>

	      {/* Evidence Request detail modal when clicking a request row */}
	      <Dialog
	        open={isDetailOpen}
	        onOpenChange={(open) => {
	          if (!open) {
	            closeDetailModal();
	          } else {
	            setIsDetailOpen(true);
	          }
	        }}
	      >
	        {selectedRequest && (
	          <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <span className="text-base sm:text-lg font-semibold break-words">
                  {selectedRequest.title}
                </span>
                <span>{renderStatusBadge(selectedRequest.status)}</span>
              </DialogTitle>
            </DialogHeader>

	            <div className="space-y-4 mt-2">
	              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
	                <div>
	                  <div className="text-xs font-semibold text-muted-foreground mb-1">
	                    Due date
	                  </div>
	                  {renderDueDate(selectedRequest.due_date)}
	                </div>
	              </div>

	              <div>
	                <div className="text-xs font-semibold text-muted-foreground mb-1">
	                  Request details
	                </div>
	                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
	                  {selectedRequest.description || "No description provided for this request."}
	                </p>
	              </div>

              <div className="pt-2 border-t text-[11px] text-muted-foreground break-all">
                <span className="font-mono">ID: {selectedRequest.object_id}</span>
              </div>
            </div>

            <DialogFooter className="mt-4 flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={closeDetailModal}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
