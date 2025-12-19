"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Database,
  FileText,
  Shield,
  Zap,
} from "lucide-react";
import type { ProjectTask } from "../types";
import { SendAgentDialog } from "./send-agent-dialog";

interface TaskDetailModalProps {
  task: ProjectTask | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: ProjectTask) => void;
  onSendAgent?: (task: ProjectTask, agentType: string, instructions: string) => void;
		  onViewEvidenceRequest?: (evidenceRequestId: string, documentPageId: string) => void;
		  onDeleteTask?: (taskId: string) => void;
		  // Optional context about other tasks so the detail view can surface
		  // relationships (depends on / blocks) without additional network calls.
		  allTasks?: ProjectTask[];
		  // Callback to navigate between related tasks from within the detail modal.
		  onSelectTask?: (taskId: string) => void;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdate,
  onSendAgent,
		  onViewEvidenceRequest,
		  onDeleteTask,
		  allTasks,
		  onSelectTask,
	}: TaskDetailModalProps) {
	  const [status, setStatus] = useState<ProjectTask['status']>(task?.status || 'todo');
	  const [resolutionReason, setResolutionReason] = useState(task?.resolutionReason || '');
	  const [notes, setNotes] = useState(task?.notes ?? "");
	  const [showResolutionForm, setShowResolutionForm] = useState(false);
	  const [showSendAgentDialog, setShowSendAgentDialog] = useState(false);
	  // When the user clicks a related task pill (e.g. "Depends on"), we first
	  // mark that task as pending and show a lightweight inline confirm action
	  // instead of navigating immediately.
	  const [pendingRelatedTaskId, setPendingRelatedTaskId] = useState<string | null>(null);

	  // Clear any pending navigation state when the modal shows a new task.
	  useEffect(() => {
	    setPendingRelatedTaskId(null);
	  }, [task?.id]);

		  if (!task) return null;

	  // Derive relationship context for the current task. We keep this logic local
	  // to the modal so the Action tab only needs to pass the current task list
	  // and a simple navigation callback.
		  const relatedTasks = allTasks ?? [];
		  const dependsOnTask =
		    task.dependsOnTaskId != null
		      ? relatedTasks.find((t) => t.id === task.dependsOnTaskId) ?? null
		      : null;
		  // NOTE: We previously computed downstream "blocks" relationships here and
		  // rendered them in the Relationships card. That UI was removed from the
		  // Task Detail modal to reduce noise and keep the focus on what this task
		  // depends on and which evidence/docs it relates to. If we need to surface
		  // blocked tasks again, we can restore the computation below and a simple
		  // read-only list in the Relationships section.
		  // const blocksTasks = relatedTasks.filter((t) => t.dependsOnTaskId === task.id);

	  const hasMockEvidenceLink =
	    task.taskType === "evidence-request" &&
	    !!task.linkedEvidenceRequestId &&
	    !!task.linkedDocumentPageId;
	  const hasBackendEvidenceLink = task.evidenceRequestId != null;
	  const hasDocumentLink = !!task.linkedDocumentPageId || task.documentId != null;

	  // Build a minimal derived activity log from the data we have available
	  // today. This is intentionally lightweight and does not claim to be a full
	  // audit trail; if/when the backend exposes a task history endpoint we can
	  // hydrate richer events here.
	  const activityEvents: {
	    key: string;
	    timestamp: string;
	    label: string;
	    description?: string;
	  }[] = [];

	  if (task.createdAt) {
	    activityEvents.push({
	      key: "created",
	      timestamp: task.createdAt,
	      label: "Task created",
	    });
	  }

	  if (task.resolutionDate && task.status === "completed") {
	    activityEvents.push({
	      key: "completed",
	      timestamp: task.resolutionDate,
	      label: "Task completed",
	      description: task.resolutionReason,
	    });
	  }

	  if (task.updatedAt && task.updatedAt !== task.createdAt) {
	    activityEvents.push({
	      key: "updated",
	      timestamp: task.updatedAt,
	      label: "Last updated",
	    });
	  }

	  if (task.notes) {
	    activityEvents.push({
	      key: "notes",
	      // We don't yet have per-note timestamps, so anchor notes to updatedAt
	      // if available, otherwise createdAt.
	      timestamp: task.updatedAt || task.createdAt,
	      label: "Notes",
	      description:
	        task.notes.length > 160 ? `${task.notes.slice(0, 157)}...` : task.notes,
	    });
	  }

	  // Sort events chronologically by timestamp where possible.
	  activityEvents.sort((a, b) => {
	    const aTime = Date.parse(a.timestamp || "");
	    const bTime = Date.parse(b.timestamp || "");
	    if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
	    return aTime - bTime;
	  });

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

  const handleStatusChange = (newStatus: ProjectTask['status']) => {
    setStatus(newStatus);
    if (newStatus === 'completed') {
      setShowResolutionForm(true);
    } else {
      setShowResolutionForm(false);
      setResolutionReason('');
    }
  };

  const handleSave = () => {
    const updatedTask: ProjectTask = {
      ...task,
      status,
      resolutionReason: status === 'completed' ? resolutionReason : undefined,
	      resolutionDate: status === 'completed' ? new Date().toISOString() : undefined,
	      notes: notes.trim().length > 0 ? notes.trim() : undefined,
    };
    onUpdate(updatedTask);
  };

  const isResolutionValid = status !== 'completed' || resolutionReason.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl mb-2">{task.title}</DialogTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {task.taskType && getTaskTypeBadge(task.taskType)}
            {getPriorityBadge(task.priority)}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Description</h3>
            <p className="text-sm text-muted-foreground">{task.description}</p>
          </div>

	        {/* Task Details */}
	        <div className="grid grid-cols-2 gap-4">
	          {task.assignedTo && (
	            <div>
	              <h3 className="font-semibold text-sm mb-2">Assigned To</h3>
	              <p className="text-sm text-muted-foreground">{task.assignedTo}</p>
	            </div>
	          )}

	          {task.dueDate && (
	            <div>
	              <h3 className="font-semibold text-sm mb-2">Due Date</h3>
	              <p className="text-sm text-muted-foreground">
	                {new Date(task.dueDate).toLocaleDateString()}
	              </p>
	            </div>
	          )}

	          {task.resolutionDate && (
	            <div>
	              <h3 className="font-semibold text-sm mb-2">Resolved Date</h3>
	              <p className="text-sm text-muted-foreground">
	                {new Date(task.resolutionDate).toLocaleDateString()}
	              </p>
	            </div>
	          )}

	          {(hasMockEvidenceLink || hasBackendEvidenceLink) && (
	            <div>
	              <h3 className="font-semibold text-sm mb-2">
	                Related Evidence Request
	              </h3>
	              <p className="text-sm text-muted-foreground">
	                {hasMockEvidenceLink ? (
	                  <>
	                    Evidence request in documentation (page
	                    {" "}
	                    <span className="font-mono">
	                      {task.linkedDocumentPageId}
	                    </span>
	                    )
	                  </>
	                ) : (
	                  <>
	                    Evidence request ID
	                    {" "}
	                    <span className="font-mono">
	                      {String(task.evidenceRequestId)}
	                    </span>
	                  </>
	                )}
	              </p>
	            </div>
	          )}

	          {hasDocumentLink && (
	            <div>
	              <h3 className="font-semibold text-sm mb-2">Related Page</h3>
	              <p className="text-sm text-muted-foreground">
	                {task.linkedDocumentPageId ? (
	                  <>
	                    Page reference
	                    {" "}
	                    <span className="font-mono">
	                      {task.linkedDocumentPageId}
	                    </span>
	                  </>
	                ) : (
	                  <>
	                    Document ID
	                    {" "}
	                    <span className="font-mono">
	                      {String(task.documentId)}
	                    </span>
	                  </>
	                )}
	              </p>
	            </div>
	          )}
	        </div>

          {/* Status */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Status</h3>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
	                <SelectItem value="stuck">Stuck</SelectItem>
	                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Resolution Reason */}
          {showResolutionForm && (
            <div>
              <h3 className="font-semibold text-sm mb-2">
                Resolution Reason *
              </h3>
              <Textarea
                placeholder="Explain why this task is resolved..."
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                className="min-h-24"
              />
              {!isResolutionValid && (
                <p className="text-xs text-red-600 mt-1">
                  Resolution reason is required
                </p>
              )}
            </div>
          )}

          {/* Resolution Info */}
          {task.resolutionReason && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h3 className="font-semibold text-sm mb-2 text-green-900">
                Resolution
              </h3>
              <p className="text-sm text-green-800">{task.resolutionReason}</p>
            </div>
          )}

	          {/* Notes */}
	          <div>
	            <h3 className="font-semibold text-sm mb-2">Notes</h3>
	            <Textarea
	              placeholder="Add context, decisions, or progress updates for this task..."
	              value={notes}
	              onChange={(e) => setNotes(e.target.value)}
	              className="min-h-24"
	            />
	          </div>

		          {/* Relationships: only "Depends on" is shown. The previous "Blocks"
		            list was removed from the detail view to keep the panel focused and
		            avoid overwhelming users with downstream relationships. */}
		          <div className="border border-slate-200 rounded-lg p-3">
		            <h3 className="font-semibold text-sm mb-2">Relationships</h3>
		            <div className="space-y-3 text-sm text-muted-foreground">
		              <div>
		                <p className="text-xs font-medium uppercase tracking-wide mb-1">
		                  Depends on
		                </p>
	                {dependsOnTask ? (
		                  <>
		                    <button
		                      type="button"
		                      onClick={() =>
		                        setPendingRelatedTaskId((current) =>
		                          current === dependsOnTask.id ? null : dependsOnTask.id,
		                        )
		                      }
		                      className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
		                    >
		                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-slate-400" />
		                      <span className="truncate text-left">
		                        {dependsOnTask.title}
		                      </span>
		                      <span className="text-[10px] uppercase text-slate-400">
		                        {dependsOnTask.status}
		                      </span>
		                    </button>
		                    {pendingRelatedTaskId === dependsOnTask.id && (
		                      <div className="mt-2 flex gap-2">
		                        <button
		                          type="button"
		                          onClick={() => {
		                            onSelectTask?.(dependsOnTask.id);
		                            setPendingRelatedTaskId(null);
		                          }}
		                          className="text-xs text-primary underline underline-offset-2 hover:no-underline"
		                        >
		                          Go to task
		                        </button>
		                        <button
		                          type="button"
		                          onClick={() => setPendingRelatedTaskId(null)}
		                          className="text-xs text-muted-foreground hover:underline underline-offset-2"
		                        >
		                          Cancel
		                        </button>
		                      </div>
		                    )}
		                  </>
		                ) : (
		                  <p>No dependencies</p>
		                )}
		              </div>
		            </div>
		          </div>

	          {/* Linked evidence and documentation */}
	          {(hasMockEvidenceLink || hasBackendEvidenceLink || hasDocumentLink) && (
	            <div className="space-y-3">
	              {(hasMockEvidenceLink || hasBackendEvidenceLink) && (
	                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
	                  <h3 className="font-semibold text-sm mb-2 text-amber-900">
	                    Linked Evidence Request
	                  </h3>
	                  {hasMockEvidenceLink ? (
	                    <>
	                      <p className="text-sm text-amber-800 mb-3">
	                        This task is linked to an evidence request in the
	                        documentation. Click below to view the request and
	                        upload evidence.
	                      </p>
	                      <Button
	                        variant="outline"
	                        size="sm"
	                        onClick={() =>
	                          onViewEvidenceRequest?.(
	                            task.linkedEvidenceRequestId!,
	                            task.linkedDocumentPageId!,
	                          )
	                        }
	                        className="w-full"
	                      >
	                        View Evidence Request in Documentation
	                      </Button>
	                    </>
	                  ) : (
	                    <p className="text-sm text-amber-800">
	                      This task is linked to evidence request ID
	                      {" "}
	                      <span className="font-mono">
	                        {String(task.evidenceRequestId)}
	                      </span>
	                      .
	                    </p>
	                  )}
	                </div>
	              )}

	              {hasDocumentLink && (
	                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
	                  <h3 className="font-semibold text-sm mb-1 text-sky-900">
	                    Linked Documentation
	                  </h3>
	                  <p className="text-sm text-sky-800">
	                    {task.linkedDocumentPageId ? (
	                      <>
	                        Page reference
	                        {" "}
	                        <span className="font-mono">
	                          {task.linkedDocumentPageId}
	                        </span>
	                      </>
	                    ) : (
	                      <>Document ID {String(task.documentId)}</>
	                    )}
	                  </p>
	                </div>
	              )}
	            </div>
	          )}

		          {/* Activity */}
		          {activityEvents.length > 0 && (
		            <div className="border border-slate-200 rounded-lg p-3">
		              <h3 className="font-semibold text-sm mb-2">Activity</h3>
		              <div className="space-y-3 text-sm">
		                {activityEvents.map((event) => (
		                  <div key={event.key} className="flex items-start gap-2">
		                    <span className="mt-0.5">
		                      {event.key === "completed" ? (
		                        <CheckCircle className="h-3 w-3 text-emerald-600" />
		                      ) : (
		                        <Clock className="h-3 w-3 text-slate-400" />
		                      )}
		                    </span>
		                    <div>
		                      <div className="flex flex-wrap items-center gap-2">
		                        <span className="font-medium text-slate-900">
		                          {event.label}
		                        </span>
		                        {event.timestamp && (
		                          <span className="text-xs text-muted-foreground">
		                            {new Date(event.timestamp).toLocaleString()}
		                          </span>
		                        )}
		                      </div>
		                      {event.description && (
		                        <p className="text-sm text-muted-foreground">
		                          {event.description}
		                        </p>
		                      )}
		                    </div>
		                  </div>
		                ))}
		              </div>
		            </div>
		          )}
        </div>

	        <DialogFooter className="flex gap-2 justify-between">
	          <div className="flex gap-2">
	            {onSendAgent && status !== 'completed' && (
	              <Button
	                variant="outline"
	                onClick={() => setShowSendAgentDialog(true)}
	                className="flex items-center gap-2"
	              >
	                <Zap className="h-4 w-4" />
	                Send Agent
	              </Button>
	            )}
	          </div>
	          <div className="flex gap-2">
	            {onDeleteTask && (
	              <Button
	                variant="outline"
	                className="border-red-200 text-red-700 hover:bg-red-50"
	                onClick={() => {
	                  if (window.confirm("Delete this task? This cannot be undone.")) {
	                    onDeleteTask(task.id);
	                  }
	                }}
	              >
	                Delete
	              </Button>
	            )}
	            <Button variant="outline" onClick={onClose}>
	              Cancel
	            </Button>
	            <Button onClick={handleSave} disabled={!isResolutionValid}>
	              Save Changes
	            </Button>
	          </div>
	        </DialogFooter>

        {/* Send Agent Dialog */}
        {onSendAgent && (
          <SendAgentDialog
            task={task}
            isOpen={showSendAgentDialog}
            onClose={() => setShowSendAgentDialog(false)}
            onSend={(t, agentType, instructions) => {
              onSendAgent(t, agentType, instructions);
              setShowSendAgentDialog(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

