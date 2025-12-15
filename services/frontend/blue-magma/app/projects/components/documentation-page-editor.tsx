"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { DocumentPage } from "../types";

interface DocumentationPageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page?: DocumentPage | null; // null for new page, DocumentPage for editing
  parentPage?: DocumentPage | null; // For creating child pages
  onSave: (pageData: {
    title: string;
    description?: string;
    content: string;
    parentId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function DocumentationPageEditor({
  open,
  onOpenChange,
  page,
  parentPage,
  onSave,
}: DocumentationPageEditorProps) {
  const [title, setTitle] = useState(page?.title || "");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState(page?.content || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // Update form when page changes
  useState(() => {
    if (page) {
      setTitle(page.title);
      setContent(page.content);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Page title is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        content: content.trim(),
        parentId: parentPage?.id,
      });

      if (result.success) {
        // Reset form
        setTitle("");
        setDescription("");
        setContent("");
        setActiveTab("edit");
        onOpenChange(false);
      } else {
        setError(result.error || "Failed to save page");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      if (!newOpen) {
        // Reset form when closing
        setTitle(page?.title || "");
        setDescription("");
        setContent(page?.content || "");
        setError(null);
        setActiveTab("edit");
      }
      onOpenChange(newOpen);
    }
  };

  const insertMarkdownSyntax = (syntax: string) => {
    setContent((prev) => prev + syntax);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {page ? "Edit Template Page" : parentPage ? `New Template Page under "${parentPage.title}"` : "New Template Page"}
            </DialogTitle>
            <DialogDescription>
              Define the structure and format that AI agents will use to generate this documentation page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Info Banner */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Template Editor:</strong> Define the structure and content format. AI agents will use this template to generate actual documentation.
              </p>
            </div>

            {/* Title Field */}
            <div className="space-y-2">
              <Label htmlFor="page-title">
                Template Page Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="page-title"
                placeholder="e.g., Security Guidelines"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="page-description">Description (Optional)</Label>
              <Input
                id="page-description"
                placeholder="Brief description of what this template page should contain..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Content Field with Tabs */}
            <div className="space-y-2">
              <Label>Template Content (Markdown)</Label>
              <p className="text-xs text-muted-foreground">
                Define the structure, sections, and format. Use placeholders like {"{"}data{"}"} where AI should fill in information.
              </p>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Edit Template
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-2">
                  {/* Markdown Toolbar */}
                  <div className="flex flex-wrap gap-1 p-2 bg-muted rounded-md">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("\n# Heading 1\n")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      H1
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("\n## Heading 2\n")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      H2
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("\n### Heading 3\n")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      H3
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("**bold text**")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      <strong>B</strong>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("*italic text*")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      <em>I</em>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("\n- List item\n- List item\n")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      List
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("\n1. Item\n2. Item\n")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      1. 2. 3.
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      Table
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("\n```\ncode block\n```\n")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      Code
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => insertMarkdownSyntax("[link text](https://example.com)")}
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      Link
                    </Button>
                  </div>

                  <Textarea
                    id="page-content"
                    placeholder="Define your template structure in markdown...

Example template:
# {Page Title}

## Overview
{Brief overview of this section}

## Key Requirements
- {Requirement 1}
- {Requirement 2}
- {Requirement 3}

## Implementation Details
{Detailed implementation information}

| Component | Description | Status |
|-----------|-------------|--------|
| {Component 1} | {Description} | {Status} |

## Code Examples
```
{Code example}
```"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={isSubmitting}
                    rows={15}
                    className="font-mono text-sm"
                  />
                </TabsContent>

                <TabsContent value="preview">
                  <div className="border rounded-md p-4 min-h-[400px] bg-background">
                    <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-100">
                      <strong>Template Preview:</strong> This shows how the template structure will look. AI agents will replace placeholders with actual data.
                    </div>
                    {content.trim() ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No template content to preview. Switch to Edit Template tab to add content.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
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
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Template...
                </>
              ) : (
                page ? "Save Template" : "Create Template Page"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

