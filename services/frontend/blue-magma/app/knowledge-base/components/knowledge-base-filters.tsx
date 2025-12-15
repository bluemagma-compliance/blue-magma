"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import type { DataSourceType, DataSourceSource } from "../types";

interface KnowledgeBaseFiltersProps {
  typeFilter: DataSourceType;
  sourceFilter: DataSourceSource;
  onTypeFilterChange: (type: DataSourceType) => void;
  onSourceFilterChange: (source: DataSourceSource) => void;
  availableTypes: string[];
  availableSources: string[];
  totalCount: number;
  filteredCount: number;
}

const typeLabels: Record<string, string> = {
  repo: "Repository",
  documentation: "Documentation",
  policy: "Policy",
  user: "User",
};

const sourceLabels: Record<string, string> = {
  github: "GitHub",
  confluence: "Confluence",
  internal: "Internal",
  uploaded: "Uploaded",
};

export function KnowledgeBaseFilters({
  typeFilter,
  sourceFilter,
  onTypeFilterChange,
  onSourceFilterChange,
  availableTypes,
  availableSources,
  totalCount,
  filteredCount,
}: KnowledgeBaseFiltersProps) {
  const hasActiveFilters = typeFilter !== "all" || sourceFilter !== "all";

  const handleClearFilters = () => {
    onTypeFilterChange("all");
    onSourceFilterChange("all");
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={(value) => onTypeFilterChange(value as DataSourceType)}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {typeLabels[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source Filter */}
        <Select value={sourceFilter} onValueChange={(value) => onSourceFilterChange(value as DataSourceSource)}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {availableSources.map((source) => (
              <SelectItem key={source} value={source}>
                {sourceLabels[source] || source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-9 px-2 text-xs gap-1"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Results Summary */}
      <div className="text-xs text-muted-foreground">
        {filteredCount} of {totalCount}
      </div>
    </div>
  );
}

