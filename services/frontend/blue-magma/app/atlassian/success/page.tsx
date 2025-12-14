"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getConfluenceIntegrationWithSpaces, ingestConfluenceSpaces } from "@/app/integrations/confluence/actions";

interface Space {
  space_key: string;
  space_name: string;
  space_type: string;
  page_count: number;
  pages: Array<{
    id: string;
    page_title: string;
    space_key: string;
    space_name: string;
    version_number: number;
    version_created_at: string;
    ingested: boolean;
  }>;
}

export default function ConfluenceSuccessPage() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const installationId = searchParams.get("installationId");
  const [isLoading, setIsLoading] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [isIngesting, setIsIngesting] = useState(false);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());
  const [backendResponse, setBackendResponse] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    // Debug: Log the query parameters
    console.log("Success page params:", { connected, installationId });

    const fetchSpaces = async () => {
      try {
        const integration = await getConfluenceIntegrationWithSpaces();
        console.log("Fetched integration:", integration);
        setBackendResponse(integration);

        if (integration.spaces) {
          setSpaces(integration.spaces);
          // Pre-select all spaces by default
          setSelectedSpaces(new Set(integration.spaces.map(s => s.space_key)));
        }
      } catch (err) {
        console.error("Error fetching spaces:", err);
      } finally {
        // Add a small delay to ensure smooth transition
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    };

    fetchSpaces();
  }, [connected, installationId]);

  const toggleSpaceSelection = (spaceKey: string) => {
    const newSelected = new Set(selectedSpaces);
    if (newSelected.has(spaceKey)) {
      newSelected.delete(spaceKey);
    } else {
      newSelected.add(spaceKey);
    }
    setSelectedSpaces(newSelected);
  };

  const toggleSpaceExpanded = (spaceKey: string) => {
    const newExpanded = new Set(expandedSpaces);
    if (newExpanded.has(spaceKey)) {
      newExpanded.delete(spaceKey);
    } else {
      newExpanded.add(spaceKey);
    }
    setExpandedSpaces(newExpanded);
  };

  const handleIngestDocumentation = async () => {
    if (selectedSpaces.size === 0) {
      toast.error("Please select at least one space");
      return;
    }

    try {
      setIsIngesting(true);
      await ingestConfluenceSpaces(Array.from(selectedSpaces));
      toast.success("Documentation ingestion started. This may take a while.");
      // Redirect to integration page after a short delay
      setTimeout(() => {
        window.location.href = "/integrations/confluence";
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to ingest documentation";
      toast.error(errorMessage);
    } finally {
      setIsIngesting(false);
    }
  };

  // Handle success case (show even while loading spaces)
  if (connected === "1" && installationId) {
    return (
      <AuthenticatedLayout>
        <div className="flex items-center justify-center min-h-[600px] p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-green-100 rounded-full w-16 h-16 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">
                Confluence Connected Successfully!
              </CardTitle>
              <CardDescription>
                Your Confluence workspace has been connected and is ready for
                documentation scanning and compliance tracking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-900">
                    Installation ID
                  </span>
                </div>
                <p className="text-sm text-green-800 font-mono break-all">
                  {installationId}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-sm mb-3">
                    Select Spaces to Ingest
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Choose which Confluence spaces you want to scan for compliance issues. You can add more spaces later.
                  </p>
                </div>
                {spaces.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {spaces.map((space) => (
                      <div key={space.space_key} className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={space.space_key}
                            checked={selectedSpaces.has(space.space_key)}
                            onCheckedChange={() => toggleSpaceSelection(space.space_key)}
                          />
                          <label
                            htmlFor={space.space_key}
                            className="flex-1 cursor-pointer text-sm font-medium"
                          >
                            {space.space_name}
                          </label>
                          <button
                            onClick={() => toggleSpaceExpanded(space.space_key)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            {expandedSpaces.has(space.space_key) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {space.page_count} pages
                          </span>
                        </div>
                        {expandedSpaces.has(space.space_key) && (
                          <div className="ml-6 space-y-1 text-xs text-muted-foreground">
                            {space.pages.map((page) => (
                              <div key={page.id} className="truncate">
                                • {page.page_title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-lg p-3 text-center text-sm text-muted-foreground">
                    Loading spaces...
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleIngestDocumentation}
                  disabled={isIngesting || selectedSpaces.size === 0}
                  className="flex-1"
                >
                  {isIngesting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Ingesting...
                    </>
                  ) : (
                    "Ingest Selected Documentation"
                  )}
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link href="/integrations/confluence">
                    Skip for Now
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Handle error case
  return (
    <AuthenticatedLayout>
      <div className="flex items-center justify-center min-h-[600px] p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 rounded-full w-16 h-16 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Connection Failed</CardTitle>
            <CardDescription>
              We couldn&apos;t complete the Confluence connection. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 mb-2">
                Missing or invalid connection parameters.
              </p>
              <p className="text-xs text-red-700 mb-3">
                URL Parameters: connected={connected}, installationId={installationId}
              </p>
            </div>

            {backendResponse && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Backend Response (for debugging):
                </p>
                <pre className="text-xs bg-white border border-gray-300 rounded p-2 overflow-auto max-h-48 text-gray-800">
                  {JSON.stringify(backendResponse, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex gap-3">
              <Button asChild className="flex-1">
                <Link href="/integrations/confluence">
                  Try Again
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/integrations">Back to Integrations</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}

