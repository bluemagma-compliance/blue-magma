"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Clock, FileText, Loader2, Shield, Flame, AlertTriangle } from "lucide-react";
import type { Evidence, EvidenceRequest, RelatedPageSummary } from "../types";
import type { AuditorDetail } from "../actions";

interface EvidencePanelProps {
  evidence?: Evidence[];
  evidenceRequests?: EvidenceRequest[];
  selectedEvidenceRequestId?: string | null;
		  documentAuditors?: AuditorDetail[];
		  isDocumentAuditorsLoading?: boolean;
		  documentAuditorsError?: string | null;
		  relatedPages?: RelatedPageSummary[];
		  onSelectRelatedPage?: (pageId: string) => void;
		  // The backing document page id so we can reset the default tab when
		  // navigation changes.
		  pageId?: string;
}

export function EvidencePanel({
  evidence = [],
  evidenceRequests = [],
  selectedEvidenceRequestId,
		  documentAuditors = [],
		  isDocumentAuditorsLoading = false,
		  documentAuditorsError,
		  relatedPages = [],
		  onSelectRelatedPage,
		  pageId,
}: EvidencePanelProps) {
	  const [activeTab, setActiveTab] = useState<"combined" | "assessment" | "related">("combined");

  // NOTE: Previously, evidence and requests were shown in separate tabs.
  // We now combine them into a single column to match the desired UX,
  // with orange request cards stacked above blue evidence cards.

  // Auto-switch to the combined tab and highlight the selected request
  useEffect(() => {
    if (selectedEvidenceRequestId && evidenceRequests.length > 0) {
      const requestExists = evidenceRequests.some((r) => r.object_id === selectedEvidenceRequestId);
      if (requestExists) {
        setActiveTab("combined");
      }
    }
  }, [selectedEvidenceRequestId, evidenceRequests]);

		  const combinedItems = [
	    ...evidenceRequests.map((request) => ({ type: "request" as const, request })),
	    ...evidence.map((item) => ({ type: "evidence" as const, item })),
	  ];

	  const totalEvidenceItems = evidence.length + evidenceRequests.length;
	  const totalAssessmentRequirements = (documentAuditors || []).reduce(
	    (sum, auditor) => sum + (auditor.instructions?.requirements?.length || 0),
	    0
	  );
	  const hasAssessmentObjectives = totalAssessmentRequirements > 0;
		  const hasRelatedPages = (relatedPages || []).length > 0;

		  // Default the active tab per document selection:
		  // - Evidence & Requests if there are any evidence/request items
		  // - otherwise Assessment Objectives if there are any
		  // - otherwise Related Pages if there are any
		  // - finally fall back to Evidence & Requests (empty state)
		  useEffect(() => {
		    if (!pageId) {
		      return;
		    }
		    if (totalEvidenceItems > 0) {
		      setActiveTab("combined");
		    } else if (hasAssessmentObjectives) {
		      setActiveTab("assessment");
		    } else if (hasRelatedPages) {
		      setActiveTab("related");
		    } else {
		      setActiveTab("combined");
		    }
		  }, [pageId, totalEvidenceItems, hasAssessmentObjectives, hasRelatedPages]);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "complete":
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "overdue":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

	  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "complete":
      case "completed":
        return "default" as const;
      case "pending":
        return "secondary" as const;
      case "overdue":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

	  const renderPageKindBadge = (page: RelatedPageSummary) => {
	    const kind = page.page_kind;
	    if (page.is_control || kind === "control") {
	      return (
	        <Badge variant="outline" className="text-xs flex items-center gap-1">
	          <Shield className="h-3 w-3" />
	          Control
	        </Badge>
	      );
	    }
	    if (kind === "risk") {
	      return (
	        <Badge variant="outline" className="text-xs flex items-center gap-1">
	          <AlertTriangle className="h-3 w-3" />
	          Risk
	        </Badge>
	      );
	    }
	    if (kind === "threat") {
	      return (
	        <Badge variant="outline" className="text-xs flex items-center gap-1">
	          <Flame className="h-3 w-3" />
	          Threat
	        </Badge>
	      );
	    }
	    return null;
	  };

	  const renderRelatedSection = (label: string, items: RelatedPageSummary[]) => {
	    if (!items || items.length === 0) return null;
	    return (
	      <div className="space-y-2">
	        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
	          {label}
	        </div>
	        <div className="space-y-2">
	          {items.map((page) => {
	            const clickable = !!onSelectRelatedPage;
	            return (
	              <Card
	                key={page.object_id}
	                className={`border border-muted/40 bg-muted/40 ${clickable ? "cursor-pointer hover:bg-muted" : ""}`}
	                onClick={() => clickable && onSelectRelatedPage?.(page.object_id)}
	              >
	                <CardHeader className="py-2.5 px-3">
	                  <div className="flex items-start justify-between gap-2">
	                    <div className="flex-1 min-w-0">
	                      <div className="flex items-center gap-2 mb-1">
	                        {renderPageKindBadge(page)}
	                        {page.status && (
	                          <Badge variant="outline" className="text-[10px] capitalize">
	                            {page.status}
	                          </Badge>
	                        )}
	                      </div>
	                      <CardTitle className="text-sm font-medium truncate">
	                        {page.title}
	                      </CardTitle>
	                      {page.relation_type && (
	                        <p className="text-[11px] text-muted-foreground mt-0.5">
	                          {page.relation_type.replace(/_/g, " ")}
	                        </p>
	                      )}
	                    </div>
	                  </div>
	                </CardHeader>
	              </Card>
	            );
	          })}
	        </div>
	      </div>
	    );
	  };

	  const renderRelatedPagesTab = () => {
	    if (!hasRelatedPages) {
	      return (
	        <Card>
	          <CardContent className="py-6 text-sm text-muted-foreground">
	            No related pages are linked to this document yet.
	          </CardContent>
	        </Card>
	      );
	    }

	    const controls: RelatedPageSummary[] = [];
	    const risks: RelatedPageSummary[] = [];
	    const threats: RelatedPageSummary[] = [];
	    const others: RelatedPageSummary[] = [];

	    for (const page of relatedPages) {
	      if (page.is_control || page.page_kind === "control") {
	        controls.push(page);
	      } else if (page.page_kind === "risk") {
	        risks.push(page);
	      } else if (page.page_kind === "threat") {
	        threats.push(page);
	      } else {
	        others.push(page);
	      }
	    }

	    return (
	      <div className="space-y-4">
	        {renderRelatedSection("Related controls", controls)}
	        {renderRelatedSection("Related risks", risks)}
	        {renderRelatedSection("Related threats", threats)}
	        {renderRelatedSection("Other related pages", others)}
	      </div>
	    );
	  };

	  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
	        <TabsList className="grid w-full grid-cols-3 h-auto">
	          <TabsTrigger
	            value="combined"
	            className="h-auto whitespace-normal text-xs leading-tight px-2 py-1"
	          >
	            Evidence &amp; Requests ({totalEvidenceItems})
	          </TabsTrigger>
	          <TabsTrigger
	            value="assessment"
	            className="h-auto whitespace-normal text-xs leading-tight px-2 py-1"
	          >
	            Assessment Objectives
		            {hasAssessmentObjectives && (
		              <span className="ml-1 text-xs text-muted-foreground">
		                ({totalAssessmentRequirements})
		              </span>
		            )}
		          </TabsTrigger>
		          <TabsTrigger
		            value="related"
		            className="h-auto whitespace-normal text-xs leading-tight px-2 py-1"
		          >
		            Related Pages
		            {hasRelatedPages && (
		              <span className="ml-1 text-xs text-muted-foreground">
		                ({relatedPages.length})
		              </span>
		            )}
		          </TabsTrigger>
	        </TabsList>

	        {/* Combined Evidence & Requests column - requests first, then evidence */}
        <TabsContent value="combined" className="space-y-3">
          {combinedItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No evidence or requests are linked to this document yet
              </CardContent>
            </Card>
          ) : (
            combinedItems.map((entry) => {
              if (entry.type === "request") {
                const request = entry.request;
                const isSelected = selectedEvidenceRequestId === request.object_id;
                const baseClasses =
                  "border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-50";
                const selectedClasses = "border-2 border-amber-500";

                return (
                  <Card
                    key={request.object_id}
                    className={`${baseClasses} ${isSelected ? selectedClasses : ""}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-200">
                              Request
                            </span>
                            <Badge variant={getStatusBadgeVariant(request.status)}>
                              <span className="flex items-center gap-1">
                                {getStatusIcon(request.status)}
                                <span className="capitalize">{request.status}</span>
                              </span>
                            </Badge>
                          </div>
                          <CardTitle
                            className="text-sm font-medium break-words line-clamp-2"
                          >
                            {request.title}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    {(request.description || request.due_date) && (
                      <CardContent className="space-y-1 text-xs text-amber-900/80 dark:text-amber-100/80">
                        {request.description && (
                          <p className="whitespace-pre-wrap break-words">
                            {request.description}
                          </p>
                        )}
                        {request.due_date && (
                          <p className="text-[11px] text-amber-900/70 dark:text-amber-100/70">
                            Due: {new Date(request.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              }

              const item = entry.item;
              return (
                <Card
                  key={item.object_id}
                  className="border border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] uppercase tracking-wide font-semibold text-blue-700 dark:text-blue-200">
                            Evidence
                          </span>
                        </div>
                        <CardTitle className="text-sm font-medium truncate">
                          {item.name}
                        </CardTitle>
                        <p className="text-xs text-blue-900/70 dark:text-blue-100/70 mt-1">
                          Type: {item.value_type}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {item.collection ? (
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-blue-900/75 dark:text-blue-100/80">
                          Collection: {item.collection.name}
                        </div>
                        <div className="bg-blue-100/70 dark:bg-blue-900/40 p-2 rounded text-xs max-h-32 overflow-y-auto">
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(item.collection.content, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : item.value ? (
                      <div className="bg-blue-100/70 dark:bg-blue-900/40 p-2 rounded text-xs max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words">
                          {typeof item.value === "string"
                            ? item.value
                            : JSON.stringify(item.value, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-xs text-blue-900/70 dark:text-blue-100/70">
                        No value provided
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

	        {/* Assessment Objectives tab driven by document-scoped auditors and their requirements */}
	        <TabsContent value="assessment" className="space-y-3">
	          {isDocumentAuditorsLoading ? (
	            <Card>
	              <CardContent className="py-6 flex items-center justify-center text-sm text-muted-foreground">
	                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
	                Loading assessment objectives...
	              </CardContent>
	            </Card>
	          ) : documentAuditorsError ? (
	            <Card>
	              <CardContent className="py-6 text-sm text-red-600 dark:text-red-400">
	                {documentAuditorsError}
	              </CardContent>
	            </Card>
	          ) : !hasAssessmentObjectives ? (
	            <Card>
	              <CardContent className="py-6 text-sm text-muted-foreground">
	                No AI auditors are currently linked to this document.
	              </CardContent>
	            </Card>
	          ) : (
	            documentAuditors.map((auditor) => {
	              const requirements = auditor.instructions?.requirements || [];
	              if (requirements.length === 0) return null;

	              return (
	                <Card
	                  key={auditor.object_id}
	                  className="border border-stone-200 bg-stone-50 text-stone-900 dark:bg-stone-950 dark:border-stone-700 dark:text-stone-50"
	                >
	                  <CardHeader className="pb-3">
	                    <div className="flex items-start justify-between gap-2">
	                      <div className="flex-1 min-w-0">
	                        <div className="flex items-center gap-2 mb-1">
	                          <span className="text-[11px] uppercase tracking-wide font-semibold text-stone-700 dark:text-stone-200">
	                            Auditor
	                          </span>
	                          {typeof auditor.instructions?.passing_score === "number" && (
	                            <Badge className="bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800 text-[11px]">
	                              Passing score: {auditor.instructions.passing_score}
	                            </Badge>
	                          )}
	                        </div>
	                        <CardTitle className="text-sm font-medium truncate">
	                          {auditor.name}
	                        </CardTitle>
	                        {auditor.description && (
	                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
	                            {auditor.description}
	                          </p>
	                        )}
	                      </div>
	                    </div>
	                  </CardHeader>
	                  <CardContent className="space-y-3">
	                    {requirements.map((req) => (
	                      <div
	                        key={req.id}
	                        className="rounded-md border border-stone-200/80 bg-stone-50/60 dark:border-stone-700/80 dark:bg-stone-900/40 p-2.5"
	                      >
	                        <div className="text-xs font-semibold text-stone-900 dark:text-stone-50 mb-1">
	                          {req.title}
	                        </div>
	                        {req.description && (
	                          <p className="text-[11px] text-stone-800/80 dark:text-stone-100/80 whitespace-pre-wrap">
	                            {req.description}
	                          </p>
	                        )}
	                        {req.context && (
	                          <p className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">
	                            Context: {req.context}
	                          </p>
	                        )}
	                        <div className="mt-2 grid gap-2 md:grid-cols-2">
	                          {Array.isArray(req.success_criteria) && req.success_criteria.length > 0 && (
	                            <div>
	                              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-0.5">
	                                Success criteria
	                              </div>
	                              <ul className="list-disc ml-4 space-y-0.5 text-[11px] text-stone-900/85 dark:text-stone-100/85">
	                                {req.success_criteria.map((c, idx) => (
	                                  <li key={idx}>{c}</li>
	                                ))}
	                              </ul>
	                            </div>
	                          )}
	                          {Array.isArray(req.failure_criteria) && req.failure_criteria.length > 0 && (
	                            <div>
	                              <div className="text-[11px] font-semibold text-red-700 dark:text-red-300 mb-0.5">
	                                Failure criteria
	                              </div>
	                              <ul className="list-disc ml-4 space-y-0.5 text-[11px] text-stone-900/85 dark:text-stone-100/85">
	                                {req.failure_criteria.map((c, idx) => (
	                                  <li key={idx}>{c}</li>
	                                ))}
	                              </ul>
	                            </div>
	                          )}
	                        </div>
	                      </div>
	                    ))}
	                  </CardContent>
	                </Card>
	              );
	            })
	          )}
	        </TabsContent>
	        {/* Related Pages tab driven by related_pages returned from full document view */}
	        <TabsContent value="related" className="space-y-3">
	          {renderRelatedPagesTab()}
	        </TabsContent>
      </Tabs>
    </div>
  );
}
