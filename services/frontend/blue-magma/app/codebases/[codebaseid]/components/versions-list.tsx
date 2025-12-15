import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, GitBranch, Clock } from "lucide-react";
import { CodebaseVersion, ComplianceReport } from "@/types/api";
import { getVersionNumber } from "../utils";
import { ReportsTable } from "@/components/ReportsTable";

export type CodebaseVersionWithReports = CodebaseVersion & {
  reports: ComplianceReport[];
};

function VersionCard({ version }: { version: CodebaseVersionWithReports }) {
  const versionNumber = getVersionNumber(version);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              {versionNumber}
            </CardTitle>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {version.reports.length} reports
          </Badge>
        </div>
      </CardHeader>
      {(version.summary || version.reports.length > 0) && (
        <CardContent>
          {version.summary && (
            <div className="mb-4">
              <h4 className="text-md font-medium mb-2">Summary</h4>
              <p className="text-sm text-muted-foreground">{version.summary}</p>
            </div>
          )}
          {version.reports.length > 0 ? (
            <ReportsTable reports={version.reports} />
          ) : (
            <div className="text-center py-4">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No reports generated for this version yet
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function VersionsList({
  versions,
}: {
  versions: CodebaseVersionWithReports[];
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold">Code Versions</h2>
      <div className="mt-4 space-y-4">
        {versions.map((version) => (
          <VersionCard key={version.object_id} version={version} />
        ))}
      </div>
    </div>
  );
}
