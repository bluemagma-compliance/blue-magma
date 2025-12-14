"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateAuditor, type Auditor } from "../actions";

interface EditAuditorDialogProps {
  projectId: string;
  auditor: Auditor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// Cron schedule presets
const SCHEDULE_PRESETS = [
  { label: "Manual (No Schedule)", value: "manual" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Weekly on Monday", value: "0 0 * * 1" },
  { label: "Monthly on 1st", value: "0 0 1 * *" },
  { label: "Quarterly", value: "0 0 1 */3 *" },
  { label: "Custom", value: "custom" },
];

export function EditAuditorDialog({
  projectId,
  auditor,
  open,
  onOpenChange,
  onSuccess,
}: EditAuditorDialogProps) {
  const [name, setName] = useState(auditor.name);
  const [description, setDescription] = useState(auditor.description);
  const [isActive, setIsActive] = useState(auditor.is_active);
  const [schedulePreset, setSchedulePreset] = useState(() => {
    if (!auditor.schedule) return "manual";
    const preset = SCHEDULE_PRESETS.find((p) => p.value === auditor.schedule);
    return preset ? preset.value : "custom";
  });
  const [customSchedule, setCustomSchedule] = useState(
    SCHEDULE_PRESETS.find((p) => p.value === auditor.schedule) ? "" : auditor.schedule || ""
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Determine the final schedule value
      let finalSchedule = "";
      if (schedulePreset === "custom") {
        finalSchedule = customSchedule;
      } else if (schedulePreset && schedulePreset !== "manual") {
        finalSchedule = schedulePreset;
      }

      const result = await updateAuditor(projectId, auditor.object_id, {
        name,
        description,
        schedule: finalSchedule,
        is_active: isActive,
      });

      if (result.success) {
        toast.success("Auditor updated successfully");
        onSuccess();
      } else {
        toast.error(result.error || "Failed to update auditor");
      }
    } catch (error) {
      console.error("Error updating auditor:", error);
      toast.error("Failed to update auditor");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Auditor</DialogTitle>
          <DialogDescription>
            Update the auditor configuration and schedule
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auditor name"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Auditor description"
              rows={3}
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is-active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable this auditor
              </p>
            </div>
            <Switch
              id="is-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule</Label>
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

          {/* Custom Schedule Input */}
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

          {/* Current Schedule Display */}
          {schedulePreset && schedulePreset !== "manual" && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">Current Schedule:</p>
              <p className="text-sm text-muted-foreground font-mono">
                {schedulePreset === "custom" ? customSchedule : schedulePreset}
              </p>
            </div>
          )}
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
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

