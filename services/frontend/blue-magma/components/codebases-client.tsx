"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Code2, Plus } from "lucide-react";
import { CodebaseCard, CodebaseWithReport } from "@/components/codebase-card";
import { CodebaseOverviewStats } from "@/components/codebase-overview-stats";
import { cn } from "@/lib/utils";
import { AddCodebaseModal } from "@/components/add-codebase-modal";
import type { Codebase } from "@/types/api";

interface CodebasesClientProps {
  initialCodebases: CodebaseWithReport[];
}

export function CodebasesClient({ initialCodebases }: CodebasesClientProps) {
  const [codebases, setCodebases] =
    useState<CodebaseWithReport[]>(initialCodebases);

  // Callback to add a new codebase to the list
  const handleCodebaseAdded = useCallback((newCodebase: Codebase) => {
    setCodebases((prev) => [...prev, newCodebase]);
  }, []);

  return (
    <div
      className={cn(
        "flex-1 space-y-8 p-8 pt-6 min-w-0 max-w-full"
        // No background - let body's dotted pattern show through
      )}
    >
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Codebases</h2>
        <div className="flex items-center space-x-2">
          <AddCodebaseModal onCodebaseAdded={handleCodebaseAdded}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New Codebase
            </Button>
          </AddCodebaseModal>
        </div>
      </div>

      {/* Add the CodebaseOverviewStats component here */}
      <CodebaseOverviewStats codebases={codebases} />

      {codebases.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-orange-tint/20 p-12 text-center">
          <Code2 className="mb-4 h-16 w-16 text-muted-foreground/70" />
          <h3 className="text-xl font-semibold text-foreground">
            No Codebases Yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by adding your first codebase to analyze and manage.
          </p>
          <AddCodebaseModal onCodebaseAdded={handleCodebaseAdded}>
            <Button className="mt-6">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Codebase
            </Button>
          </AddCodebaseModal>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {codebases.map((codebase) => (
            <CodebaseCard key={codebase.object_id} codebase={codebase} />
          ))}
        </div>
      )}
    </div>
  );
}
