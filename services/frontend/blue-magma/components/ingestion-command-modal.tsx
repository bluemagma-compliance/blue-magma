"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, Terminal } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { Codebase } from "@/types/api";

interface IngestionCommandModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  codebase: Codebase | null;
}

// Copy to clipboard utility function
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand("copy");
      document.body.removeChild(textArea);
      return result;
    } catch (fallbackErr) {
      console.error("Failed to copy to clipboard:", fallbackErr);
      return false;
    }
  }
}

export function IngestionCommandModal({
  isOpen,
  onOpenChange,
  codebase,
}: IngestionCommandModalProps) {
  const [copied, setCopied] = useState(false);
  const { organizationId } = useAuth();

  if (!codebase || !codebase.api_key) return null;

  // Use organization ID from auth context, fallback to extracting from codebase ID
  const orgId = organizationId || codebase.object_id.split("-")[0];

  // Clean the API key by removing "APIKey " prefix if it exists.
  // Fallback to a placeholder if for some reason the API key is not present on this object.
  const rawApiKey = codebase.api_key ?? "<YOUR_API_KEY>";
  const cleanApiKey = rawApiKey.replace(/^APIKey\s+/, "");

  const command = `magma-ingest --org ${orgId} --key ${cleanApiKey} --root-path .`;

  const handleCopy = async () => {
    const success = await copyToClipboard(command);
    if (success) {
      setCopied(true);
      toast.success("Command copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy command");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Codebase Created Successfully!
          </DialogTitle>
          <DialogDescription>
            Your codebase &quot;{codebase.codebase_name}&quot; has been created.
            Use the command below to ingest your code for analysis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ingestion Command</h4>
            <div className="relative">
              <div className="bg-muted p-4 rounded-lg font-mono text-sm break-all border">
                {command}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Instructions</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Navigate to your repository&apos;s root directory</li>
              <li>Run the command above to start the ingestion process</li>
              <li>The command will analyze your code and upload the results</li>
              <li>You can also find this command in your codebase settings</li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it!</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
