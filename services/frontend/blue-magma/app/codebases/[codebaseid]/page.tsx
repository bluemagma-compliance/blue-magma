import { Code2 } from "lucide-react";
import { SingleCodebaseOverview } from "@/components/single-codebase-overview";
import {
  CodebaseVersionWithReports,
  VersionsList,
} from "@/app/codebases/[codebaseid]/components/versions-list";
import { CodebaseChatDrawer } from "@/components/codebase-chat-drawer";
import { SettingsButton } from "@/components/settings-button";
import { getCodebaseById } from "./actions";
import { BackButton } from "@/components/back-button";
import { getComplianceReports } from "@/app/compliance-reports/actions";
import { getTemplates } from "@/app/compliance-reports/template-actions";
import { CodebaseSourceType } from "@/types/api";

export default async function SingleCodebasePage({
  params,
  searchParams,
}: {
  params: Promise<{ codebaseid: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  // Await params before accessing properties
  const { codebaseid: codebaseId } = await params;
  let codebaseSourceType: CodebaseSourceType | undefined;
  const searchParamsAwaited = await searchParams;

  if (["manual", "github"].includes(searchParamsAwaited.type || "")) {
    codebaseSourceType = searchParamsAwaited.type as CodebaseSourceType;
  }

  if (!codebaseId || !codebaseSourceType) {
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

  const codebase = await getCodebaseById(codebaseId, codebaseSourceType);

  // If codebase not found, show error page
  if (!codebase) {
    return (
      <div className="flex-1 p-8 text-center">
        <Code2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Codebase not found</h1>
        <p className="text-muted-foreground">
          The codebase with ID &quot;{codebaseId}&quot; could not be loaded.
        </p>
        <BackButton />
      </div>
    );
  }

  const reports = await getComplianceReports();
  const templates = await getTemplates();

  const templateMap = new Map(templates.map((t) => [t.object_id, t]));

  // Transform codebase versions to match component expectations
  const transformedVersions: CodebaseVersionWithReports[] =
    codebase.versions?.map((version) => ({
      ...version,
      reports: reports.filter((report) =>
        templateMap
          .get(report.template_id)
          ?.codebases?.some((cb) => cb.object_id === codebase.object_id)
      ),
    })) || [];

  // If no versions exist, show a placeholder
  const versionsToDisplay: CodebaseVersionWithReports[] =
    transformedVersions.length > 0
      ? transformedVersions
      : [
          {
            branch_name: "",
            commit_hash: "",
            object_id: "no-versions",
            summary:
              codebase.source_type === "manual"
                ? "No code versions have been ingested yet. Use the ingestion command to add your first version."
                : "No code versions have been synced yet.",
            reports: [],
          } satisfies CodebaseVersionWithReports,
        ];

  return (
    <div className="flex h-full flex-1 flex-col p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <BackButton />
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h1 className="text-3xl font-bold tracking-tight">
            {codebase.codebase_name}
          </h1>
          <div className="flex gap-2">
            <CodebaseChatDrawer
              codebaseName={codebase.codebase_name}
              codebase={codebase}
            />
            <SettingsButton codebase={codebase} />
          </div>
        </div>
        {codebase.codebase_description && (
          <p className="text-sm text-muted-foreground max-w-md">
            {codebase.codebase_description}
          </p>
        )}
      </header>

      <SingleCodebaseOverview
        versions={versionsToDisplay}
        codebase={codebase}
      />

      <div className="mt-6">
        <VersionsList versions={versionsToDisplay} />
      </div>
    </div>
  );
}
