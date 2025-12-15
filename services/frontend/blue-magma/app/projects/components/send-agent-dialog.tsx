"use client";

import { useState } from "react";
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
import { Zap, X } from "lucide-react";
import type { ProjectTask } from "../types";

interface SendAgentDialogProps {
  task: ProjectTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (task: ProjectTask, agentType: string, instructions: string) => void;
}

const AGENT_TYPES = [
  {
    id: 'general',
    name: 'General Auditor',
    description: 'General compliance auditor for broad assessments',
  },
  {
    id: 'security',
    name: 'Security Auditor',
    description: 'Specialized in security and access control issues',
  },
  {
    id: 'documentation',
    name: 'Documentation Auditor',
    description: 'Specialized in documentation and policy review',
  },
  {
    id: 'data',
    name: 'Data Auditor',
    description: 'Specialized in data handling and privacy issues',
  },
];

export function SendAgentDialog({
  task,
  isOpen,
  onClose,
  onSend,
}: SendAgentDialogProps) {
  const [agentType, setAgentType] = useState('general');
  const [instructions, setInstructions] = useState('');

  if (!task) return null;

  const handleSend = () => {
    onSend(task, agentType, instructions);
    setAgentType('general');
    setInstructions('');
    onClose();
  };

  const isValid = instructions.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Send Agent to Task
              </DialogTitle>
              <DialogDescription>
                Assign an AI agent to work on this task
              </DialogDescription>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <h3 className="font-semibold text-sm mb-1">{task.title}</h3>
            <p className="text-xs text-muted-foreground">{task.description}</p>
          </div>

          {/* Agent Type Selection */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Select Agent Type</h3>
            <div className="space-y-2">
              {AGENT_TYPES.map((agent) => (
                <label
                  key={agent.id}
                  className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="radio"
                    name="agent-type"
                    value={agent.id}
                    checked={agentType === agent.id}
                    onChange={(e) => setAgentType(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h3 className="font-semibold text-sm mb-2">
              Instructions for Agent *
            </h3>
            <Textarea
              placeholder="Provide specific instructions for the agent. What should it focus on? What data should it collect? Any specific requirements?"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-32"
            />
            {!isValid && (
              <p className="text-xs text-red-600 mt-1">
                Instructions are required
              </p>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              <strong>Note:</strong> The agent will work on this task and report
              back with findings. You can monitor progress in the Agent Tasks
              section.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!isValid}>
            <Zap className="mr-2 h-4 w-4" />
            Send Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

