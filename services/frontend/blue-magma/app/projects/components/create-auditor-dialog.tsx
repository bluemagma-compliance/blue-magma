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
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createAuditor } from "../actions";

interface CreateAuditorDialogProps {
  projectId: string;
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

interface Requirement {
  id: string;
  title: string;
  description: string;
  context: string;
  success_criteria: string[];
  failure_criteria: string[];
  weight: number;
}

export function CreateAuditorDialog({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}: CreateAuditorDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [schedulePreset, setSchedulePreset] = useState("manual");
  const [customSchedule, setCustomSchedule] = useState("");
  const [passingScore, setPassingScore] = useState(80);
  const [requirements, setRequirements] = useState<Requirement[]>([
    {
      id: "req-1",
      title: "",
      description: "",
      context: "",
      success_criteria: [""],
      failure_criteria: [""],
      weight: 100,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const addRequirement = () => {
    setRequirements([
      ...requirements,
      {
        id: `req-${Date.now()}`,
        title: "",
        description: "",
        context: "",
        success_criteria: [""],
        failure_criteria: [""],
        weight: 0,
      },
    ]);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const updateRequirement = <K extends keyof Requirement>(
    index: number,
    field: K,
    value: Requirement[K],
  ) => {
    const updated = [...requirements];
    updated[index] = { ...updated[index], [field]: value };
    setRequirements(updated);
  };

  const addCriteria = (reqIndex: number, type: "success_criteria" | "failure_criteria") => {
    const updated = [...requirements];
    updated[reqIndex][type] = [...updated[reqIndex][type], ""];
    setRequirements(updated);
  };

  const updateCriteria = (
    reqIndex: number,
    type: "success_criteria" | "failure_criteria",
    criteriaIndex: number,
    value: string
  ) => {
    const updated = [...requirements];
    updated[reqIndex][type][criteriaIndex] = value;
    setRequirements(updated);
  };

  const removeCriteria = (
    reqIndex: number,
    type: "success_criteria" | "failure_criteria",
    criteriaIndex: number
  ) => {
    const updated = [...requirements];
    updated[reqIndex][type] = updated[reqIndex][type].filter((_, i) => i !== criteriaIndex);
    setRequirements(updated);
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      toast.error("Please enter an auditor name");
      return;
    }

    // Filter out empty criteria
    const cleanedRequirements = requirements.map((req) => ({
      ...req,
      success_criteria: req.success_criteria.filter((c) => c.trim()),
      failure_criteria: req.failure_criteria.filter((c) => c.trim()),
    }));

    // Validate requirements
    for (const req of cleanedRequirements) {
      if (!req.title.trim()) {
        toast.error("All requirements must have a title");
        return;
      }
      if (req.success_criteria.length === 0) {
        toast.error(`Requirement "${req.title}" must have at least one success criterion`);
        return;
      }
      if (req.failure_criteria.length === 0) {
        toast.error(`Requirement "${req.title}" must have at least one failure criterion`);
        return;
      }
    }

    try {
      setIsSaving(true);

      // Determine the final schedule value
      let finalSchedule = "";
      if (schedulePreset === "custom") {
        finalSchedule = customSchedule;
      } else if (schedulePreset && schedulePreset !== "manual") {
        finalSchedule = schedulePreset;
      }

      const result = await createAuditor(projectId, {
        name,
        description,
        schedule: finalSchedule,
        is_active: isActive,
        instructions: {
          requirements: cleanedRequirements,
          passing_score: passingScore,
        },
      });

      if (result.success) {
        toast.success("Auditor created successfully");
        onSuccess();
        // Reset form
        setName("");
        setDescription("");
        setIsActive(true);
        setSchedulePreset("manual");
        setCustomSchedule("");
        setPassingScore(80);
        setRequirements([
          {
            id: "req-1",
            title: "",
            description: "",
            context: "",
            success_criteria: [""],
            failure_criteria: [""],
            weight: 100,
          },
        ]);
      } else {
        toast.error(result.error || "Failed to create auditor");
      }
    } catch (error) {
      console.error("Error creating auditor:", error);
      toast.error("Failed to create auditor");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] w-full sm:!max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Auditor</DialogTitle>
          <DialogDescription>
            Create a new compliance auditor for this project
          </DialogDescription>
        </DialogHeader>

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
                placeholder="e.g., SOC 2 Access Control Compliance Auditor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Automated auditor for SOC 2 CC6 compliance verification"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passing-score">Passing Score (0-100)</Label>
                <Input
                  id="passing-score"
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="flex items-center justify-between pt-6">
                <Label htmlFor="is-active">Active</Label>
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
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

          {/* Requirements */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Compliance Requirements</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRequirement}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Requirement
              </Button>
            </div>

            {requirements.map((req, reqIndex) => (
              <div key={req.id} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <h5 className="font-medium text-sm">Requirement #{reqIndex + 1}</h5>
                  {requirements.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRequirement(reqIndex)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>ID</Label>
                      <Input
                        value={req.id}
                        onChange={(e) => updateRequirement(reqIndex, "id", e.target.value)}
                        placeholder="e.g., cc6-1-mfa"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Weight (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={req.weight}
                        onChange={(e) =>
                          updateRequirement(reqIndex, "weight", parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={req.title}
                      onChange={(e) => updateRequirement(reqIndex, "title", e.target.value)}
                      placeholder="e.g., Multi-Factor Authentication (CC6.1)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={req.description}
                      onChange={(e) => updateRequirement(reqIndex, "description", e.target.value)}
                      placeholder="What this requirement checks"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Context</Label>
                    <Textarea
                      value={req.context}
                      onChange={(e) => updateRequirement(reqIndex, "context", e.target.value)}
                      placeholder="Additional context about what to review"
                      rows={2}
                    />
                  </div>

                  {/* Success Criteria */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-green-700">Success Criteria *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addCriteria(reqIndex, "success_criteria")}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {req.success_criteria.map((criteria, criteriaIndex) => (
                      <div key={criteriaIndex} className="flex gap-2">
                        <Input
                          value={criteria}
                          onChange={(e) =>
                            updateCriteria(reqIndex, "success_criteria", criteriaIndex, e.target.value)
                          }
                          placeholder="Success condition"
                        />
                        {req.success_criteria.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCriteria(reqIndex, "success_criteria", criteriaIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Failure Criteria */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-red-700">Failure Criteria *</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addCriteria(reqIndex, "failure_criteria")}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {req.failure_criteria.map((criteria, criteriaIndex) => (
                      <div key={criteriaIndex} className="flex gap-2">
                        <Input
                          value={criteria}
                          onChange={(e) =>
                            updateCriteria(reqIndex, "failure_criteria", criteriaIndex, e.target.value)
                          }
                          placeholder="Failure condition"
                        />
                        {req.failure_criteria.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCriteria(reqIndex, "failure_criteria", criteriaIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
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
            Create Auditor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

