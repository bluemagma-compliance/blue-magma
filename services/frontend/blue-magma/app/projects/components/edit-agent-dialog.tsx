"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateAgent, getAgentById } from "../actions";
import type { Agent } from "../types";

interface EditAgentDialogProps {
  projectId: string;
  agentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SCHEDULE_PRESETS = [
  { label: "Manual (No Schedule)", value: "manual" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Weekly on Monday", value: "0 0 * * 1" },
  { label: "Monthly on 1st", value: "0 0 1 * *" },
  { label: "Quarterly", value: "0 0 1 */3 *" },
  { label: "Custom", value: "custom" },
];

export function EditAgentDialog({
  projectId,
  agentId,
  open,
  onOpenChange,
  onSuccess,
}: EditAgentDialogProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [schedulePreset, setSchedulePreset] = useState("manual");
  const [customSchedule, setCustomSchedule] = useState("");
  const [instructions, setInstructions] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadAgent = useCallback(async () => {
    if (!agentId) return;
    try {
      setIsLoading(true);
      const data = await getAgentById(projectId, agentId);
      if (data) {
        setAgent(data);
        setName(data.name);
        setDescription(data.description);
        setIsActive(data.is_active);
        setInstructions(data.instructions);
        setOutputFormat(data.output_format);
        setDataSources(data.data_sources);

        // Set schedule preset
        if (data.schedule) {
          const preset = SCHEDULE_PRESETS.find((p) => p.value === data.schedule);
          if (preset) {
            setSchedulePreset(preset.value);
          } else {
            setSchedulePreset("custom");
            setCustomSchedule(data.schedule);
          }
        } else {
          setSchedulePreset("manual");
        }
      }
    } catch (error) {
      console.error("Error loading agent:", error);
      toast.error("Failed to load agent");
    } finally {
      setIsLoading(false);
    }
  }, [agentId, projectId]);

  useEffect(() => {
    if (open && agentId) {
      loadAgent();
    }
  }, [open, agentId, loadAgent]);

  const addDataSource = () => {
    setDataSources([...dataSources, ""]);
  };

  const removeDataSource = (index: number) => {
    setDataSources(dataSources.filter((_, i) => i !== index));
  };

  const updateDataSource = (index: number, value: string) => {
    const updated = [...dataSources];
    updated[index] = value;
    setDataSources(updated);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter an agent name");
      return;
    }

    if (!instructions.trim()) {
      toast.error("Please enter agent instructions");
      return;
    }

    if (!outputFormat.trim()) {
      toast.error("Please enter output format");
      return;
    }

    const cleanedDataSources = dataSources.filter((ds) => ds.trim());
    if (cleanedDataSources.length === 0) {
      toast.error("Please add at least one data source");
      return;
    }

    try {
      setIsSaving(true);

      let finalSchedule = "";
      if (schedulePreset === "custom") {
        finalSchedule = customSchedule;
      } else if (schedulePreset && schedulePreset !== "manual") {
        finalSchedule = schedulePreset;
      }

      const result = await updateAgent(projectId, agentId!, {
        name,
        description,
        data_sources: cleanedDataSources,
        instructions,
        output_format: outputFormat,
        schedule: finalSchedule,
        is_active: isActive,
      });

      if (result.success) {
        toast.success("Agent updated successfully");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to update agent");
      }
    } catch (error) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] w-full sm:!max-w-[1000px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit AI Agent</DialogTitle>
          <DialogDescription>
            Update agent configuration and settings
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Basic Information</h4>

                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Security Compliance Scanner"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this agent do?"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="is-active">Active</Label>
                  <Switch
                    id="is-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>

              {/* Data Sources */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Data Sources *</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDataSource}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </div>

                <div className="space-y-2">
                  {dataSources.map((source, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={source}
                        onChange={(e) => updateDataSource(index, e.target.value)}
                        placeholder="e.g., github-repo, confluence-space"
                      />
                      {dataSources.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDataSource(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Agent Configuration</h4>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions *</Label>
                  <Textarea
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Detailed instructions for the agent..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="output-format">Output Format *</Label>
                  <Textarea
                    id="output-format"
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    placeholder="Describe the desired output format..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Schedule</h4>

                <div className="space-y-2">
                  <Label htmlFor="schedule">Run Schedule</Label>
                  <Select value={schedulePreset} onValueChange={setSchedulePreset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {schedulePreset === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-schedule">Custom Cron Schedule</Label>
                    <Input
                      id="custom-schedule"
                      value={customSchedule}
                      onChange={(e) => setCustomSchedule(e.target.value)}
                      placeholder="0 0 * * * (cron format)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use cron format: minute hour day month weekday
                    </p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">* Required fields</p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Agent
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

