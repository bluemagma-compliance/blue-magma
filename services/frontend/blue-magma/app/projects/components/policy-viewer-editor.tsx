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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Edit2, Eye, Code, Loader2, X, ArrowUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { updatePolicy, type PolicyTemplateResponse } from "../actions";

interface PolicyViewerEditorProps {
  projectId: string;
  policy: PolicyTemplateResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectStatus?: string;
  onPolicySaved?: () => void;
}

export function PolicyViewerEditor({
  projectId,
  policy,
  open,
  onOpenChange,
  projectStatus,
  onPolicySaved,
}: PolicyViewerEditorProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Security");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isOnHold = projectStatus === "on-hold";

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setShowScrollTop(scrollTop > 300);
  };

  const scrollToTop = () => {
    const scrollableDiv = document.querySelector("[data-policy-content]");
    if (scrollableDiv) {
      scrollableDiv.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (policy) {
      setTitle(policy.title);
      setDescription(policy.description);
      setCategory(policy.category);
      setContent(policy.content);
      setIsEditMode(false);
      setError(null);
    }
  }, [policy, open]);

  const handleSavePolicy = async () => {
    if (!policy) return;

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const policyData = {
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        category,
      };

      const result = await updatePolicy(projectId, policy.id, policyData);

      if (result.success) {
        toast.success("Policy updated successfully");
        setIsEditMode(false);
        onOpenChange(false);
        onPolicySaved?.();
      } else {
        setError(result.error || "Failed to save policy");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPDF = () => {
    if (!policy) return;

    try {
      // Create a new window for printing
      const printWindow = window.open("", "", "width=800,height=600");
      if (!printWindow) {
        toast.error("Failed to open print window. Please check your browser settings.");
        return;
      }

      // Write HTML content to the print window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${policy.title}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 40px;
                line-height: 1.6;
                color: #333;
              }
              h1 {
                margin-bottom: 10px;
                font-size: 24px;
              }
              .description {
                color: #666;
                margin-bottom: 20px;
                font-size: 14px;
              }
              .metadata {
                margin-bottom: 20px;
                padding-bottom: 20px;
                border-bottom: 1px solid #ddd;
              }
              .category {
                display: inline-block;
                background: #f0f0f0;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                margin-right: 10px;
              }
              .date {
                font-size: 12px;
                color: #999;
              }
              .content {
                white-space: pre-wrap;
                word-wrap: break-word;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                margin-top: 20px;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 10px;
                color: #999;
              }
              @media print {
                body { padding: 20px; }
              }
            </style>
          </head>
          <body>
            <h1>${policy.title}</h1>
            <div class="description">${policy.description}</div>
            <div class="metadata">
              <span class="category">${policy.category}</span>
              <span class="date">Last updated ${new Date(policy.updatedAt).toLocaleDateString()}</span>
            </div>
            <div class="content">${policy.content}</div>
            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            </div>
          </body>
        </html>
      `);

      printWindow.document.close();

      // Wait for content to load, then trigger print
      setTimeout(() => {
        printWindow.print();
        toast.success("Print dialog opened. Select 'Save as PDF' to export.");
      }, 250);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast.error("Failed to export PDF. Please try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-7xl !max-h-[95vh] !h-[95vh] !w-[98vw] flex flex-col p-0">
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {isEditMode ? "Edit Policy" : policy?.title || "View Policy"}
        </DialogTitle>
        {policy ? (
          <div className="flex flex-col h-full overflow-hidden" data-policy-content onScroll={handleScroll}>
            {/* Top Action Bar */}
            <div className="flex items-center justify-between gap-3 px-6 py-2 border-b sticky top-0 bg-background z-10 flex-shrink-0">
              <div className="flex-1 min-w-0">
                {isEditMode ? (
                  <h2 className="text-lg font-semibold truncate">Edit Policy</h2>
                ) : (
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold truncate">{title}</h2>
                    <p className="text-xs text-muted-foreground truncate">{description}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={isSubmitting}
                  title="Export policy as PDF"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>

                {isEditMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditMode(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSavePolicy}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    {isOnHold && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditMode(true)}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Metadata Bar */}
            {!isEditMode && (
              <div className="flex items-center gap-2 px-6 py-1.5 flex-shrink-0">
                <Badge variant="outline" className="text-xs py-0 px-1.5">{category}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(policy.updatedAt).toLocaleDateString()}
                </span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mx-6 mb-4 flex-shrink-0">
                {error}
              </div>
            )}

            {/* Edit Mode Fields */}
            {isEditMode && (
              <div className="space-y-2 px-6 py-2 border-b flex-shrink-0">
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Policy title"
                    disabled={isSubmitting}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Policy description"
                    disabled={isSubmitting}
                    rows={1}
                    className="text-sm resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Security">Security</SelectItem>
                      <SelectItem value="Privacy">Privacy</SelectItem>
                      <SelectItem value="Compliance">Compliance</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="HR">HR</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Content Section */}
            {isEditMode ? (
              <div className="flex-1 flex flex-col px-6 py-2 min-h-0">
                <Label className="flex-shrink-0">Content</Label>
                <Tabs defaultValue="edit" className="w-full flex flex-col flex-1 min-h-0 gap-0">
                  <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                    <TabsTrigger value="edit">
                      <Code className="h-4 w-4 mr-2" />
                      Edit
                    </TabsTrigger>
                    <TabsTrigger value="preview">
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="edit" className="flex-1 flex flex-col mt-0 min-h-0 p-0 pt-2 data-[state=inactive]:hidden">
                    <Textarea
                      placeholder="Enter policy content in markdown format..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      disabled={isSubmitting}
                      className="font-mono text-sm flex-1 resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Markdown formatting is supported
                    </p>
                  </TabsContent>

                  <TabsContent value="preview" className="flex-1 overflow-y-auto mt-0 p-0 min-h-0 pt-2 data-[state=inactive]:hidden">
                    <div className="rounded-lg border p-6 bg-muted/30 prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-6 py-2">
                <div className="rounded-lg border p-6 bg-muted/30 prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{content}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Footer with Return to Top Button */}
            <div className="flex items-center justify-between px-6 py-2 border-t sticky bottom-0 bg-background flex-shrink-0">
              {showScrollTop && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToTop}
                  className="gap-2"
                >
                  <ArrowUp className="h-4 w-4" />
                  Return to Top
                </Button>
              )}
              <div className="flex-1" />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

