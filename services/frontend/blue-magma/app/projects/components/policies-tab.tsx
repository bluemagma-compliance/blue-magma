"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Search,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getProjectPolicies, deletePolicy, type PolicyTemplateResponse } from "../actions";
import { PolicyEditor } from "./policy-editor";
import { PolicyViewerEditor } from "./policy-viewer-editor";

interface PoliciesTabProps {
  projectId: string;
  projectStatus?: string;
}

export function PoliciesTab({ projectId, projectStatus }: PoliciesTabProps) {
  const [policies, setPolicies] = useState<PolicyTemplateResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Editor state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyTemplateResponse | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<PolicyTemplateResponse | null>(null);

  // Viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewingPolicy, setViewingPolicy] = useState<PolicyTemplateResponse | null>(null);

  const loadPolicies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectPolicies(projectId);
      setPolicies(data || []);
    } catch (err) {
      console.error("Failed to load policies:", err);
      setError("Failed to load policies");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPolicies();
  }, [projectId, loadPolicies]);

  const handleCreatePolicy = () => {
    setEditingPolicy(null);
    setIsEditorOpen(true);
  };

  const handleEditPolicy = (policy: PolicyTemplateResponse) => {
    setEditingPolicy(policy);
    setIsEditorOpen(true);
  };

  const handleViewPolicy = (policy: PolicyTemplateResponse) => {
    setViewingPolicy(policy);
    setViewerOpen(true);
  };

  const handleDeletePolicy = async () => {
    if (!policyToDelete) return;

    try {
      const result = await deletePolicy(projectId, policyToDelete.id);
      if (result.success) {
        toast.success("Policy deleted successfully");
        await loadPolicies();
      } else {
        toast.error(result.error || "Failed to delete policy");
      }
    } catch (err) {
      toast.error("An error occurred while deleting the policy");
    } finally {
      setDeleteConfirmOpen(false);
      setPolicyToDelete(null);
    }
  };

  const handlePolicySaved = async () => {
    setIsEditorOpen(false);
    setEditingPolicy(null);
    await loadPolicies();
  };

  // Filter policies
  const categories = Array.from(new Set(policies.map((p) => p.category)));
  const filteredPolicies = policies.filter((policy) => {
    const matchesSearch =
      policy.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      policy.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || policy.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading policies...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">{error}</p>
        <Button onClick={loadPolicies} variant="outline" size="sm" className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Policies</h3>
          <p className="text-sm text-muted-foreground">
            Manage project policies and compliance documentation
          </p>
        </div>
        <Button onClick={handleCreatePolicy} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      {/* Search and Filter */}
      {policies.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Policies List */}
      {filteredPolicies.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          {policies.length === 0 ? (
            <div className="space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No policies yet</p>
              <Button onClick={handleCreatePolicy} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create First Policy
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">No policies match your search</p>
          )}
        </div>
      ) : (
        <div className="space-y-0.5">
          {filteredPolicies.map((policy) => (
            <div
              key={policy.id}
              className="flex items-center justify-between gap-3 px-3 py-1.5 border rounded hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => handleViewPolicy(policy)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <h4 className="font-medium truncate text-xs">{policy.title}</h4>
                <Badge variant="outline" className="text-xs py-0 px-1.5">
                  {policy.category}
                </Badge>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(policy.updatedAt).toLocaleDateString()}
                </span>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleViewPolicy(policy)}>
                    <FileText className="h-4 w-4 mr-2" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEditPolicy(policy)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setPolicyToDelete(policy);
                      setDeleteConfirmOpen(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Policy Editor Modal */}
      <PolicyEditor
        projectId={projectId}
        policy={editingPolicy}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handlePolicySaved}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{policyToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePolicy} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Policy Viewer/Editor Modal */}
      <PolicyViewerEditor
        projectId={projectId}
        policy={viewingPolicy}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        projectStatus={projectStatus}
        onPolicySaved={loadPolicies}
      />
    </div>
  );
}

