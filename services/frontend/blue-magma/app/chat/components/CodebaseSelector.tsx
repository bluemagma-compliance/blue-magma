"use client";

import { useState } from "react";
import type { Codebase, CodebaseVersion } from "@/types/api";

interface CodebaseSelectorProps {
  codebases: Codebase[];
  selectedCodebase: Codebase | null;
  selectedVersion: CodebaseVersion | null;
  onSelect: (codebase: Codebase, version: CodebaseVersion) => void;
  onClose: () => void;
}

export default function CodebaseSelector({
  codebases,
  selectedCodebase,
  selectedVersion,
  onSelect,
  onClose,
}: CodebaseSelectorProps) {
  const [expandedCodebase, setExpandedCodebase] = useState<string | null>(
    selectedCodebase?.object_id || null
  );

  if (codebases.length === 0) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-blue-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900">
                No Codebases Available
              </h3>
              <p className="text-sm text-blue-700">
                Connect your repositories to start analyzing code with AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-800"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">
          Select Codebase & Version
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {codebases.map((codebase) => (
          <div
            key={codebase.object_id}
            className="bg-white rounded-lg border border-gray-200"
          >
            {/* Codebase header */}
            <button
              onClick={() =>
                setExpandedCodebase(
                  expandedCodebase === codebase.object_id
                    ? null
                    : codebase.object_id
                )
              }
              className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-gray-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h4a1 1 0 01.707.293L10.414 5H16a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {codebase.codebase_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {codebase.versions.length} version{codebase.versions.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transform transition-transform ${
                  expandedCodebase === codebase.object_id ? "rotate-180" : ""
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Versions list */}
            {expandedCodebase === codebase.object_id && (
              <div className="border-t border-gray-200">
                {codebase.versions.map((version) => (
                  <button
                    key={version.object_id}
                    onClick={() => onSelect(codebase, version)}
                    className={`w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center justify-between ${
                      selectedCodebase?.object_id === codebase.object_id &&
                      selectedVersion?.object_id === version.object_id
                        ? "bg-blue-50 border-l-4 border-blue-500"
                        : ""
                    }`}
                  >
                    <div className="ml-8">
                      <div className="font-medium text-gray-900">
                        {version.branch_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {version.commit_hash.substring(0, 8)} • {version.summary}
                      </div>
                    </div>
                    {selectedCodebase?.object_id === codebase.object_id &&
                      selectedVersion?.object_id === version.object_id && (
                        <div className="text-blue-600">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
