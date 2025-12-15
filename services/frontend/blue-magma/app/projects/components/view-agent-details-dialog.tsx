"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  AlertCircle,
  Calendar,
  Database,
  FileText,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { getAgentById } from "../actions";
import type { AgentDetail } from "../types";

interface ViewAgentDetailsDialogProps {
  projectId: string;
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewAgentDetailsDialog({
  projectId,
  agentId,
  open,
  onOpenChange,
}: ViewAgentDetailsDialogProps) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAgentDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAgentById(projectId, agentId);
      setAgent(data);
    } catch (error) {
      console.error("Error loading agent details:", error);
      toast.error("Failed to load agent details");
    } finally {
      setIsLoading(false);
    }
  }, [agentId, projectId]);

  useEffect(() => {
    if (open && agentId) {
      loadAgentDetails();
    }
  }, [open, agentId, loadAgentDetails]);

  const getScheduleLabel = (schedule: string) => {
    const presets: Record<string, string> = {
      "0 0 * * *": "Daily at midnight",
      "0 0 * * 1": "Weekly on Monday",
      "0 0 1 * *": "Monthly on 1st",
      "0 0 1 */3 *": "Quarterly",
      manual: "Manual",
    };
    return presets[schedule] || schedule || "Manual";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] w-full sm:!max-w-[1000px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Agent Details</DialogTitle>
          <DialogDescription>
            View agent configuration and settings
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !agent ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load agent details</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-6">
              {/* Header Info */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">{agent.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {agent.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Schedule:</span>
                    <span className="font-mono">
                      {getScheduleLabel(agent.schedule)}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      agent.is_active
                        ? "text-green-600 border-green-200 bg-green-50"
                        : "text-gray-600 border-gray-200 bg-gray-50"
                    }
                  >
                    {agent.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {agent.last_run_at && (
                  <div className="text-xs text-muted-foreground">
                    Last run: {new Date(agent.last_run_at).toLocaleString()}
                    {agent.last_status && ` - Status: ${agent.last_status}`}
                  </div>
                )}
              </div>

              <Separator />

              {/* Data Sources */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-semibold">Data Sources</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {agent.data_sources.map((source, index) => (
                    <Badge key={index} variant="secondary">
                      {source}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Instructions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-semibold">Instructions</h4>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {agent.instructions}
                </div>
              </div>

              <Separator />

              {/* Output Format */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <h4 className="font-semibold">Output Format</h4>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
                  {agent.output_format}
                </div>
              </div>

              {/* Metadata */}
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Agent ID</p>
                  <p className="font-mono text-xs">{agent.object_id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Run Count</p>
                  <p className="font-semibold">{agent.run_count || 0}</p>
                </div>
                {agent.created_at && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Created</p>
                    <p className="text-xs">
                      {new Date(agent.created_at).toLocaleString()}
                    </p>
                  </div>
                )}
                {agent.updated_at && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Updated</p>
                    <p className="text-xs">
                      {new Date(agent.updated_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

