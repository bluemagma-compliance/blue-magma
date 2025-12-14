import { ArrowLeft, Code2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConsolidatedSettingsCard } from "@/components/codebase-settings/consolidated-settings-card";
import { getCodebaseById } from "../actions";
import Link from "next/link";
import { CodebaseSourceType } from "@/types/api";
import { BackButton } from "@/components/back-button";

export default async function CodebaseSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ codebaseid: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { codebaseid } = await params;
  const searchParamsAwaited = await searchParams;
  let codebaseSourceType: CodebaseSourceType | undefined;

  if (["manual", "github"].includes(searchParamsAwaited.type || "")) {
    codebaseSourceType = searchParamsAwaited.type as CodebaseSourceType;
  }

  if (!codebaseid || !codebaseSourceType) {
    return (
      <div className="flex-1 p-8 text-center">
        <Code2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Invalid Codebase</h1>
        <p className="text-muted-foreground mb-4">
          The codebase ID or type is missing or invalid.
        </p>
        <BackButton />
      </div>
    );
  }

  const codebase = await getCodebaseById(codebaseid, codebaseSourceType);

  if (!codebase) {
    return (
      <div className="py-8 px-4 md:px-6 max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Error</h1>
          <p className="text-muted-foreground">Codebase not found</p>
          <Link href="/codebases">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Codebases
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 md:px-6 max-w-7xl mx-auto">
      <BackButton />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center">
          <Settings className="mr-3 h-8 w-8 text-primary" />
          Settings for {codebase.codebase_name}
        </h1>
        <p className="text-muted-foreground">
          Manage data retention and other settings for this codebase.
        </p>
      </div>

      <ConsolidatedSettingsCard
        codebaseId={codebaseid}
        codebaseName={codebase.codebase_name}
        codebase={codebase}
      />
    </div>
  );
}
