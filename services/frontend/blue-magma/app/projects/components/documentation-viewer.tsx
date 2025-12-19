"use client";

/**
 * FRONTEND MOCKUP COMPONENT
 * This component is a mockup showing how the documentation should be displayed
 * when a project is in ACTIVE mode. It demonstrates:
 * - Two-column layout (content + evidence)
 * - Independent scrolling for each column
 * - Support for general documentation pages
 * - Support for control pages with specific formatting
 *
 * This is NOT production code - it's a design mockup to visualize the UX.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Link2, CheckCircle2, ChevronRight, ChevronDown, X, Calendar, FileIcon, CheckIcon, AlertCircle, Database, Code, FileJson } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { SOC2_MOCKUP_STRUCTURE, type MockDocumentPage, type MockEvidence, type MockEvidenceData, type MockEvidenceRequest, type MockAuditorReview } from "./soc2-mockup-data";

interface DocumentationViewerProps {
  isActive: boolean;
}

/**
 * MOCKUP: Control Page Component
 * Displays a control with specific formatting:
 * - Title
 * - Description
 * - Linked Policies
 * - Relevance to Project
 * - Evidence on the right
 */
function ControlPageMockup({ page }: { page: MockDocumentPage }) {
  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50">Control</Badge>
          <h2 className="text-2xl font-bold">{page.title}</h2>
        </div>
        {page.description && (
          <p className="text-sm text-muted-foreground">{page.description}</p>
        )}
      </div>

      <Separator />

      {/* Linked Policies Section - Near Top */}
      {page.linkedPolicies && page.linkedPolicies.length > 0 && (
        <>
          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Linked Policies
            </h3>
            <div className="space-y-2">
              {page.linkedPolicies.map((policy, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">{policy}</span>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Main Content */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{page.content}</ReactMarkdown>
      </div>

      {/* Relevance Section */}
      {page.relevance && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Why This Control Matters to Our Project</h3>
            <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg text-sm border border-amber-200 dark:border-amber-800">
              <p>{page.relevance}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * MOCKUP: General Documentation Page Component
 * Displays general documentation with markdown content
 */
function GeneralDocPageMockup({ page }: { page: MockDocumentPage }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50">Documentation</Badge>
          <h2 className="text-2xl font-bold">{page.title}</h2>
        </div>
        {page.description && (
          <p className="text-sm text-muted-foreground">{page.description}</p>
        )}
      </div>

      <Separator />

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{page.content}</ReactMarkdown>
      </div>
    </div>
  );
}

/**
 * MOCKUP: Evidence Detail Modal Component
 * Shows detailed information about a piece of evidence
 */
function EvidenceDetailModal({
  evidence,
  isOpen,
  onClose,
}: {
  evidence: MockEvidence | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!evidence) return null;

  const getReviewColor = (review: string) => {
    switch (review) {
      case "relevant":
        return "bg-green-50 text-green-700 border-green-200";
      case "insufficient":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "irrelevant":
        return "bg-red-50 text-red-700 border-red-200";
      case "outdated":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getQueryTypeIcon = (queryType: string) => {
    switch (queryType) {
      case "rag":
        return <FileText className="h-4 w-4" />;
      case "sql":
        return <Database className="h-4 w-4" />;
      case "mongo":
        return <FileJson className="h-4 w-4" />;
      case "document":
        return <FileIcon className="h-4 w-4" />;
      default:
        return <Code className="h-4 w-4" />;
    }
  };

  const renderEvidenceData = (data: MockEvidenceData | undefined) => {
    if (!data) {
      return (
        <div className="bg-muted p-4 rounded text-sm text-muted-foreground">
          No evidence data available
        </div>
      );
    }
    switch (data.type) {
      case "quote":
        return (
          <div className="bg-muted p-4 rounded border-l-4 border-blue-500 whitespace-pre-wrap text-sm font-mono">
            {data.content}
          </div>
        );
      case "json":
        return (
          <div className="bg-muted p-4 rounded text-sm font-mono overflow-x-auto">
            <pre>{JSON.stringify(data.content, null, 2)}</pre>
          </div>
        );
      case "table":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted">
                  {data.headers.map((header, idx) => (
                    <th key={idx} className="border p-2 text-left font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b hover:bg-muted/50">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="border p-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "chat":
        return (
          <div className="space-y-2 bg-muted p-4 rounded max-h-96 overflow-y-auto">
            {data.messages.map((msg, idx) => (
              <div key={idx} className="text-sm">
                <div className="font-medium text-xs text-muted-foreground">
                  {msg.speaker} • {msg.timestamp}
                </div>
                <div className="text-sm mt-1 bg-background p-2 rounded">
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
        );
      case "logs":
        return (
          <div className="space-y-1 bg-muted p-4 rounded max-h-96 overflow-y-auto font-mono text-xs">
            {data.entries.map((entry, idx) => (
              <div
                key={idx}
                className={`${
                  entry.level === "WARN"
                    ? "text-yellow-700"
                    : entry.level === "ERROR"
                      ? "text-red-700"
                      : "text-gray-700"
                }`}
              >
                <span className="text-muted-foreground">[{entry.timestamp}]</span>{" "}
                <span className="font-medium">{entry.level}</span> {entry.message}
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileIcon className="h-5 w-5" />
            {evidence.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Evidence Data - First */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Evidence Data</p>
            {renderEvidenceData(evidence.data)}
          </div>

          <Separator />

          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Type</p>
              <Badge variant="outline" className="capitalize">
                {evidence.type}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Date Collected</p>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                {new Date(evidence.date).toLocaleDateString()}
              </div>
            </div>
          </div>

          <Separator />

          {/* Relevance */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Why This Is Relevant</p>
            <p className="text-sm bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
              {evidence.relevance}
            </p>
          </div>

          <Separator />

          {/* Sources */}
          {evidence.sources && evidence.sources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Sources ({evidence.sources.length})</p>
              <div className="space-y-2">
                {evidence.sources.map((source) => (
                  <div key={source.sourceId} className="bg-muted p-3 rounded border text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      {getQueryTypeIcon(source.queryType)}
                      <span className="font-medium capitalize">{source.queryType}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono break-all">{source.query}</p>
                    <p className="text-xs text-muted-foreground">ID: {source.sourceId}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Auditor Reviews */}
          {evidence.auditorReviews && evidence.auditorReviews.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Auditor Reviews ({evidence.auditorReviews.length})</p>
              <div className="space-y-3">
                {evidence.auditorReviews.map((review) => (
                  <div key={review.id} className={`p-3 rounded border ${getReviewColor(review.status)}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium text-sm">
                          {review.auditorName}
                          <span className="text-xs ml-2 opacity-75">
                            ({review.auditorType === "ai" ? "AI Auditor" : "Human Auditor"})
                          </span>
                        </p>
                        <p className="text-xs opacity-75">{new Date(review.date).toLocaleDateString()}</p>
                      </div>
                      <Badge className="capitalize">{review.status}</Badge>
                    </div>
                    <p className="text-sm">{review.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * MOCKUP: Evidence Request Modal Component
 * Allows users to fulfill evidence requests by:
 * 1. Uploading evidence
 * 2. Configuring an agent to collect evidence
 * 3. Messaging someone to get the evidence
 */
function EvidenceRequestModal({ request, isOpen, onClose }: { request: MockEvidenceRequest | null; isOpen: boolean; onClose: () => void }) {
  const [action, setAction] = useState<"upload" | "agent" | "message" | null>(null);

  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            Fulfill Evidence Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Request Details */}
          <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Reason</p>
              <p className="text-sm font-medium">{request.reason}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Compliance Impact</p>
              <p className="text-sm">{request.complianceImpact}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Requested by {request.requestedBy} on {new Date(request.date).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Action Selection */}
          {!action ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">How would you like to fulfill this request?</p>

              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4 text-left"
                onClick={() => setAction("upload")}
              >
                <div className="flex items-start gap-3 w-full">
                  <FileIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Upload Evidence</p>
                    <p className="text-xs text-muted-foreground">Upload a file or document that fulfills this request</p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4 text-left"
                onClick={() => setAction("agent")}
              >
                <div className="flex items-start gap-3 w-full">
                  <Code className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Configure Agent</p>
                    <p className="text-xs text-muted-foreground">Set up an automated agent to collect this evidence</p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4 text-left"
                onClick={() => setAction("message")}
              >
                <div className="flex items-start gap-3 w-full">
                  <FileText className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Message Someone</p>
                    <p className="text-xs text-muted-foreground">Send a message to request this evidence from a team member</p>
                  </div>
                </div>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAction(null)}
                className="mb-2"
              >
                ← Back to options
              </Button>

              {action === "upload" && (
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div>
                    <p className="font-medium text-sm mb-2">Upload Evidence File</p>
                    <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-8 text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors">
                      <FileIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Click to upload or drag and drop</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">PDF, DOC, JSON, CSV, or image files</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description (optional)</label>
                    <textarea
                      placeholder="Add any notes about this evidence..."
                      className="w-full mt-2 p-2 border rounded text-sm"
                      rows={3}
                    />
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">Upload Evidence</Button>
                </div>
              )}

              {action === "agent" && (
                <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div>
                    <label className="text-sm font-medium">Select Agent Type</label>
                    <select className="w-full mt-2 p-2 border rounded text-sm">
                      <option>-- Choose an agent --</option>
                      <option>RAG Query Agent</option>
                      <option>Database Query Agent</option>
                      <option>API Integration Agent</option>
                      <option>Log Analysis Agent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Agent Configuration</label>
                    <textarea
                      placeholder="Describe what the agent should look for or how it should collect this evidence..."
                      className="w-full mt-2 p-2 border rounded text-sm font-mono text-xs"
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-purple-600 hover:bg-purple-700">Configure Agent</Button>
                    <Button variant="outline" className="flex-1">Preview Query</Button>
                  </div>
                </div>
              )}

              {action === "message" && (
                <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div>
                    <label className="text-sm font-medium">Send Message To</label>
                    <input
                      type="text"
                      placeholder="Enter email or team member name"
                      className="w-full mt-2 p-2 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Message</label>
                    <textarea
                      placeholder={`Hi,\n\nWe need the following evidence for our compliance audit:\n\n${request.reason}\n\nPlease provide this by [date].\n\nThank you!`}
                      className="w-full mt-2 p-2 border rounded text-sm"
                      rows={5}
                    />
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700">Send Message</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * MOCKUP: Evidence Panel Component
 * Shows evidence items associated with a document page
 * Each evidence item can be clicked to view details
 * Also displays evidence requests from auditors
 */
function EvidencePanelMockup({ evidence, evidenceRequests = [] }: { evidence: MockEvidence[]; evidenceRequests?: MockEvidenceRequest[] }) {
  const [selectedEvidence, setSelectedEvidence] = useState<MockEvidence | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<MockEvidenceRequest | null>(null);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "policy":
        return "bg-blue-50 text-blue-700";
      case "configuration":
        return "bg-purple-50 text-purple-700";
      case "review":
        return "bg-green-50 text-green-700";
      case "log":
        return "bg-orange-50 text-orange-700";
      case "report":
        return "bg-indigo-50 text-indigo-700";
      case "procedure":
        return "bg-pink-50 text-pink-700";
      default:
        return "bg-gray-50 text-gray-700";
    }
  };

  const getReviewIcon = (review: string) => {
    switch (review) {
      case "relevant":
        return <CheckIcon className="h-4 w-4 text-green-600" />;
      case "insufficient":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "irrelevant":
        return <X className="h-4 w-4 text-red-600" />;
      case "outdated":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default:
        return null;
    }
  };

  const getLatestAuditorReview = (reviews: MockAuditorReview[]) => {
    if (!reviews || reviews.length === 0) return null;
    return reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  return (
    <>
      <div className="space-y-3">
        <div className="sticky top-0 bg-background z-10 pb-2">
          <h3 className="font-semibold text-sm">Evidence ({evidence.length})</h3>
          <p className="text-xs text-muted-foreground">Click to view details</p>
        </div>

        {/* Evidence Requests Section - At Top */}
        {evidenceRequests && evidenceRequests.length > 0 && (
          <div className="space-y-2 pb-3 border-b">
            {evidenceRequests.map((request) => (
              <Card
                key={request.id}
                className="border-amber-200 bg-amber-50 dark:bg-amber-950 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                onClick={() => setSelectedRequest(request)}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        <p className="font-medium text-sm text-amber-900 dark:text-amber-100">
                          {request.reason}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <Calendar className="h-3 w-3" />
                    <span>Requested {new Date(request.date).toLocaleDateString()}</span>
                  </div>

                  <div className="text-xs text-amber-800 dark:text-amber-200 bg-white dark:bg-amber-900/30 p-2 rounded border border-amber-200 dark:border-amber-700">
                    <p className="font-medium mb-1">Compliance Impact:</p>
                    <p>{request.complianceImpact}</p>
                  </div>

                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-medium">Requested by:</span> {request.requestedBy}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {evidence.map((item) => {
            const latestReview = getLatestAuditorReview(item.auditorReviews);
            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedEvidence(item)}
              >
                <CardContent className="p-3 space-y-2">
                  {/* Name and Type */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.name}</p>
                      <Badge variant="outline" className={`text-xs mt-1 ${getTypeColor(item.type)}`}>
                        {item.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {latestReview && getReviewIcon(latestReview.status)}
                    </div>
                  </div>

                  {/* Date and Source Count */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{item.sources?.length || 0} source{item.sources?.length !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Relevance */}
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.relevance}
                  </p>

                  {/* Latest Auditor Review Status */}
                  {latestReview && (
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {latestReview.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by {latestReview.auditorType === "ai" ? "AI" : latestReview.auditorName.split(" ")[0]}
                        </span>
                      </div>
                      <span className="text-xs text-blue-600 font-medium">View Details →</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <EvidenceDetailModal
        evidence={selectedEvidence}
        isOpen={!!selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />

      <EvidenceRequestModal
        request={selectedRequest}
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </>
  );
}

/**
 * MOCKUP: Navigation Tree Component
 * Shows the document hierarchy for navigation
 */
function DocumentTreeMockup({
  pages,
  selectedId,
  onSelect,
  level = 0,
}: {
  pages: MockDocumentPage[];
  selectedId: string;
  onSelect: (page: MockDocumentPage) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["soc2_overview", "cc_controls", "cc6_section"]));

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  return (
    <div className="space-y-1">
      {pages.map((page) => (
        <div key={page.id}>
          <div
            onClick={() => {
              onSelect(page);
              if (page.children?.length) {
                toggleExpanded(page.id);
              }
            }}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors cursor-pointer flex items-center gap-2 ${
              selectedId === page.id
                ? "bg-primary text-primary-foreground font-medium"
                : "hover:bg-muted"
            }`}
            style={{ paddingLeft: `${12 + level * 16}px` }}
          >
            {page.children?.length ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(page.id);
                }}
                className="p-0 cursor-pointer flex-shrink-0"
              >
                {expanded.has(page.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            ) : (
              <div className="w-4 flex-shrink-0" />
            )}
            <span className="truncate">{page.title}</span>
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {page.evidenceRequests && page.evidenceRequests.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {page.evidenceRequests.length}
                </Badge>
              )}
              {page.type === "control" && (
                <Badge variant="outline" className="text-xs">Control</Badge>
              )}
            </div>
          </div>

          {page.children?.length && expanded.has(page.id) && (
            <DocumentTreeMockup
              pages={page.children}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * MOCKUP: Main Documentation Viewer
 * Two-column layout with independent scrolling
 * Left: Document content (general or control page)
 * Right: Evidence items
 */
export function DocumentationViewerMockup({ isActive }: DocumentationViewerProps) {
  const [selectedPage, setSelectedPage] = useState<MockDocumentPage>(SOC2_MOCKUP_STRUCTURE[0]);

  if (!isActive) return null;

  return (
    <div className="w-full h-full bg-background flex flex-col">

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Left Sidebar: Navigation Tree */}
        <div className="w-64 border rounded-lg p-4 bg-card overflow-y-auto flex-shrink-0">
          <h3 className="font-semibold text-sm mb-4">Documentation</h3>
          <DocumentTreeMockup
            pages={SOC2_MOCKUP_STRUCTURE}
            selectedId={selectedPage.id}
            onSelect={setSelectedPage}
          />
        </div>

        {/* Center Column: Document Content */}
        <div className="flex-1 overflow-y-auto border rounded-lg p-6 bg-card">
          {selectedPage.type === "control" ? (
            <ControlPageMockup page={selectedPage} />
          ) : (
            <GeneralDocPageMockup page={selectedPage} />
          )}
        </div>

        {/* Right Column: Evidence (Wider - 40% of remaining space) */}
        <div className="w-[500px] overflow-y-auto border rounded-lg p-4 bg-card flex-shrink-0">
          <EvidencePanelMockup evidence={selectedPage.evidence} evidenceRequests={selectedPage.evidenceRequests} />
        </div>
      </div>
    </div>
  );
}

