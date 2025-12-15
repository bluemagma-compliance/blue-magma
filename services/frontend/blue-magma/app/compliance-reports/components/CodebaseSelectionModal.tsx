import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Play } from "lucide-react";
import type { Codebase } from "@/types/api";

interface CodebaseSelectionModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  codebases: Codebase[];
  selectedCodebases: string[];
  setSelectedCodebases: (codebases: string[]) => void;
  isActivating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const CodebaseSelectionModal: React.FC<CodebaseSelectionModalProps> = ({
  isOpen,
  onOpenChange,
  codebases,
  selectedCodebases,
  setSelectedCodebases,
  isActivating,
  onCancel,
  onConfirm,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select Codebases for Template</DialogTitle>
          <DialogDescription>
            Choose which codebases this template should apply to. You can change
            this later by editing the template.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {codebases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No codebases available</p>
              <p className="text-sm mt-1">
                Add a codebase first to use templates
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <Label className="text-sm font-medium">Available Codebases</Label>
              {codebases.map((codebase) => {
                const isSelected = selectedCodebases.includes(
                  codebase.object_id,
                );

                return (
                  <div
                    key={codebase.object_id}
                    className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`modal-codebase-${codebase.object_id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCodebases([
                            ...selectedCodebases,
                            codebase.object_id,
                          ]);
                        } else {
                          setSelectedCodebases(
                            selectedCodebases.filter(
                              (id) => id !== codebase.object_id,
                            ),
                          );
                        }
                      }}
                    />
                    <Label
                      htmlFor={`modal-codebase-${codebase.object_id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div>
                        <div className="font-medium">
                          {codebase.codebase_name}
                        </div>
                        {codebase.codebase_description && (
                          <div className="text-xs text-muted-foreground">
                            {codebase.codebase_description}
                          </div>
                        )}
                      </div>
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isActivating}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isActivating || codebases.length === 0}
          >
            {isActivating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Activating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Activate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
