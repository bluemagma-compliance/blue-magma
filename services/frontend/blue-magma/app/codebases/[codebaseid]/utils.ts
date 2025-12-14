import { CodebaseVersion } from "@/types/api";

export function getVersionNumber(version: CodebaseVersion) {
  const commitHash = version.commit_hash?.substring(0, 8);
  if (!commitHash) return version.branch_name || "main";
  return `${version.branch_name || "main"}@${commitHash}`;
}
