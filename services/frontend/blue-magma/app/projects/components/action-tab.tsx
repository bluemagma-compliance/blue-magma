"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
	import {
		  Plus,
		  Circle,
		  CheckCircle,
		  Clock,
			  AlertCircle,
		  Calendar,
		  Database,
		  Shield,
		  Zap,
		  FileText,
		  ChevronDown,
		} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type {
	Project,
	ProjectTask,
	EvidenceRequest,
	DocumentSummary,
} from "../types";
import type { ApiProjectTask, ProjectTaskStatusApi } from "../actions";
import {
	createProjectTask,
	deleteProjectTask,
	getProjectTasks,
	updateProjectTask,
	getProjectEvidenceRequests,
	searchProjectDocuments,
} from "../actions";
import { TaskDetailModal } from "./task-detail-modal";

interface ActionTabProps {
	  projectId: string;
  project: Project;
  onSwitchTab?: (tab: string) => void;
  onViewEvidenceRequest?: (evidenceRequestId: string, documentPageId: string) => void;
}

	export function ActionTab({ projectId, project, onSwitchTab, onViewEvidenceRequest }: ActionTabProps) {
		  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
		  const [tasks, setTasks] = useState<ProjectTask[]>([]);
		  const [isLoading, setIsLoading] = useState(true);
		  const [error, setError] = useState<string | null>(null);
		  const [isSaving, setIsSaving] = useState(false);
		  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
		  const [newTitle, setNewTitle] = useState("");
		  const [newDescription, setNewDescription] = useState("");
		  const [newPriority, setNewPriority] = useState<ProjectTask["priority"]>("medium");
		  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
		  const [dragOverStatus, setDragOverStatus] = useState<ProjectTask["status"] | null>(null);
		  const [isDragging, setIsDragging] = useState(false);

		  // Create Task dialog enhanced fields
		  const [dependencyTaskId, setDependencyTaskId] = useState<string | null>(null);
		  const [dependencySearch, setDependencySearch] = useState("");
			  const [evidenceRequests, setEvidenceRequests] = useState<EvidenceRequest[]>([]);
		  const [isLoadingEvidenceRequests, setIsLoadingEvidenceRequests] = useState(false);
		  const [evidenceError, setEvidenceError] = useState<string | null>(null);
		  const [selectedEvidenceRequestId, setSelectedEvidenceRequestId] = useState<string | null>(null);
			  const [evidenceSearch, setEvidenceSearch] = useState("");
			  const [documentResults, setDocumentResults] = useState<DocumentSummary[]>([]);
		  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
		  const [documentsError, setDocumentsError] = useState<string | null>(null);
		  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
		  const [documentSearch, setDocumentSearch] = useState("");
		  const [isDependencyDropdownOpen, setIsDependencyDropdownOpen] = useState(false);
		  const [isEvidenceDropdownOpen, setIsEvidenceDropdownOpen] = useState(false);
		  const [isDocumentDropdownOpen, setIsDocumentDropdownOpen] = useState(false);

		  // Map backend task shape to the richer UI task model. Some fields are
		  // UI-only (taskType, author, resolution metadata) and will remain unset
		  // for now for backend-created tasks.
		  const mapApiTaskToUiTask = (api: ApiProjectTask): ProjectTask => {
		    // Backend uses snake_case status; UI uses hyphenated for in-progress.
		    let status: ProjectTask["status"];
		    if (api.status === "in_progress") {
		      status = "in-progress";
		    } else if (api.status === "stuck") {
		      status = "stuck";
		    } else {
		      status = api.status as ProjectTask["status"];
		    }

		    return {
		      id: api.object_id,
		      title: api.title,
		      description: api.description || "",
		      status,
		      priority: api.priority,
		      dueDate: api.due_date || undefined,
		      notes: api.notes ?? undefined,
			      dependsOnTaskId: api.depends_on_task_id ?? undefined,
			      // Backend-linked relationships and timestamps are surfaced so the
			      // Task Detail modal can show linked evidence/docs and basic activity.
			      documentId: api.document_id ?? undefined,
			      evidenceRequestId: api.evidence_request_id ?? undefined,
			      createdAt: api.created_at || new Date().toISOString(),
			      updatedAt: api.updated_at || undefined,
		    };
		  };

		  // Initial load of active (non-completed) tasks
		  useEffect(() => {
		    let cancelled = false;

		    const load = async () => {
		      try {
		        setIsLoading(true);
		        setError(null);
		        // Do not pull completed tasks by default; fetch active + stuck lanes only.
		        const [todoRes, inProgressRes, stuckRes] = await Promise.all([
		          getProjectTasks(projectId, { limit: 50, offset: 0, status: "todo" }),
		          getProjectTasks(projectId, { limit: 50, offset: 0, status: "in_progress" }),
		          getProjectTasks(projectId, { limit: 50, offset: 0, status: "stuck" }),
		        ]);
		        if (!cancelled) {
		          const items = [
		            ...(Array.isArray(todoRes.items) ? todoRes.items : []),
		            ...(Array.isArray(inProgressRes.items) ? inProgressRes.items : []),
		            ...(Array.isArray(stuckRes.items) ? stuckRes.items : []),
		          ];
		          setTasks(items.map(mapApiTaskToUiTask));
		        }
		      } catch (err) {
		        console.error("❌ [ActionTab] Failed to load project tasks:", err);
		        if (!cancelled) {
		          setError("Failed to load tasks for this project");
		        }
		      } finally {
		        if (!cancelled) {
		          setIsLoading(false);
		        }
		      }
		    };

		    void load();
		
		    return () => {
		      cancelled = true;
		    };
		  }, [projectId]);

			  // When the Create Task dialog opens, lazily load evidence requests and a
			  // small set of documentation pages using the new search-oriented
			  // endpoints. This keeps the board fast while still giving the dialog
			  // helpful defaults.
			  useEffect(() => {
			    if (!isCreateDialogOpen) return;
			
			    let cancelled = false;
			
			    const loadLinkedResources = async () => {
			      try {
			        setEvidenceError(null);
			        setDocumentsError(null);
			        setIsLoadingEvidenceRequests(true);
			        setIsLoadingDocuments(true);
			
			        const [evidenceResult, docsResult] = await Promise.allSettled([
			          // Use ?q= to leverage the backend's "q present -> top 5"
			          // semantics for the initial suggestions in the create-task
			          // dialog, instead of loading the full lists.
			          getProjectEvidenceRequests(projectId, { q: "" }),
			          // NOTE: We previously loaded the full document tree via
			          // getDocumentTree here. That was heavy for large projects and
			          // not aligned with the new /document?q=... "top-5" search API,
			          // so for the create-task dropdown we now call
			          // searchProjectDocuments instead. Passing q: "" ensures we hit
			          // the backend's "q present but empty -> top 5" path.
			          searchProjectDocuments(projectId, { q: "" }),
			        ]);
			
			        if (cancelled) return;
			
			        if (evidenceResult.status === "fulfilled") {
			          setEvidenceRequests(evidenceResult.value ?? []);
			        } else {
			          console.error(
			            "❌ [ActionTab] Failed to load evidence requests for create-task dialog:",
			            evidenceResult.reason,
			          );
			          setEvidenceRequests([]);
			          setEvidenceError("Failed to load evidence requests");
			        }
			
			        if (docsResult.status === "fulfilled") {
			          setDocumentResults(docsResult.value ?? []);
			        } else {
			          console.error(
			            "❌ [ActionTab] Failed to load documents for create-task dialog:",
			            docsResult.reason,
			          );
			          setDocumentResults([]);
			          setDocumentsError("Failed to load documentation pages");
			        }
			      } finally {
			        if (!cancelled) {
			          setIsLoadingEvidenceRequests(false);
			          setIsLoadingDocuments(false);
			        }
			      }
			    };
			
			    void loadLinkedResources();
			
			    return () => {
			      cancelled = true;
			    };
			  }, [isCreateDialogOpen, projectId]);
			
			  // When searching inside the dependency selector, also hit the backend's
			  // ?q= task search so users can find tasks beyond the initial active
			  // lanes. We merge any matches into the local tasks state and keep using
			  // the existing client-side filtering logic.
			  useEffect(() => {
			    if (!isCreateDialogOpen || !isDependencyDropdownOpen) return;
			
			    const query = dependencySearch.trim();
			    if (!query) return;
			
			    let cancelled = false;
			    const timeoutId = window.setTimeout(async () => {
			      try {
			        const res = await getProjectTasks(projectId, {
			          limit: 5,
			          offset: 0,
			          q: query,
			        });
			        if (cancelled) return;
			        const items = Array.isArray(res.items) ? res.items : [];
			        if (items.length === 0) return;
			
			        setTasks((prev) => {
			          const byId = new Map(prev.map((t) => [t.id, t]));
			          for (const apiTask of items) {
			            const uiTask = mapApiTaskToUiTask(apiTask);
			            // Only allow non-completed tasks as dependencies.
			            if (uiTask.status !== "completed") {
			              byId.set(uiTask.id, uiTask);
			            }
			          }
			          return Array.from(byId.values());
			        });
			      } catch (err) {
			        console.error("❌ [ActionTab] Failed to search dependency tasks:", err);
			      }
			    }, 250);
			
			    return () => {
			      cancelled = true;
			      window.clearTimeout(timeoutId);
			    };
			  }, [
			    dependencySearch,
			    isCreateDialogOpen,
			    isDependencyDropdownOpen,
			    projectId,
			  ]);
			
			  // Evidence request search uses the new ?q= API and keeps a small
			  // in-memory cache of results. The dropdown still filters locally over
			  // that cache.
			  useEffect(() => {
			    if (!isCreateDialogOpen || !isEvidenceDropdownOpen) return;
			
			    const query = evidenceSearch.trim();
			    if (!query) return;
			
			    let cancelled = false;
			    const timeoutId = window.setTimeout(async () => {
			      try {
			        setIsLoadingEvidenceRequests(true);
			        const results = await getProjectEvidenceRequests(projectId, { q: query });
			        if (cancelled) return;
			
			        setEvidenceRequests((prev) => {
			          const byId = new Map(prev.map((req) => [req.object_id, req]));
			          for (const req of results ?? []) {
			            byId.set(req.object_id, req);
			          }
			          return Array.from(byId.values());
			        });
			        setEvidenceError(null);
			      } catch (err) {
			        console.error("❌ [ActionTab] Failed to search evidence requests:", err);
			        if (!cancelled) {
			          setEvidenceError("Failed to search evidence requests");
			        }
			      } finally {
			        if (!cancelled) {
			          setIsLoadingEvidenceRequests(false);
			        }
			      }
			    }, 250);
			
			    return () => {
			      cancelled = true;
			      window.clearTimeout(timeoutId);
			    };
			  }, [
			    evidenceSearch,
			    isCreateDialogOpen,
			    isEvidenceDropdownOpen,
			    projectId,
			  ]);
			
			  // Documentation page search uses the new /document?q=... endpoint and
			  // keeps a lightweight cache of top results for the dropdown.
			  useEffect(() => {
			    if (!isCreateDialogOpen || !isDocumentDropdownOpen) return;
			
			    const query = documentSearch.trim();
			    if (!query) return;
			
			    let cancelled = false;
			    const timeoutId = window.setTimeout(async () => {
			      try {
			        setIsLoadingDocuments(true);
			        const results = await searchProjectDocuments(projectId, { q: query });
			        if (cancelled) return;
			
			        setDocumentResults((prev) => {
			          const byId = new Map(prev.map((doc) => [doc.object_id, doc]));
			          for (const doc of results ?? []) {
			            byId.set(doc.object_id, doc);
			          }
			          return Array.from(byId.values());
			        });
			        setDocumentsError(null);
			      } catch (err) {
			        console.error("❌ [ActionTab] Failed to search documents:", err);
			        if (!cancelled) {
			          setDocumentsError("Failed to search documentation pages");
			        }
			      } finally {
			        if (!cancelled) {
			          setIsLoadingDocuments(false);
			        }
			      }
			    }, 250);
			
			    return () => {
			      cancelled = true;
			      window.clearTimeout(timeoutId);
			    };
			  }, [
			    documentSearch,
			    isCreateDialogOpen,
			    isDocumentDropdownOpen,
			    projectId,
			  ]);
			
			  // Map lightweight document summaries into a simple list of selectable
			  // pages for the create-task dropdown.
				  const flatDocumentPages = useMemo(
				    () =>
				      documentResults.map((doc) => ({
				        id: doc.object_id,
				        label: doc.title ?? "(Untitled page)",
				      })),
				    [documentResults],
				  );

	  const getTaskStatusIcon = (status: ProjectTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in-progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'todo':
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

	  const getPriorityBadge = (priority: ProjectTask['priority']) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge variant="outline" className="text-orange-600 border-orange-500">High</Badge>;
      case 'medium':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-gray-600 border-gray-500">Low</Badge>;
    }
  };

	  const getTaskTypeIcon = (taskType: ProjectTask['taskType']) => {
    switch (taskType) {
      case 'missing-data':
        return <Database className="h-4 w-4" />;
      case 'documentation-issue':
        return <FileText className="h-4 w-4" />;
      case 'evidence-request':
        return <AlertCircle className="h-4 w-4" />;
      case 'security-issue':
        return <Shield className="h-4 w-4" />;
    }
  };

	  const getTaskTypeBadge = (taskType: ProjectTask['taskType']) => {
    switch (taskType) {
      case 'missing-data':
        return <Badge variant="outline" className="text-blue-600 border-blue-500 flex items-center gap-1"><Database className="h-3 w-3" />Missing Data</Badge>;
      case 'documentation-issue':
        return <Badge variant="outline" className="text-orange-600 border-orange-500 flex items-center gap-1"><FileText className="h-3 w-3" />Documentation</Badge>;
      case 'evidence-request':
        return <Badge variant="outline" className="text-amber-600 border-amber-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Evidence Request</Badge>;
      case 'security-issue':
        return <Badge variant="outline" className="text-red-600 border-red-500 flex items-center gap-1"><Shield className="h-3 w-3" />Security Issue</Badge>;
    }
  };

		  const todoTasks = tasks.filter(t => t.status === 'todo');
		  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
		  const stuckTasks = tasks.filter(t => t.status === 'stuck');
		  const completedTasks = tasks.filter(t => t.status === 'completed');
		  const dependencyCandidates = tasks.filter(
		    (t) =>
		      t.status === "todo" ||
		      t.status === "in-progress" ||
		      t.status === "stuck",
		  );
		  const filteredDependencyTasks = dependencyCandidates.filter((t) => {
		    if (!dependencySearch.trim()) return true;
		    return t.title.toLowerCase().includes(dependencySearch.toLowerCase());
		  });
		  const filteredEvidenceRequests = evidenceRequests.filter((req) => {
		    if (!evidenceSearch.trim()) return true;
		    const query = evidenceSearch.toLowerCase();
		    return (
		      req.title.toLowerCase().includes(query) ||
		      (req.description ?? "").toLowerCase().includes(query)
		    );
		  });
		  const filteredDocumentPages = flatDocumentPages.filter((page) => {
		    if (!documentSearch.trim()) return true;
		    return page.label.toLowerCase().includes(documentSearch.toLowerCase());
		  });
			  const selectedDependencyTask =
			    dependencyTaskId != null
			      ? tasks.find((t) => t.id === dependencyTaskId) ?? null
			      : null;
			  const selectedEvidenceRequest =
			    selectedEvidenceRequestId != null
			      ? evidenceRequests.find((req) => req.object_id === selectedEvidenceRequestId) ?? null
			      : null;
			  const selectedDocumentPage =
			    selectedDocumentId != null
			      ? flatDocumentPages.find((page) => page.id === selectedDocumentId) ?? null
			      : null;

		  const handleTaskUpdate = async (updatedTask: ProjectTask) => {
	    setIsSaving(true);
	    const previousTasks = tasks;
	    setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
	    try {
		      const statusForApi: ProjectTaskStatusApi =
		        updatedTask.status === "in-progress"
		          ? "in_progress"
		          : updatedTask.status === "stuck"
		          ? "stuck"
		          : updatedTask.status;
	      await updateProjectTask(projectId, updatedTask.id, {
	        title: updatedTask.title,
	        description: updatedTask.description,
	        status: statusForApi,
	        priority: updatedTask.priority,
		        due_date: updatedTask.dueDate ?? null,
		        // Persist notes when present; send null explicitly to clear them.
		        notes: updatedTask.notes ?? null,
	      });
	    } catch (err) {
	      console.error("❌ [ActionTab] Failed to update task:", err);
	      // If the update fails, revert to the previous list so UI stays consistent with backend.
	      setTasks(previousTasks);
	    } finally {
	      setIsSaving(false);
	      setSelectedTask(null);
	    }
	  };

				  const handleCreateTask = async () => {
	    if (!newTitle.trim()) {
	      toast.error("Please enter a task title");
	      return;
	    }

				    try {
				      setIsSaving(true);
				      const trimmedTitle = newTitle.trim();
				      const trimmedDescription = newDescription.trim();
					
				      const payload: {
		        title: string;
		        description?: string;
		        status: ProjectTaskStatusApi;
		        priority: ProjectTask["priority"];
		        due_date?: string;
		        document_id?: number;
		        evidence_request_id?: number;
		        notes?: string;
		        depends_on_task_id?: string;
				      } = {
				        title: trimmedTitle,
				        description: trimmedDescription || undefined,
				        status: "todo",
				        priority: newPriority,
				      };
				
				      if (dependencyTaskId) {
				        payload.depends_on_task_id = dependencyTaskId;
				      }
				      if (selectedDocumentId) {
				        const maybeDocumentId = Number(selectedDocumentId);
				        if (!Number.isNaN(maybeDocumentId)) {
				          payload.document_id = maybeDocumentId;
				        }
				      }
				      if (selectedEvidenceRequestId) {
				        const maybeEvidenceId = Number(selectedEvidenceRequestId);
				        if (!Number.isNaN(maybeEvidenceId)) {
				          payload.evidence_request_id = maybeEvidenceId;
				        }
				      }

			      const result = await createProjectTask(projectId, payload);

	      if (!result.success || !result.task) {
	        toast.error(result.error || "Failed to create task");
	        return;
	      }

			      const created = mapApiTaskToUiTask(result.task);
			      setTasks((prev) => [created, ...prev]);
			      setIsCreateDialogOpen(false);
			      setNewTitle("");
			      setNewDescription("");
			      setNewPriority("medium");
			      setDependencyTaskId(null);
			      setDependencySearch("");
			      setSelectedEvidenceRequestId(null);
			      setEvidenceSearch("");
			      setSelectedDocumentId(null);
			      setDocumentSearch("");
			      setIsDependencyDropdownOpen(false);
			      setIsEvidenceDropdownOpen(false);
			      setIsDocumentDropdownOpen(false);
	      toast.success("Task created");
	    } catch (err) {
	      console.error("❌ [ActionTab] Failed to create task:", err);
	      toast.error("Failed to create task");
	    } finally {
	      setIsSaving(false);
	    }
	  };

		  const handleDeleteTask = async (taskId: string) => {
	    setIsSaving(true);
	    const previousTasks = tasks;
	    setTasks(tasks.filter((t) => t.id !== taskId));
	    try {
	      const result = await deleteProjectTask(projectId, taskId);
	      if (!result.success) {
	        console.error("❌ [ActionTab] Failed to delete task:", result.error);
	        setTasks(previousTasks);
	      }
	    } catch (err) {
	      console.error("❌ [ActionTab] Error deleting task:", err);
	      setTasks(previousTasks);
	    } finally {
	      setIsSaving(false);
	      setSelectedTask(null);
	    }
		  };

		  const handleDragStart = (taskId: string) => {
		    setDraggedTaskId(taskId);
		    setIsDragging(true);
		  };

		  const handleDragEnd = () => {
		    setDraggedTaskId(null);
		    setIsDragging(false);
		    setDragOverStatus(null);
		  };

		  const handleDropOnColumn = (targetStatus: ProjectTask["status"]) => {
		    if (!draggedTaskId) return;
		    const taskToMove = tasks.find((t) => t.id === draggedTaskId);
		    if (!taskToMove || taskToMove.status === targetStatus) {
		      handleDragEnd();
		      return;
		    }
		    const updatedTask: ProjectTask = { ...taskToMove, status: targetStatus };
		    void handleTaskUpdate(updatedTask);
		    handleDragEnd();
		  };

		  const handleColumnDragOver = (
		    event: React.DragEvent<HTMLDivElement>,
		    status: ProjectTask["status"],
		  ) => {
		    event.preventDefault();
		    if (dragOverStatus !== status) {
		      setDragOverStatus(status);
		    }
		  };

		  const handleColumnDragLeave = (status: ProjectTask["status"]) => {
		    if (dragOverStatus === status) {
		      setDragOverStatus(null);
		    }
		  };

	  return (
    <div className="space-y-6">
      {/* Tasks Section */}
      <div>
		          <div className="flex items-center justify-between mb-4">
	          <div className="flex items-center gap-3">
	            <h3 className="text-lg font-semibold">Tasks</h3>
		            {/* Completed tasks live in their own lane so the board stays focused on
			                active work by default. */}
	          </div>
		          <Button
		            variant="outline"
		            size="sm"
		            onClick={() => setIsCreateDialogOpen(true)}
		          >
		            <Plus className="mr-2 h-3 w-3" />
		            Add Task
		          </Button>
	        </div>

		        <div className="space-y-4">
	          {isLoading && (
	            <Card>
	              <CardContent className="py-6 text-center text-sm text-muted-foreground">
	                Loading tasks…
	              </CardContent>
	            </Card>
	          )}

	          {!isLoading && error && (
	            <Card>
	              <CardContent className="py-6 text-center text-sm text-red-600">
	                {error}
	              </CardContent>
	            </Card>
	          )}
		    	      <div className="grid gap-4 md:grid-cols-4">
		        {/* To Do Tasks */}
		        <Card
		          className={cn(
		            "border border-slate-200 bg-slate-50",
		            dragOverStatus === "todo" && "ring-2 ring-slate-400",
		          )}
		          // Make the entire lane card a drop zone so the visual ring always
		          // matches where drops are accepted.
		          onDragOver={(event) => handleColumnDragOver(event, "todo")}
		          onDragLeave={() => handleColumnDragLeave("todo")}
		          onDrop={() => handleDropOnColumn("todo")}
		        >
		    	          <CardHeader className="pb-3">
		    	            <CardTitle className="text-sm font-medium flex items-center">
		    	              <Circle className="mr-2 h-4 w-4 text-gray-400" />
		    	              To Do ({todoTasks.length})
		    	            </CardTitle>
		    	          </CardHeader>
		          <CardContent
		            className="space-y-3 min-h-[120px]"
		            // Drop handling moved up to the parent <Card> so the full lane
		            // surface (not just this content area) acts as the drop zone.
		          >
		    	            {todoTasks.length === 0 ? (
		    	              <p className="py-2 text-xs text-muted-foreground text-center">
		    	                No tasks in this column yet.
		    	              </p>
		    	            ) : (
		    	              todoTasks.map((task) => (
		    	                <div
		    	                  key={task.id}
		    	                  draggable
		    	                  onDragStart={() => handleDragStart(task.id)}
		    	                  onDragEnd={handleDragEnd}
		    	                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
		    	                  onClick={() => {
		    	                    if (isDragging) return;
		    	                    setSelectedTask(task);
		    	                  }}
		    	                >
		    	                  <div className="flex-1">
		    	                    <div className="flex items-center gap-2 mb-2 flex-wrap">
		    	                      <h4 className="font-medium text-sm">{task.title}</h4>
		    	                      {task.taskType && getTaskTypeBadge(task.taskType)}
		    	                      {getPriorityBadge(task.priority)}
		    	                    </div>
		    	                    <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
		    	                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
		    	                      {task.author && (
		    	                        <span className="flex items-center">
		    	                          <span
		    	                            className="inline-block w-2 h-2 rounded-full mr-1"
		    	                            style={{
		    	                              backgroundColor:
		    	                                task.author.type === "ai" ? "#8b5cf6" : "#3b82f6",
		    	                            }}
		    	                          />
		    	                          {task.author.role}
		    	                        </span>
		    	                      )}
		    	                      {task.assignedTo && (
		    	                        <span className="flex items-center">
		    	                          <Calendar className="mr-1 h-3 w-3" />
		    	                          {task.assignedTo}
		    	                        </span>
		    	                      )}
		    	                      {task.dueDate && (
		    	                        <span className="flex items-center">
		    	                          <Calendar className="mr-1 h-3 w-3" />
		    	                          {new Date(task.dueDate).toLocaleDateString()}
		    	                        </span>
		    	                      )}
		    	                    </div>
		    	                  </div>
		    	                </div>
		    	              ))
		    	            )}
		    	          </CardContent>
		    	        </Card>
		    		
		        {/* In Progress Tasks */}
		        <Card
		          className={cn(
		            "border border-blue-200 bg-blue-50/60",
		            dragOverStatus === "in-progress" && "ring-2 ring-blue-400",
		          )}
		          // Same behavior for the In Progress lane: the whole card is a
		          // valid drop target, not just the inner content.
		          onDragOver={(event) => handleColumnDragOver(event, "in-progress")}
		          onDragLeave={() => handleColumnDragLeave("in-progress")}
		          onDrop={() => handleDropOnColumn("in-progress")}
		        >
		    	          <CardHeader className="pb-3">
		    	            <CardTitle className="text-sm font-medium flex items-center">
		    	              <Clock className="mr-2 h-4 w-4 text-blue-600" />
		    	              In Progress ({inProgressTasks.length})
		    	            </CardTitle>
		    	          </CardHeader>
		          <CardContent
		            className="space-y-3 min-h-[120px]"
		            // Drop handling moved to the parent <Card> for a larger, more
		            // forgiving drop zone that matches the highlight ring.
		          >
		    	            {inProgressTasks.length === 0 ? (
		    	              <p className="py-2 text-xs text-muted-foreground text-center">
		    	                No tasks in this column yet.
		    	              </p>
		    	            ) : (
		    	              inProgressTasks.map((task) => (
		    	                <div
		    	                  key={task.id}
		    	                  draggable
		    	                  onDragStart={() => handleDragStart(task.id)}
		    	                  onDragEnd={handleDragEnd}
		    	                  className="flex items-start justify-between p-3 border rounded-lg border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-colors cursor-pointer"
		    	                  onClick={() => {
		    	                    if (isDragging) return;
		    	                    setSelectedTask(task);
		    	                  }}
		    	                >
		    	                  <div className="flex-1">
		    	                    <div className="flex items-center gap-2 mb-2 flex-wrap">
		    	                      <h4 className="font-medium text-sm">{task.title}</h4>
		    	                      {task.taskType && getTaskTypeBadge(task.taskType)}
		    	                      {getPriorityBadge(task.priority)}
		    	                    </div>
		    	                    <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
		    	                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
		    	                      {task.author && (
		    	                        <span className="flex items-center">
		    	                          <span
		    	                            className="inline-block w-2 h-2 rounded-full mr-1"
		    	                            style={{
		    	                              backgroundColor:
		    	                                task.author.type === "ai" ? "#8b5cf6" : "#3b82f6",
		    	                            }}
		    	                          />
		    	                          {task.author.role}
		    	                        </span>
		    	                      )}
		    	                      {task.assignedTo && (
		    	                        <span className="flex items-center">
		    	                          <Calendar className="mr-1 h-3 w-3" />
		    	                          {task.assignedTo}
		    	                        </span>
		    	                      )}
		    	                      {task.dueDate && (
		    	                        <span className="flex items-center">
		    	                          <Calendar className="mr-1 h-3 w-3" />
		    	                          {new Date(task.dueDate).toLocaleDateString()}
		    	                        </span>
		    	                      )}
		    	                    </div>
		    	                  </div>
		    	                </div>
		    	              ))
		    	            )}
		    	          </CardContent>
		    	        </Card>
		    		
		        {/* Stuck Tasks */}
		        <Card
		          className={cn(
		            "border border-amber-200 bg-amber-50/70",
		            dragOverStatus === "stuck" && "ring-2 ring-amber-400",
		          )}
		          onDragOver={(event) => handleColumnDragOver(event, "stuck")}
		          onDragLeave={() => handleColumnDragLeave("stuck")}
		          onDrop={() => handleDropOnColumn("stuck")}
		        >
		    	          <CardHeader className="pb-3">
		    	            <CardTitle className="text-sm font-medium flex items-center">
		    	              <AlertCircle className="mr-2 h-4 w-4 text-amber-600" />
		    	              Stuck ({stuckTasks.length})
		    	            </CardTitle>
		    	          </CardHeader>
		          <CardContent
		            className="space-y-3 min-h-[120px]"
		            // Drop handling moved up to the <Card> so the visible lane
		            // highlight accurately reflects the active drop target.
		          >
		    	            {stuckTasks.length === 0 ? (
		    	              <p className="py-2 text-xs text-muted-foreground text-center">
		    	                No tasks are currently marked as stuck.
		    	              </p>
		    	            ) : (
		    	              stuckTasks.map((task) => (
		    	                <div
		    	                  key={task.id}
		    	                  draggable
		    	                  onDragStart={() => handleDragStart(task.id)}
		    	                  onDragEnd={handleDragEnd}
		    	                  className="flex items-start justify-between p-3 border rounded-lg border-amber-200 bg-amber-50/70 hover:bg-amber-100/60 transition-colors cursor-pointer"
		    	                  onClick={() => {
		    	                    if (isDragging) return;
		    	                    setSelectedTask(task);
		    	                  }}
		    	                >
		    	                  <div className="flex-1">
		    	                    <div className="flex items-center gap-2 mb-2 flex-wrap">
		    	                      <h4 className="font-medium text-sm">{task.title}</h4>
		    	                      {task.taskType && getTaskTypeBadge(task.taskType)}
		    	                      {getPriorityBadge(task.priority)}
		    	                    </div>
		    	                    <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
		    	                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
		    	                      {task.author && (
		    	                        <span className="flex items-center">
		    	                          <span
		    	                            className="inline-block w-2 h-2 rounded-full mr-1"
		    	                            style={{
		    	                              backgroundColor:
		    	                                task.author.type === "ai" ? "#8b5cf6" : "#3b82f6",
		    	                            }}
		    	                          />
		    	                          {task.author.role}
		    	                        </span>
		    	                      )}
		    	                      {task.assignedTo && (
		    	                        <span className="flex items-center">
		    	                          <Calendar className="mr-1 h-3 w-3" />
		    	                          {task.assignedTo}
		    	                        </span>
		    	                      )}
		    	                      {task.dueDate && (
		    	                        <span className="flex items-center">
		    	                          <Calendar className="mr-1 h-3 w-3" />
		    	                          {new Date(task.dueDate).toLocaleDateString()}
		    	                        </span>
		    	                      )}
		    	                    </div>
		    	                  </div>
		    	                </div>
		    	              ))
		    	            )}
		    	          </CardContent>
		    	        </Card>
		    		
		        {/* Completed Tasks */}
		        <Card
		          className={cn(
		            "border border-emerald-200 bg-emerald-50/70",
		            dragOverStatus === "completed" && "ring-2 ring-emerald-400",
		          )}
		          onDragOver={(event) => handleColumnDragOver(event, "completed")}
		          onDragLeave={() => handleColumnDragLeave("completed")}
		          onDrop={() => handleDropOnColumn("completed")}
		        >
		    	          <CardHeader className="pb-3">
		    	            <CardTitle className="text-sm font-medium flex items-center">
		    	              <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
		    	              Completed ({completedTasks.length})
		    	            </CardTitle>
		    	          </CardHeader>
		          <CardContent
		            className="space-y-3 min-h-[120px]"
		            // Drop handling moved to the parent <Card> so dropping anywhere
		            // inside the highlighted lane moves the task to Completed.
		          >
		            {completedTasks.length === 0 ? (
		              <p className="py-2 text-xs text-muted-foreground text-center">
		                Completed tasks you finish here will appear in this lane. Older
		                completed tasks are hidden to keep the board focused on active
		                work.
		              </p>
		            ) : (
		              completedTasks.map((task) => (
		                <div
		                  key={task.id}
		                  draggable
		                  onDragStart={() => handleDragStart(task.id)}
		                  onDragEnd={handleDragEnd}
		                  className="flex items-start justify-between p-3 border rounded-lg opacity-60 hover:opacity-80 transition-opacity cursor-pointer"
		                  onClick={() => {
		                    if (isDragging) return;
		                    setSelectedTask(task);
		                  }}
		                >
		                  <div className="flex-1">
		                    <div className="flex items-center gap-2 mb-2 flex-wrap">
		                      <h4 className="font-medium text-sm line-through">{task.title}</h4>
		                      {task.taskType && getTaskTypeBadge(task.taskType)}
		                      {getPriorityBadge(task.priority)}
		                    </div>
		                    <p className="text-xs text-muted-foreground">{task.description}</p>
		                    {task.author && (
		                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
		                        <span
		                          className="inline-block w-2 h-2 rounded-full"
		                          style={{
		                            backgroundColor:
		                              task.author.type === "ai" ? "#8b5cf6" : "#3b82f6",
		                          }}
		                        />
		                        {task.author.role}
		                      </div>
		                    )}
		                    {task.resolutionReason && (
		                      <div className="text-xs text-muted-foreground mt-2 italic">
		                        Resolved: {task.resolutionReason}
		                      </div>
		                    )}
		                  </div>
		                </div>
		              ))
		            )}
		    	          </CardContent>
		    	        </Card>
		    	      </div>

		      {!isLoading && tasks.length === 0 && !error && (
	            <Card>
	              <CardContent className="py-12 text-center">
	                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
	                <h4 className="font-medium mb-2">No active tasks yet</h4>
	                <p className="text-sm text-muted-foreground mb-4">
		                  Create tasks to track new work. Completed tasks you finish here
		                  will appear in the Completed lane.
	                </p>
		                <Button
		                  variant="outline"
		                  onClick={() => setIsCreateDialogOpen(true)}
		                >
		                  <Plus className="mr-2 h-4 w-4" />
		                  Create First Task
		                </Button>
	              </CardContent>
	            </Card>
	          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleTaskUpdate}
	        // Provide the full task list so the detail modal can compute
	        // relationships like "depends on" / "blocks" without additional
	        // network calls.
	        allTasks={tasks}
	        onSelectTask={(taskId) => {
	          const next = tasks.find((t) => t.id === taskId) ?? null;
	          if (next) {
	            // Navigate to the selected related task within the same modal.
	            setSelectedTask(next);
	          }
	        }}
        onViewEvidenceRequest={(evidenceRequestId, documentPageId) => {
          // Switch to documentation tab to view the evidence request
	          if (onViewEvidenceRequest) {
	            onViewEvidenceRequest(evidenceRequestId, documentPageId);
	          }
	          onSwitchTab?.("documentation");
          setSelectedTask(null);
        }}
	        // Deletion is wired through the backend tasks API.
	        onDeleteTask={handleDeleteTask}
      />

		      {/* Create Task Dialog */}
		      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
		        <DialogContent className="sm:max-w-xl md:max-w-2xl">
	          <DialogHeader>
	            <DialogTitle>Create Task</DialogTitle>
	            <DialogDescription>
	              Create a new task for this project. Use tasks to track documentation fixes,
	              evidence collection, and security follow-ups.
	            </DialogDescription>
	          </DialogHeader>
		          <div className="space-y-4 py-2">
		            <div className="space-y-2">
		              <Label htmlFor="task-title">Title *</Label>
		              <Input
		                id="task-title"
		                placeholder="e.g., Provide evidence for CC6.1 control"
		                value={newTitle}
		                onChange={(e) => setNewTitle(e.target.value)}
		              />
		            </div>
		            <div className="space-y-2">
		              <Label htmlFor="task-description">Description</Label>
		              <Textarea
		                id="task-description"
		                placeholder="What needs to be done? Add any relevant context."
		                value={newDescription}
		                onChange={(e) => setNewDescription(e.target.value)}
		                rows={3}
		              />
		            </div>
		            <div className="space-y-2">
		              <Label htmlFor="task-priority">Priority</Label>
		              <Select
		                value={newPriority}
		                onValueChange={(value) =>
		                  setNewPriority(value as ProjectTask["priority"])
		                }
		              >
		                <SelectTrigger id="task-priority">
		                  <SelectValue />
		                </SelectTrigger>
		                <SelectContent>
		                  <SelectItem value="low">Low</SelectItem>
		                  <SelectItem value="medium">Medium</SelectItem>
		                  <SelectItem value="high">High</SelectItem>
		                  <SelectItem value="critical">Critical</SelectItem>
		                </SelectContent>
		              </Select>
		            </div>
		            <div className="space-y-3 border-t pt-4 mt-2 max-w-[640px]">
		              <div className="flex items-center justify-between">
		                <span className="text-xs font-medium text-muted-foreground">
		                  Links &amp; dependencies
		                </span>
		                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
		                  Optional
		                </span>
		              </div>
		              {/* Dependency selector (collapsed dropdown) */}
		              <div className="space-y-1">
		                <Label className="text-xs font-medium">Depends on task</Label>
		                <button
		                  type="button"
		                  onClick={() => setIsDependencyDropdownOpen((open) => !open)}
		                  className="flex w-full min-w-0 items-center justify-between rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted"
		                >
		                  <span
		                    className={cn(
		                      "mr-2 flex-1 min-w-0 truncate",
		                      !selectedDependencyTask && "text-muted-foreground",
		                    )}
		                  >
		                    {selectedDependencyTask
		                      ? selectedDependencyTask.title
		                      : "None"}
		                  </span>
		                  <ChevronDown
		                    className={cn(
		                      "h-3 w-3 transition-transform text-muted-foreground",
		                      isDependencyDropdownOpen && "rotate-180",
		                    )}
		                  />
		                </button>
		                {isDependencyDropdownOpen && (
		                  <>
		                    <Input
		                      className="mt-1"
		                      placeholder="Search active tasks by title"
		                      value={dependencySearch}
		                      onChange={(e) => setDependencySearch(e.target.value)}
		                    />
		                    <div className="max-h-36 w-full max-w-full overflow-y-auto overflow-x-hidden rounded-md border bg-background text-xs mt-1">
		                      {filteredDependencyTasks.length === 0 ? (
		                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
		                          No matching active tasks. Only To Do, In Progress, and Stuck
		                          tasks can be selected as dependencies.
		                        </p>
				                      ) : (
				                        filteredDependencyTasks.slice(0, 5).map((task) => (
		                          <button
		                            key={task.id}
		                            type="button"
		                            onClick={() => {
		                              setDependencyTaskId(
		                                dependencyTaskId === task.id ? null : task.id,
		                              );
		                              setIsDependencyDropdownOpen(false);
		                            }}
		                            className={cn(
		                              "flex w-full min-w-0 items-center justify-between px-2 py-1.5 text-left hover:bg-muted",
		                              dependencyTaskId === task.id && "bg-muted",
		                            )}
		                          >
		                            <span className="mr-2 flex-1 min-w-0 truncate">{task.title}</span>
		                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
		                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
		                              {task.status === "todo"
		                                ? "To Do"
		                                : task.status === "in-progress"
		                                  ? "In Progress"
		                                  : "Stuck"}
		                            </span>
		                          </button>
		                        ))
		                      )}
		                    </div>
		                  </>
		                )}
		              </div>
		              {/* Evidence request selector (collapsed dropdown) */}
		              <div className="space-y-1">
		                <Label className="text-xs font-medium">Related evidence request</Label>
		                <button
		                  type="button"
		                  onClick={() => setIsEvidenceDropdownOpen((open) => !open)}
		                  className="flex w-full min-w-0 items-center justify-between rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted"
		                >
		                  <span
		                    className={cn(
		                      "mr-2 flex-1 min-w-0 truncate",
		                      !selectedEvidenceRequest && "text-muted-foreground",
		                    )}
		                  >
		                    {selectedEvidenceRequest
		                      ? selectedEvidenceRequest.title
		                      : "None"}
		                  </span>
		                  <ChevronDown
		                    className={cn(
		                      "h-3 w-3 transition-transform text-muted-foreground",
		                      isEvidenceDropdownOpen && "rotate-180",
		                    )}
		                  />
		                </button>
		                {isEvidenceDropdownOpen && (
		                  <>
		                    <Input
		                      className="mt-1"
		                      placeholder="Search evidence requests"
		                      value={evidenceSearch}
		                      onChange={(e) => setEvidenceSearch(e.target.value)}
		                    />
		                    <div className="max-h-36 w-full max-w-full overflow-y-auto overflow-x-hidden rounded-md border bg-background text-xs mt-1">
		                      {isLoadingEvidenceRequests ? (
		                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
		                          Loading evidence requests
		                        </p>
		                      ) : evidenceError ? (
		                        <p className="px-2 py-1.5 text-[11px] text-red-600 text-center">
		                          {evidenceError}
		                        </p>
		                      ) : filteredEvidenceRequests.length === 0 ? (
		                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
		                          No evidence requests match your search.
		                        </p>
				                      ) : (
				                        filteredEvidenceRequests.slice(0, 5).map((req) => (
		                          <button
		                            key={req.object_id}
		                            type="button"
		                            onClick={() => {
		                              setSelectedEvidenceRequestId(
		                                selectedEvidenceRequestId === req.object_id
		                                  ? null
		                                  : req.object_id,
		                              );
		                              setIsEvidenceDropdownOpen(false);
		                            }}
		                            className={cn(
		                              "flex w-full min-w-0 flex-col items-start px-2 py-1.5 text-left hover:bg-muted",
		                              selectedEvidenceRequestId === req.object_id && "bg-muted",
		                            )}
		                          >
		                            <span className="text-xs font-medium w-full min-w-0 truncate">
		                              {req.title}
		                            </span>
		                            {req.description && (
		                              <span className="text-[10px] w-full min-w-0 text-muted-foreground line-clamp-2">
		                                {req.description}
		                              </span>
		                            )}
		                          </button>
		                        ))
		                      )}
		                    </div>
		                  </>
		                )}
		              </div>
		              {/* Related page selector (collapsed dropdown) */}
		              <div className="space-y-1">
		                <Label className="text-xs font-medium">Related page</Label>
		                <button
		                  type="button"
		                  onClick={() => setIsDocumentDropdownOpen((open) => !open)}
		                  className="flex w-full min-w-0 items-center justify-between rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted"
		                >
		                  <span
		                    className={cn(
		                      "mr-2 flex-1 min-w-0 truncate",
		                      !selectedDocumentPage && "text-muted-foreground",
		                    )}
		                  >
		                    {selectedDocumentPage ? selectedDocumentPage.label : "None"}
		                  </span>
		                  <ChevronDown
		                    className={cn(
		                      "h-3 w-3 transition-transform text-muted-foreground",
		                      isDocumentDropdownOpen && "rotate-180",
		                    )}
		                  />
		                </button>
		                {isDocumentDropdownOpen && (
		                  <>
		                    <Input
		                      className="mt-1"
		                      placeholder="Search documentation pages"
		                      value={documentSearch}
		                      onChange={(e) => setDocumentSearch(e.target.value)}
		                    />
		                    <div className="max-h-36 w-full max-w-full overflow-y-auto overflow-x-hidden rounded-md border bg-background text-xs mt-1">
				                      {isLoadingDocuments ? (
				                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
				                          Loading pages
				                        </p>
		                      ) : documentsError ? (
		                        <p className="px-2 py-1.5 text-[11px] text-red-600 text-center">
		                          {documentsError}
		                        </p>
		                      ) : filteredDocumentPages.length === 0 ? (
		                        <p className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
		                          No pages match your search.
		                        </p>
				                      ) : (
				                        filteredDocumentPages.slice(0, 5).map((page) => (
		                          <button
		                            key={page.id}
		                            type="button"
		                            onClick={() => {
		                              setSelectedDocumentId(
		                                selectedDocumentId === page.id ? null : page.id,
		                              );
		                              setIsDocumentDropdownOpen(false);
		                            }}
		                            className={cn(
		                              "flex w-full min-w-0 items-center px-2 py-1.5 text-left hover:bg-muted",
		                              selectedDocumentId === page.id && "bg-muted",
		                            )}
		                          >
		                            <span className="flex-1 min-w-0 truncate">{page.label}</span>
		                          </button>
		                        ))
		                      )}
		                    </div>
		                  </>
		                )}
		              </div>
		            </div>
		          </div>
	          <DialogFooter>
	            <Button
	              variant="outline"
	              onClick={() => setIsCreateDialogOpen(false)}
	              disabled={isSaving}
	            >
	              Cancel
	            </Button>
	            <Button onClick={handleCreateTask} disabled={isSaving}>
	              {isSaving && <span className="mr-2 h-3 w-3 animate-spin border border-current rounded-full" />}
	              Create Task
	            </Button>
	          </DialogFooter>
	        </DialogContent>
	      </Dialog>
    </div>
  );
}

