"use client";

import { useState, useEffect } from "react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BookOpen,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getConfluenceOAuthUrl,
  forceConfluenceSync,
  deleteConfluenceIntegration,
  getConfluenceIntegration,
  getConfluenceIntegrationWithSpaces,
  ingestConfluenceSpaces,
} from "./actions";

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

export default function ConfluenceIntegrationPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [installationId, setInstallationId] = useState<string | undefined>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showAddSpacesModal, setShowAddSpacesModal] = useState(false);
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
  const [isIngesting, setIsIngesting] = useState(false);
  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set());

  // Fetch integration status on mount
  useEffect(() => {
    const fetchIntegrationStatus = async () => {
      try {
        const integration = await getConfluenceIntegrationWithSpaces();
        setIsConnected(integration.connected);
        setInstallationId(integration.installationId);
        if (integration.spaces) {
          setSpaces(integration.spaces);
        }
      } catch (err) {
        console.error("Error fetching integration status:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIntegrationStatus();
  }, []);

  const handleConnectConfluence = async () => {
    try {
      setIsConnecting(true);
      const oauthUrl = await getConfluenceOAuthUrl();
      window.location.href = oauthUrl;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to start Confluence connection";
      toast.error(errorMessage);
      setIsConnecting(false);
    }
  };

  const handleForceSync = async () => {
    try {
      setIsSyncing(true);
      await forceConfluenceSync();
      toast.success("Sync initiated");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to trigger sync";
      toast.error(errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteConfluenceIntegration();
      toast.success("Integration removed successfully");
      setIsConnected(false);
      setInstallationId(undefined);
      setShowDeleteModal(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove integration";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

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

  const handleAddSpaces = () => {
    setShowAddSpacesModal(true);
    // Pre-select already ingested spaces
    const ingestedSpaces = new Set(
      spaces
        .filter(s => s.pages.some(p => p.ingested))
        .map(s => s.space_key)
    );
    setSelectedSpaces(ingestedSpaces);
  };

  const handleConfirmAddSpaces = async () => {
    if (selectedSpaces.size === 0) {
      toast.error("Please select at least one space");
      return;
    }

    try {
      setIsIngesting(true);
      await ingestConfluenceSpaces(Array.from(selectedSpaces));
      toast.success("Documentation ingestion started. This may take a while.");
      setShowAddSpacesModal(false);
      // Refresh spaces after a delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to ingest spaces";
      toast.error(errorMessage);
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-8 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/integrations">← Back to Integrations</Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <div className="p-2 bg-blue-600 rounded-lg mr-3">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              Confluence Integration
            </h1>
            <p className="text-muted-foreground">
              Connect your Confluence workspace for automated documentation
              scanning and compliance tracking.
            </p>
          </div>

          {!isConnected && (
            <Button
              onClick={handleConnectConfluence}
              disabled={isConnecting}
              size="lg"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Confluence
                </>
              )}
            </Button>
          )}
        </div>

        {/* Connected State */}
        {isConnected ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Connected</CardTitle>
                  <CardDescription>
                    Your Confluence workspace is connected
                  </CardDescription>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {installationId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">
                      Installation ID
                    </span>
                  </div>
                  <p className="text-sm text-blue-800 font-mono break-all">
                    {installationId}
                  </p>
                </div>
              )}

              {spaces.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Ingested Spaces</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddSpaces}
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      Add More Spaces
                    </Button>
                  </div>
                  <div className="space-y-2 border rounded-lg p-3">
                    {spaces.map((space) => {
                      const ingestedCount = space.pages.filter(p => p.ingested).length;
                      const allIngested = ingestedCount === space.page_count;
                      return (
                        <div key={space.space_key} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${ingestedCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className={`text-sm font-medium flex-1 ${ingestedCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {space.space_name}
                            </span>
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
                            <span className={`text-xs ${ingestedCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {ingestedCount}/{space.page_count}
                            </span>
                          </div>
                          {expandedSpaces.has(space.space_key) && (
                            <div className="ml-6 space-y-1 text-xs">
                              {space.pages.map((page) => (
                                <div key={page.id} className={`truncate flex items-center ${page.ingested ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  <span className={`mr-2 ${page.ingested ? 'text-green-500' : 'text-gray-300'}`}>✓</span>
                                  {page.page_title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleForceSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Force Sync
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="text-destructive hover:text-destructive"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-3 w-3" />
                      Remove
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Empty State */
          <Card>
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-4">
                <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Not Connected
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Connect your Confluence workspace to start automatically
                    scanning your documentation for compliance issues.
                  </p>
                </div>
                <Button
                  onClick={handleConnectConfluence}
                  disabled={isConnecting}
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Connect Confluence
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Integration Benefits */}
        <Card>
          <CardHeader>
            <CardTitle>Confluence Integration Benefits</CardTitle>
            <CardDescription>
              Streamline your compliance workflow with Confluence integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Automatic Documentation Scanning
                </h4>
                <p className="text-sm text-muted-foreground">
                  Automatically scan all Confluence pages for compliance issues
                  and policy violations.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Real-time Updates
                </h4>
                <p className="text-sm text-muted-foreground">
                  Get instant notifications when documentation is updated or
                  compliance status changes.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Workspace Coverage
                </h4>
                <p className="text-sm text-muted-foreground">
                  Monitor all spaces and pages in your Confluence workspace
                  from a single integration.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center">
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Compliance Tracking
                </h4>
                <p className="text-sm text-muted-foreground">
                  Track documentation compliance over time and maintain audit
                  trails for regulatory requirements.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <DialogTitle>Remove Confluence Integration?</DialogTitle>
              </div>
              <DialogDescription className="pt-4 space-y-3">
                <p>
                  This action will permanently delete all data that Blue Magma has collected from your Confluence workspace, including:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Documentation scans and analysis</li>
                  <li>Compliance reports and findings</li>
                  <li>Policy tracking data</li>
                  <li>Historical documentation records</li>
                </ul>
                <p className="font-semibold text-red-600">
                  This action cannot be undone.
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Integration
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Spaces Modal */}
        <Dialog open={showAddSpacesModal} onOpenChange={setShowAddSpacesModal}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add More Spaces to Ingest</DialogTitle>
              <DialogDescription>
                Select additional Confluence spaces to scan for compliance issues.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {spaces.length > 0 ? (
                <div className="space-y-2 border rounded-lg p-3 max-h-96 overflow-y-auto">
                  {spaces.map((space) => (
                    <div key={space.space_key} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`add-${space.space_key}`}
                          checked={selectedSpaces.has(space.space_key)}
                          onCheckedChange={() => toggleSpaceSelection(space.space_key)}
                        />
                        <label
                          htmlFor={`add-${space.space_key}`}
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
                <p className="text-sm text-muted-foreground">No spaces available</p>
              )}
            </div>
            <DialogFooter className="flex gap-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setShowAddSpacesModal(false)}
                disabled={isIngesting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmAddSpaces}
                disabled={isIngesting || selectedSpaces.size === 0}
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Ingesting...
                  </>
                ) : (
                  "Ingest Selected Spaces"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}

