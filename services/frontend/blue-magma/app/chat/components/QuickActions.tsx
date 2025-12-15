"use client";

import type { Codebase } from "@/types/api";

interface QuickActionsProps {
  onAction: (action: string, codebase?: Codebase) => void;
  selectedCodebase: Codebase | null;
  codebases: Codebase[];
}

export default function QuickActions({
  onAction,
  selectedCodebase,
  codebases,
}: QuickActionsProps) {
  const actions = [
    {
      id: "security_analysis",
      label: "Security Analysis",
      icon: "🔒",
      description: "Find vulnerabilities and security issues",
      color: "bg-red-50 hover:bg-red-100 text-red-700 border-red-200",
    },
    {
      id: "architecture_overview",
      label: "Architecture Overview",
      icon: "🏗️",
      description: "Understand codebase structure",
      color: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200",
    },
    {
      id: "compliance_check",
      label: "Compliance Check",
      icon: "✅",
      description: "Check regulatory requirements",
      color: "bg-green-50 hover:bg-green-100 text-green-700 border-green-200",
    },
    {
      id: "code_quality",
      label: "Code Quality",
      icon: "⭐",
      description: "Analyze patterns and best practices",
      color: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200",
    },
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-gray-700">Quick Actions</h3>
        {selectedCodebase && (
          <span className="text-xs text-gray-500">
            {selectedCodebase.codebase_name}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className={`px-3 py-1.5 rounded-md border transition-colors text-left flex items-center space-x-1.5 ${action.color}`}
            title={action.description}
          >
            <span className="text-sm">{action.icon}</span>
            <span className="font-medium text-xs">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Additional actions for multiple codebases - more compact */}
      {codebases.length > 1 && !selectedCodebase && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap gap-1">
            {codebases.slice(0, 2).map((codebase) => (
              <button
                key={codebase.object_id}
                onClick={() => onAction("security_analysis", codebase)}
                className="text-xs px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                title={`Security analysis for ${codebase.codebase_name}`}
              >
                🔒 {codebase.codebase_name.length > 12 ? codebase.codebase_name.substring(0, 12) + '...' : codebase.codebase_name}
              </button>
            ))}
            {codebases.length > 2 && (
              <span className="text-xs text-gray-400 px-1 py-1">
                +{codebases.length - 2}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
