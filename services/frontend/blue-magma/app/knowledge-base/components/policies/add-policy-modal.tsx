"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Upload,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { MockPolicy } from "../../types";

interface AddPolicyModalProps {
  onPolicyAdded: (policy: MockPolicy) => void;
  children: React.ReactNode;
}

export function AddPolicyModal({ onPolicyAdded, children }: AddPolicyModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [formData, setFormData] = useState({
    name: "",
    summary: "",
    author: "",
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        setError("Please upload a PDF, DOCX, DOC, or TXT file");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setSelectedFile(file);
      setError(null);

      // Auto-fill name if empty
      if (!formData.name) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setFormData(prev => ({ ...prev, name: fileName }));
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileType = (file: File): string => {
    const extension = file.name.split('.').pop()?.toUpperCase();
    return extension || 'UNKNOWN';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Please select a file to upload");
      return;
    }

    if (!formData.name) {
      setError("Please provide a document name");
      return;
    }

    if (!formData.summary) {
      setError("Please provide a summary");
      return;
    }

    try {
      setIsSubmitting(true);

      // Simulate API call delay for file upload
      await new Promise(resolve => setTimeout(resolve, 1500));

      // TODO: Implement actual file upload to backend
      // For now, create mock policy with file metadata

      // Mock page count extraction (in real implementation, this would come from backend)
      const mockPageCount = Math.floor(Math.random() * 50) + 10;

      const newPolicy: MockPolicy = {
        id: `policy-${Date.now()}`,
        name: formData.name,
        summary: formData.summary,
        pageCount: mockPageCount,
        author: formData.author || undefined,
        uploadedAt: new Date().toISOString(),
        fileSize: formatFileSize(selectedFile.size),
        fileType: getFileType(selectedFile),
      };

      onPolicyAdded(newPolicy);
      toast.success(`Policy document "${formData.name}" uploaded successfully`);

      // Reset form and close modal
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload policy document";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
    setSelectedFile(null);
    setFormData({
      name: "",
      summary: "",
      author: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload policy documents for your organization.
            </p>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* File Upload */}
            <div>
              <Label htmlFor="file-upload">
                Document File <span className="text-red-500">*</span>
              </Label>
              <div className="mt-2">
                {!selectedFile ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                    <input
                      ref={fileInputRef}
                      id="file-upload"
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground">
                        PDF, DOCX, DOC, or TXT (max 10MB)
                      </p>
                    </label>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Document Name */}
            <div>
              <Label htmlFor="name">
                Document Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., GDPR Compliance Policy"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="mt-1"
              />
            </div>

            {/* Summary */}
            <div>
              <Label htmlFor="summary">
                Summary <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="summary"
                placeholder="Brief summary of the document..."
                value={formData.summary}
                onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                required
                className="mt-1"
                rows={4}
              />
            </div>

            {/* Author (Optional) */}
            <div>
              <Label htmlFor="author">Author (Optional)</Label>
              <Input
                id="author"
                placeholder="e.g., Legal Department"
                value={formData.author}
                onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedFile}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
