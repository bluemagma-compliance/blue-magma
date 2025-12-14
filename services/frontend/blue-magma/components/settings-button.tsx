import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import type { Codebase } from "@/types/api";

interface SettingsButtonProps {
  codebase: Codebase;
}

export function SettingsButton({ codebase }: SettingsButtonProps) {
  return (
    <Link
      href={`/codebases/${codebase.object_id}/settings?type=${codebase.source_type}`}
    >
      <Button variant="outline">
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </Button>
    </Link>
  );
}
