"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  Pause,
  ListTodo,
  BookOpen,
  Code,
  Users,
  FileText,
  Plus,
  MoreHorizontal,
  Circle,
  CheckCircle,
  Clock as ClockIcon,
  Bot,
  BarChart3,
  Loader2,
  Settings,
  Trash2,
  Zap,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { getProjectById, updateProject, deleteProject, type Project as APIProject, getDocumentationTemplateFull, getDocumentTree, getFullDocument } from "../actions";
import type { ProjectTab, Project, DocumentPage, DocumentTreeNode } from "../types";
import { ActionTab } from "../components/action-tab";
import { AgentTasksTab } from "../components/agent-tasks-tab";
import { AgentsTab } from "../components/agents-tab";
import { DocumentationTab } from "../components/documentation-tab";
import { EvidenceLibraryTab } from "../components/evidence-library-tab";
import { AIAuditsTab } from "../components/ai-audits-tab";
import { EditProjectDialog } from "../components/edit-project-dialog";
import { InitializingAnimation } from "../components/initializing-animation";
import { ProjectChatPanel } from "../components/project-chat-panel";
import type { UiAction } from "@/app/chat/services/websocket";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useIsFreePlan } from "@/hooks/useFreePlan";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [activeTab, setActiveTab] = useState<ProjectTab>("documentation");
	// Note: Tab order is: Documentation, Evidence Library, AI-audits, Tasks, Agents.
	// The historical Policies tab was removed in favor of the project-wide
	// Evidence Library that surfaces all collected evidence and evidence requests.
  const [project, setProject] = useState<APIProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Documentation template state (lifted from DocumentationTab)
  const [documentation, setDocumentation] = useState<DocumentPage[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isLoadingDocumentation, setIsLoadingDocumentation] = useState(false);

  // Navigation state for tasks linking to documentation
  const [navigateToPageId, setNavigateToPageId] = useState<string | undefined>(undefined);
  const [openEvidenceRequestId, setOpenEvidenceRequestId] = useState<string | undefined>(undefined);

  // Auditors state (for WebSocket updates)
  const [auditorRefreshTrigger, setAuditorRefreshTrigger] = useState(0);

  // Agents state (for WebSocket updates)
		const [agentRefreshTrigger, setAgentRefreshTrigger] = useState(0);
		const { isFreePlan } = useIsFreePlan();

	  // Sender function for frontend_event messages to the AI chat
	  // (used for project_view_state events).
	  const frontendEventSenderRef =
	    useRef<((eventName: string, payload: Record<string, unknown>) => void) | null>(null);

	  // Lightweight snapshot of the currently viewed documentation page so we
	  // can tell the AI which control/page the user is looking at.
	  const [currentDocumentForAI, setCurrentDocumentForAI] = useState<{
	    id: string;
	    title: string;
	    is_control?: boolean;
	  } | null>(null);

	  // Stable callback to receive current document updates from DocumentationTab
	  // and avoid triggering React's maximum update depth issues.
	  const handleCurrentDocumentChange = useCallback(
	    (doc: { id: string; title: string; is_control?: boolean } | null) => {
	      setCurrentDocumentForAI((prev) => {
	        if (
	          prev?.id === doc?.id &&
	          prev?.title === doc?.title &&
	          prev?.is_control === doc?.is_control
	        ) {
	          return prev;
	        }
	        return doc;
	      });
	    },
	    [],
	  );

  const loadProject = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectById(projectId);
      setProject(data);
    } catch (err) {
      console.error("Failed to load project:", err);
      setError("Failed to load project. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const convertTreeNodeToDocumentPage = (node: DocumentTreeNode): DocumentPage => {
    const createdAt = node.created_at ?? new Date().toISOString();
    const updatedAt = node.updated_at ?? createdAt;

    return {
      id: node.object_id,
      title: node.title,
      content: node.content || "",
      status: node.status,
      order: node.order ?? 0,
      createdAt,
      updatedAt,
      children: node.children?.map(convertTreeNodeToDocumentPage),
    };
  };

	  const loadDocumentation = useCallback(async (updateType?: string) => {
	    console.log("📚 [ProjectDetailPage] Loading documentation... (updateType:", updateType, ", status:", project?.status, ")");
	    setIsLoadingDocumentation(true);
	    try {
	      // If project is on-hold, load template documentation
	      if (project?.status === "on-hold") {
	        console.log("📚 [ProjectDetailPage] Project is on-hold, loading template documentation");
	        const full = await getDocumentationTemplateFull(projectId);
	        if (full && Array.isArray(full.pages) && full.pages.length > 0) {
	          const templ = full.pages as unknown as DocumentPage[];
	          setDocumentation(templ);
	          setTemplateId(full.object_id);
	          console.log("✅ [ProjectDetailPage] Documentation template loaded:", templ.length, "pages");
	        } else {
	          setDocumentation([]);
	          setTemplateId(null);
	          console.log("ℹ️ [ProjectDetailPage] No documentation template found");
	        }
	      } else {
	        // Project is active, load real documentation from document tree
	        console.log("📚 [ProjectDetailPage] Project is active, loading real documentation from tree");
	        const treeData = await getDocumentTree(projectId);
	        if (treeData && Array.isArray(treeData.tree) && treeData.tree.length > 0) {
	          // Convert tree structure to DocumentPage format (including nested children)
	          const convertTreeToPages = (nodes: DocumentTreeNode[]): DocumentPage[] => {
	            return nodes.map((doc, index) => ({
	              id: doc.object_id,
	              title: doc.title,
	              content: doc.content || "",
	              status: doc.status,
	              order: doc.order ?? index,
	              createdAt: new Date().toISOString(),
	              updatedAt: new Date().toISOString(),
	              children: doc.children ? convertTreeToPages(doc.children) : [],
	            }));
	          };

	          const pages: DocumentPage[] = convertTreeToPages(treeData.tree);
	          // Log a concise view of the documentation tree for debugging.
	          // This reflects the hierarchy described in the API contract:
	          // Level 0: Controls Overview, Level 1: domains, Level 2: controls.
	          console.log("📚 [ProjectDetailPage] Documentation tree (root -> domains -> controls):",
	            pages.map((root) => ({
	              id: root.id,
	              title: root.title,
	              childCount: root.children?.length ?? 0,
	              children: (root.children || []).map((domain) => ({
	                id: domain.id,
	                title: domain.title,
	                childCount: domain.children?.length ?? 0,
	                children: (domain.children || []).map((control) => ({
	                  id: control.id,
	                  title: control.title,
	                })),
	              })),
	            })),
	          );
	          setDocumentation(pages);
	          setTemplateId(null);
	          console.log("✅ [ProjectDetailPage] Real documentation loaded:", pages.length, "pages");
	        } else {
	          setDocumentation([]);
	          setTemplateId(null);
	          console.log("ℹ️ [ProjectDetailPage] No real documentation found");
	        }
	      }
	    } catch (err) {
	      console.error("❌ [ProjectDetailPage] Failed to load documentation:", err);
	      setDocumentation([]);
	      setTemplateId(null);
	    } finally {
	      setIsLoadingDocumentation(false);
	    }
	  }, [projectId, project?.status]);

  useEffect(() => {
    loadProject();
    loadDocumentation();
  }, [projectId, loadProject, loadDocumentation]);

  // Set documentation tab as default when project is on-hold
  useEffect(() => {
    if (project?.status === "on-hold") {
      setActiveTab("documentation");
    }
  }, [project?.status]);

  // Reload documentation when project status changes (on-hold vs active)
  useEffect(() => {
    if (project) {
      console.log("📚 [ProjectDetailPage] Project status changed, reloading documentation");
      loadDocumentation("status-change");
    }
  }, [project, loadDocumentation]);

  const loadAuditors = async (updateType?: string) => {
    console.log("🔍 [ProjectDetailPage] Refreshing auditors from AI chat update... (updateType:", updateType, ")");
    console.log("📊 [ProjectDetailPage] Current auditorRefreshTrigger:", auditorRefreshTrigger);
    // Trigger auditors refresh by incrementing the trigger value
    setAuditorRefreshTrigger(prev => {
      const newValue = prev + 1;
      console.log("📊 [ProjectDetailPage] Setting auditorRefreshTrigger to:", newValue);
      return newValue;
    });
  };

  const loadAgents = async (updateType?: string) => {
    console.log("🤖 [ProjectDetailPage] Refreshing agents from AI chat update... (updateType:", updateType, ")");
    console.log("📊 [ProjectDetailPage] Current agentRefreshTrigger:", agentRefreshTrigger);
    // Trigger agents refresh by incrementing the trigger value
    setAgentRefreshTrigger(prev => {
      const newValue = prev + 1;
      console.log("📊 [ProjectDetailPage] Setting agentRefreshTrigger to:", newValue);
      return newValue;
    });
  };

		const handleTabChange = useCallback(
		  (value: string) => {
		    const nextTab = value as ProjectTab;
		    const isRestricted =
		      isFreePlan && (nextTab === "reports" || nextTab === "agent-tasks");
		
		    if (isRestricted) {
		      // Free plan: keep user on the current tab; restricted tabs are visually disabled.
		      return;
		    }
		
		    setActiveTab(nextTab);
		  },
		  [isFreePlan],
		);

	  // Send the current project view (tab + document, if any) to the AI chat via
	  // a frontend_event. This mirrors the SCF page's scf_filter_history_changed
	  // event but for per-project UI context.
	  const sendProjectViewState = useCallback(() => {
	    const sendFrontendEvent = frontendEventSenderRef.current;
	    if (!sendFrontendEvent) {
	      return;
	    }

	    // Only report a document when the Documentation tab is actually visible.
	    const effectiveCurrentDocument =
	      activeTab === "documentation" ? currentDocumentForAI : null;

	    try {
	      const payload = {
	        current_tab: activeTab,
	        current_document: effectiveCurrentDocument
	          ? {
	              id: effectiveCurrentDocument.id,
	              title: effectiveCurrentDocument.title,
	              ...(typeof effectiveCurrentDocument.is_control === "boolean"
	                ? { is_control: effectiveCurrentDocument.is_control }
	                : {}),
	            }
	          : null,
	      };

	      console.log(
	        "📡 [ProjectDetailPage] Sending project_view_state frontend_event:",
	        payload,
	      );
	      sendFrontendEvent("project_view_state", payload);
	    } catch (error) {
	      console.error(
	        "❌ [ProjectDetailPage] Failed to send project_view_state frontend_event",
	        error,
	      );
	    }
	  }, [activeTab, currentDocumentForAI]);

	  // Whenever the tab or current document changes (and the WebSocket sender is
	  // available), keep the AI agent in sync with the current project view.
	  useEffect(() => {
	    sendProjectViewState();
	  }, [sendProjectViewState]);

  const handleUpdateProject = async (projectData: {
    name?: string;
    description?: string;
    status?: "initializing" | "active" | "up-to-date" | "out-of-date" | "audit-ready" | "completed" | "on-hold";
    compliance_score?: number;
  }) => {
    const result = await updateProject(projectId, projectData);
    if (result.success) {
      setIsEditDialogOpen(false);
      await loadProject(); // Reload project
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const handleInitializeProject = async () => {
    const result = await updateProject(projectId, { status: "initializing" });
    if (result.success) {
      await loadProject(); // Reload project to show initializing status
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    const result = await deleteProject(projectId);
    setIsDeleting(false);

    if (result.success) {
      router.push('/projects');
    } else {
      alert(result.error || "Failed to delete project");
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full p-4 md:p-8 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full p-4 md:p-8 space-y-8">
        <Button variant="ghost" onClick={() => router.push('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <h3 className="text-xl font-semibold mb-2">Error Loading Project</h3>
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <Button onClick={loadProject}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full h-full p-4 md:p-8 space-y-8">
        <Button variant="ghost" onClick={() => router.push('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold mb-2">Project Not Found</h3>
          <p className="text-muted-foreground mb-6">
            The project you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button onClick={() => router.push('/projects')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

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

  // Convert APIProject to Project type for UI tabs.
  // NOTE: Previously this function pulled tasks, documentation, and data sources
  // from mockProjects for demo purposes. That mock enrichment has been removed so
  // active projects only show real backend data (or honest empty states).
  const convertToFullProject = (apiProject: APIProject): Project => {
    return {
      id: apiProject.object_id,
      name: apiProject.name,
      description: apiProject.description,
      status: apiProject.status,
      complianceScore: apiProject.compliance_score,
      // TODO: Wire real data sources once backend surfaces them for projects.
      dataSources: [],
      // Tasks will be backed by real project tasks in the future; for now the
      // ActionTab will show a "No tasks yet" empty state instead of mock data.
      tasks: [],
      // Agent task graphs are now driven by real agents in AgentsTab; keep this
      // empty to avoid showing mock agent flows for active projects.
      agentTasks: [],
      // Documentation content is loaded via getDocumentTree/getFullDocument and
      // passed down separately into DocumentationTab.
      documentation: [],
      createdAt: apiProject.created_at || new Date().toISOString(),
      updatedAt: apiProject.updated_at || new Date().toISOString(),
    };
  };

  const fullProject = convertToFullProject(project);

  const getComplianceProgressColor = (score: number) => {
    if (score >= 90) return 'bg-green-600';
    if (score >= 70) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  // NOTE: Use the real backend compliance_score for all statuses. The previous
  // 68% hard-coded value for active projects was mock/demo data and has been
  // removed so active projects accurately reflect their compliance.
  const displayComplianceScore = project.compliance_score ?? 0;

  return (
    <div className="w-full h-full p-4 md:p-8 space-y-4 relative">
      {/* Initializing Overlay */}
      {project.status === 'initializing' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <div className="bg-background rounded-lg p-8 shadow-lg">
            <InitializingAnimation />
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
            className="bg-background"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      )}

      {/* Main Content - Greyed out when initializing */}
      <div className={project.status === 'initializing' ? 'opacity-50 pointer-events-none' : ''}>
      {/* Header */}
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => router.push('/projects')} className="-ml-3">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold tracking-tight">{project.name}</h2>
              {getStatusBadge(project.status)}
              {/* Compact Compliance Score Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-card">
                <span className="text-xs text-muted-foreground">Compliance:</span>
                <span className={`text-sm font-semibold ${getComplianceColor(displayComplianceScore)}`}>
                  {displayComplianceScore}%
                </span>
              </div>
            </div>
            <p className="text-muted-foreground max-w-3xl">
              {project.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {project.status === 'on-hold' && (
              <Button
                onClick={handleInitializeProject}
                className="bg-primary hover:bg-primary/90"
              >
                Initialize Project
              </Button>
            )}
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Edit Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
            </div>
        </div>
      </div>

	      {/* Tabs */}
	      		<Tabs value={activeTab} onValueChange={handleTabChange}>
		        <TabsList className="grid w-full grid-cols-5 max-w-5xl">
		          <TabsTrigger value="documentation" className="flex items-center space-x-2">
	            <BookOpen className="h-4 w-4" />
	            <span>Documentation</span>
	          </TabsTrigger>
		          <TabsTrigger value="evidence-library" className="flex items-center space-x-2">
	            <FileText className="h-4 w-4" />
	            <span>Evidence Library</span>
	          </TabsTrigger>
		          <TabsTrigger
		            value="reports"
		            className="flex items-center space-x-2"
		            disabled={isFreePlan}
		          >
		            <BarChart3 className="h-4 w-4" />
		            <span>AI-audits</span>
		            {isFreePlan && (
		              <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
		                Upgrade
		              </span>
		            )}
		          </TabsTrigger>
		          <TabsTrigger value="action" className="flex items-center space-x-2">
	            <ListTodo className="h-4 w-4" />
	            <span>Tasks</span>
	          </TabsTrigger>
		          <TabsTrigger
		            value="agent-tasks"
		            className="flex items-center space-x-2"
		            disabled={isFreePlan}
		          >
		            <Bot className="h-4 w-4" />
		            <span>Agents</span>
		            {isFreePlan && (
		              <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
		                Upgrade
		              </span>
		            )}
		          </TabsTrigger>
	        </TabsList>

	        <TabsContent value="documentation" className="mt-6">
	          <DocumentationTab
	            project={fullProject}
	            projectStatus={project.status}
	            documentation={documentation}
	            templateId={templateId}
	            isLoadingTemplate={isLoadingDocumentation}
	            onRefreshDocumentation={loadDocumentation}
	            onUpdateDocumentation={setDocumentation}
	            navigateToPageId={navigateToPageId}
	            openEvidenceRequestId={openEvidenceRequestId}
	          onCurrentDocumentChange={handleCurrentDocumentChange}
	          />
	        </TabsContent>
	
	        <TabsContent value="evidence-library" className="mt-6">
	          <EvidenceLibraryTab projectId={projectId} />
	        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <AIAuditsTab projectId={projectId} onRefreshAudits={loadAuditors} refreshTrigger={auditorRefreshTrigger} />
        </TabsContent>

		        <TabsContent value="action" className="mt-6">
	          {project.status === "on-hold" ? (
	            <div className="flex items-center justify-center py-12">
	              <div className="text-center">
	                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
	                <p className="text-muted-foreground">Please initialize this project before using this feature</p>
	              </div>
	            </div>
		          ) : (
		            <ActionTab
		              projectId={projectId}
		              project={fullProject}
		              onSwitchTab={(tab) => handleTabChange(tab)}
		              onViewEvidenceRequest={(evidenceRequestId, documentPageId) => {
		                setNavigateToPageId(documentPageId);
		                setOpenEvidenceRequestId(evidenceRequestId);
		                handleTabChange('documentation');
		              }}
		            />
		          )}
	        </TabsContent>

        <TabsContent value="agent-tasks" className="mt-6">
          {project.status === "on-hold" ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Please initialize this project before using this feature</p>
              </div>
            </div>
          ) : (
            <AgentsTab projectId={projectId} refreshTrigger={agentRefreshTrigger} />
          )}
        </TabsContent>
      </Tabs>
      </div>

      <EditProjectDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        project={project}
        onUpdateProject={handleUpdateProject}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Chat Panel */}
      <ProjectChatPanel
        projectId={projectId}
        projectName={project.name}
        onUpdateEvent={(updateType?: string, _uiActions?: UiAction[]) => {
          void loadDocumentation(updateType);
        }}
        onAuditorUpdate={(updateType?: string, _uiActions?: UiAction[]) => {
          void loadAuditors(updateType);
        }}
        onAgentUpdate={(updateType?: string, _uiActions?: UiAction[]) => {
          void loadAgents(updateType);
	      }}
	      onRegisterFrontendEventSender={(sender) => {
	        frontendEventSenderRef.current = sender;
	        // As soon as the chat is ready, send the latest project view state so
	        // the agent has accurate UI context.
	        sendProjectViewState();
	      }}
      />
    </div>
  );
}

