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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { createPolicy, updatePolicy, type PolicyTemplateResponse } from "../actions";

interface PolicyEditorProps {
  projectId: string;
  policy: PolicyTemplateResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const POLICY_CATEGORIES = ["Security", "Privacy", "Compliance", "Operations", "Legal"];

export function PolicyEditor({
  projectId,
  policy,
  open,
  onOpenChange,
  onSave,
}: PolicyEditorProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Security");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (policy) {
      setTitle(policy.title);
      setDescription(policy.description);
      setCategory(policy.category);
      setContent(policy.content);
    } else {
      setTitle("");
      setDescription("");
      setCategory("Security");
      setContent("");
    }
    setError(null);
  }, [policy, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Policy title is required");
      return;
    }

    if (!content.trim()) {
      setError("Policy content is required");
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

      let result;
      if (policy) {
        result = await updatePolicy(projectId, policy.id, policyData);
        if (result.success) {
          toast.success("Policy updated successfully");
        }
      } else {
        result = await createPolicy(projectId, policyData);
        if (result.success) {
          toast.success("Policy created successfully");
        }
      }

      if (result.success) {
        onOpenChange(false);
        onSave();
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

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {policy ? "Edit Policy" : "Create New Policy"}
            </DialogTitle>
            <DialogDescription>
              {policy
                ? "Update the policy details and content"
                : "Create a new policy for this project"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title Field */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Policy Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Data Access Control Policy"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this policy..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                rows={2}
              />
            </div>

            {/* Category Field */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content Field with Preview */}
            <div className="space-y-2">
              <Label>
                Content <span className="text-red-500">*</span>
              </Label>
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit">
                    <Code className="h-4 w-4 mr-2" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-2">
                  <Textarea
                    placeholder="Enter policy content in markdown format..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={isSubmitting}
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Markdown formatting is supported
                  </p>
                </TabsContent>

                <TabsContent value="preview" className="space-y-2">
                  <div className="rounded-lg border p-4 bg-muted/30 min-h-[300px] prose prose-sm dark:prose-invert max-w-none">
                    {content ? (
                      <ReactMarkdown>{content}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground italic">
                        No content to preview
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
                  Saving...
                </>
              ) : (
                policy ? "Update Policy" : "Create Policy"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

