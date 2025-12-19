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
import { Badge } from "@/components/ui/badge";
import { Copy, Download, Printer, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { PolicyTemplateResponse } from "../actions";

interface PolicyViewerProps {
  policy: PolicyTemplateResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PolicyViewer({ policy, open, onOpenChange }: PolicyViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyContent = async () => {
    if (!policy) return;
    try {
      await navigator.clipboard.writeText(policy.content);
      setCopied(true);
      toast.success("Content copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy content");
    }
  };

  const handleDownload = () => {
    if (!policy) return;
    try {
      const element = document.createElement("a");
      const file = new Blob([policy.content], { type: "text/markdown" });
      element.href = URL.createObjectURL(file);
      element.download = `${policy.title.replace(/\s+/g, "-").toLowerCase()}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success("Policy downloaded");
    } catch (err) {
      toast.error("Failed to download policy");
    }
  };

  const handlePrint = () => {
    if (!policy) return;
    try {
      const printWindow = window.open("", "", "height=600,width=800");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${policy.title}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                h2 { color: #555; margin-top: 20px; }
                h3 { color: #777; }
                p { line-height: 1.6; }
                pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
                code { background: #f5f5f5; padding: 2px 4px; }
                ul, ol { margin: 10px 0; }
                li { margin: 5px 0; }
              </style>
            </head>
            <body>
              <h1>${policy.title}</h1>
              <p><strong>Category:</strong> ${policy.category}</p>
              <p><strong>Description:</strong> ${policy.description}</p>
              <hr />
              <div id="content"></div>
            </body>
          </html>
        `);
        
        // Render markdown to HTML
        const contentDiv = printWindow.document.getElementById("content");
        if (contentDiv) {
          contentDiv.innerHTML = `<pre>${policy.content}</pre>`;
        }
        
        printWindow.document.close();
        printWindow.print();
      }
    } catch (err) {
      toast.error("Failed to print policy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto !w-[95vw]">
        {policy ? (
          <>
            <DialogHeader>
              <DialogTitle>{policy.title}</DialogTitle>
              <DialogDescription>{policy.description}</DialogDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{policy.category}</Badge>
                <span className="text-xs text-muted-foreground">
                  Last updated {new Date(policy.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </DialogHeader>

            {/* Content */}
            <div className="rounded-lg border p-6 bg-muted/30 prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{policy.content}</ReactMarkdown>
            </div>

            <DialogFooter className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyContent}
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

