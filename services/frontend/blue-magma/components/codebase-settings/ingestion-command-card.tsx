"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Terminal, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { Codebase } from "@/types/api";

interface IngestionCommandCardProps {
  codebase: Codebase;
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

export function IngestionCommandCard({ codebase }: IngestionCommandCardProps) {
  const [copied, setCopied] = useState(false);
  const { organizationId } = useAuth();

  // Use organization ID from auth context, fallback to extracting from codebase ID
  const orgId = organizationId || codebase.object_id.split("-")[0];

  // Clean the API key by removing "APIKey " prefix if it exists
  const cleanApiKey = codebase.api_key?.replace(/^APIKey\s+/, "");

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
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Terminal className="h-5 w-5 text-primary" />
          <span>Ingestion Command</span>
        </CardTitle>
        <CardDescription>
          Use this command to ingest your codebase for analysis and compliance
          scanning.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Command</h4>
          <div className="relative">
            <div className="bg-muted p-3 rounded-lg font-mono text-sm break-all border">
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
          </ol>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Details</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>
              <strong>Organization ID:</strong> {orgId}
            </div>
            <div>
              <strong>API Key:</strong> {cleanApiKey?.substring(0, 8)}...
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
