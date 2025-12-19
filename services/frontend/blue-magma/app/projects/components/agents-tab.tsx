"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Edit2,
  Eye,
  Trash2,
  Loader2,
  Database,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { getAgents, deleteAgent } from "../actions";
import type { Agent } from "../types";
import { CreateAgentDialog } from "./create-agent-dialog";
import { EditAgentDialog } from "./edit-agent-dialog";
import { ViewAgentDetailsDialog } from "./view-agent-details-dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AgentsTabProps {
  projectId: string;
  refreshTrigger?: number;
}

export function AgentsTab({ projectId, refreshTrigger }: AgentsTabProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAgents(projectId);
      setAgents(data);
    } catch (error) {
      console.error("Error loading agents:", error);
      toast.error("Failed to load agents");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Listen for refresh events from AI chat via refreshTrigger
  useEffect(() => {
    console.log("🤖 [AgentsTab] refreshTrigger changed:", refreshTrigger);
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      console.log("🔄 [AgentsTab] Refresh signal received (trigger:", refreshTrigger, "), reloading agents...");
      loadAgents();
    }
  }, [refreshTrigger, loadAgents]);

  const handleEdit = (agent: Agent) => {
    setSelectedAgentId(agent.object_id);
    setEditDialogOpen(true);
  };

  const handleView = (agent: Agent) => {
    setSelectedAgentId(agent.object_id);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;

    try {
      setIsDeleting(true);
      const result = await deleteAgent(projectId, agentToDelete.object_id);

      if (result.success) {
        toast.success("Agent deleted successfully");
        setAgents(agents.filter((a) => a.object_id !== agentToDelete.object_id));
        setDeleteDialogOpen(false);
        setAgentToDelete(null);
      } else {
        toast.error(result.error || "Failed to delete agent");
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent");
    } finally {
      setIsDeleting(false);
    }
  };

  const getScheduleLabel = (schedule: string) => {
    const presets: Record<string, string> = {
      "0 0 * * *": "Daily",
      "0 0 * * 1": "Weekly",
      "0 0 1 * *": "Monthly",
      "0 0 1 */3 *": "Quarterly",
      manual: "Manual",
    };
    return presets[schedule] || schedule || "Manual";
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (agents.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h4 className="font-medium mb-2">No AI agents yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create AI agents to automate compliance tasks and analysis
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Agent
            </Button>
          </CardContent>
        </Card>

        <CreateAgentDialog
          projectId={projectId}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            setCreateDialogOpen(false);
            loadAgents();
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">AI Agents</h3>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Sources</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.object_id} className="hover:bg-muted/50">
                  <TableCell className="font-medium max-w-xs truncate">
                    {agent.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-sm truncate">
                    {agent.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        agent.is_active
                          ? "text-green-600 border-green-200 bg-green-50"
                          : "text-gray-600 border-gray-200 bg-gray-50"
                      }
                      variant="outline"
                    >
                      {agent.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {agent.data_sources.slice(0, 2).map((source, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {source}
                        </Badge>
                      ))}
                      {agent.data_sources.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{agent.data_sources.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {getScheduleLabel(agent.schedule)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {agent.run_count || 0}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(agent)}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(agent)}
                        title="Edit agent"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(agent)}
                        title="Delete agent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialogs */}
      <CreateAgentDialog
        projectId={projectId}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          loadAgents();
        }}
      />

      <EditAgentDialog
        projectId={projectId}
        agentId={selectedAgentId}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => {
          setEditDialogOpen(false);
          loadAgents();
        }}
      />

      <ViewAgentDetailsDialog
        projectId={projectId}
        agentId={selectedAgentId || ""}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{agentToDelete?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

