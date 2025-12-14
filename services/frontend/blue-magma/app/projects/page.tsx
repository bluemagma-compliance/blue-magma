"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderKanban,
  Plus,
  CheckCircle2,
  Pause,
  Code,
  Users,
  FileText,
  MoreVertical,
  Loader2,
  Zap,
  AlertCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { getProjects, createProject, deleteProject, type Project as APIProject } from "./actions";
import { CreateProjectDialog } from "./components/create-project-dialog";
import { toast } from "sonner";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<APIProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<APIProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError("Failed to load projects. Please try again.");
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (projectData: {
    name: string;
    description?: string;
    template_id?: string;
  }) => {
    const result = await createProject(projectData);
    if (result.success) {
      setIsCreateDialogOpen(false);
      await loadProjects(); // Reload projects
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteProject(projectToDelete.object_id);
      if (result.success) {
        toast.success(`Project "${projectToDelete.name}" deleted successfully`);
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
        await loadProjects(); // Reload projects
      } else {
        toast.error(result.error || "Failed to delete project");
      }
    } catch (err) {
      console.error("Error deleting project:", err);
      toast.error("An error occurred while deleting the project");
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (project: APIProject, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (status: APIProject['status']) => {
    switch (status) {
      case 'initializing':
        return (
          <Badge variant="outline" className="text-purple-600 border-purple-500">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Initializing
          </Badge>
        );
      case 'active':
        return (
          <Badge variant="outline" className="text-green-600 border-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case 'up-to-date':
        return (
          <Badge variant="outline" className="text-green-600 border-green-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Up to Date
          </Badge>
        );
      case 'out-of-date':
        return (
          <Badge variant="outline" className="text-orange-600 border-orange-500">
            <AlertCircle className="mr-1 h-3 w-3" />
            Out of Date
          </Badge>
        );
      case 'audit-ready':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-500">
            <Zap className="mr-1 h-3 w-3" />
            Audit Ready
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'on-hold':
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-500">
            <Pause className="mr-1 h-3 w-3" />
            On Hold
          </Badge>
        );
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplianceProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-600';
    if (score >= 70) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full h-full p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-full p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center">
              <FolderKanban className="mr-3 h-8 w-8 text-primary" />
              Projects
            </h2>
            <p className="text-muted-foreground mt-2">
              Manage compliance projects with tasks, data sources, and documentation.
            </p>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <Button onClick={loadProjects}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!projects || projects.length === 0) {
    return (
      <div className="w-full h-full p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center">
              <FolderKanban className="mr-3 h-8 w-8 text-primary" />
              Projects
            </h2>
            <p className="text-muted-foreground mt-2">
              Manage compliance projects with tasks, data sources, and documentation.
            </p>
          </div>
        </div>

        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <FolderKanban className="h-16 w-16 mx-auto mb-6 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">
              Start Your First Project
            </h3>
            <p className="text-muted-foreground mb-6">
              Create a compliance project to organize your codebases, documents, users, and track progress.
            </p>
            <Button size="lg" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-5 w-5" />
              Create Project
            </Button>
          </div>
        </div>

        <CreateProjectDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreateProject={handleCreateProject}
        />

        {/* Quick start guide */}
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What are Projects?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start space-x-3 p-4 rounded-lg border">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Track Compliance</h4>
                    <p className="text-sm text-muted-foreground">
                      Monitor compliance scores and actionable tasks
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Code className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Organize Resources</h4>
                    <p className="text-sm text-muted-foreground">
                      Group codebases, documents, and team members
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-4 rounded-lg border">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Document Everything</h4>
                    <p className="text-sm text-muted-foreground">
                      Maintain project documentation in markdown
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center">
            <FolderKanban className="mr-3 h-8 w-8 text-primary" />
            Projects
          </h2>
          <p className="text-muted-foreground mt-2">
            Manage compliance projects with tasks, data sources, and documentation.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          // NOTE: Use the real backend compliance_score for all statuses. The
          // previous 68% hard-coded value for active projects was mock/demo
          // data and has been removed so this list reflects actual scores.
          const displayComplianceScore = project.compliance_score;

          return (
            <Link key={project.object_id} href={`/projects/${project.object_id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{project.name}</CardTitle>
                      {getStatusBadge(project.status)}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 cursor-pointer"
                          onClick={(e) => openDeleteDialog(project, e)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Compliance Score */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Compliance Score</span>
                      <span className={`text-2xl font-bold ${getComplianceColor(displayComplianceScore)}`}>
                        {displayComplianceScore}%
                      </span>
                    </div>
                    <Progress
                      value={displayComplianceScore}
                      className="h-2"
                      indicatorClassName={getComplianceProgressColor(displayComplianceScore)}
                    />
                  </div>

                  {/* Placeholder for data sources (to be implemented) */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                    <div className="flex items-center">
                      <Code className="mr-1 h-3 w-3" />
                      0
                    </div>
                    <div className="flex items-center">
                      <FileText className="mr-1 h-3 w-3" />
                      0
                    </div>
                    <div className="flex items-center">
                      <Users className="mr-1 h-3 w-3" />
                      0
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <CreateProjectDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateProject={handleCreateProject}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

