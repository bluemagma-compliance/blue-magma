"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ManualCodebaseForm } from "./manual-codebase-form";
import type { Codebase } from "@/types/api";
import type { AddCodebaseTab } from "../../types";

interface EnhancedAddCodebaseModalProps {
  onCodebaseAdded: (codebase: Codebase) => void;
  children: React.ReactNode;
}

export function EnhancedAddCodebaseModal({
  onCodebaseAdded,
  children,
}: EnhancedAddCodebaseModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AddCodebaseTab>("manual");

  const handleCodebaseAdded = (codebase: Codebase) => {
    onCodebaseAdded(codebase);
    setIsOpen(false);
    setActiveTab("manual"); // Reset to manual tab
  };

  const handleClose = () => {
    setIsOpen(false);
    setActiveTab("manual"); // Reset to manual tab
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Codebase</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ManualCodebaseForm
            onCodebaseAdded={handleCodebaseAdded}
            onClose={handleClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
