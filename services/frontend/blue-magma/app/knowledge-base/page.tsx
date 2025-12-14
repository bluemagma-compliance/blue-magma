"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BookOpen, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsFreePlan } from "@/hooks/useFreePlan";
import { UpgradeRequiredScreen } from "@/components/upgrade-required-screen";
import { toast } from "sonner";
import { KnowledgeBaseTable } from "./components/knowledge-base-table";
import { KnowledgeBaseFilters } from "./components/knowledge-base-filters";
import { getDataSources } from "./actions";
import type { DataSource, DataSourceType, DataSourceSource } from "./types";

export default function KnowledgeBasePage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [filteredDataSources, setFilteredDataSources] = useState<DataSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<DataSourceType>("all");
  const [sourceFilter, setSourceFilter] = useState<DataSourceSource>("all");
  const [expandedTypes, setExpandedTypes] = useState<Set<DataSourceType>>(new Set());

  const { isFreePlan, loading: planLoading } = useIsFreePlan();

  // Load data sources on mount
  useEffect(() => {
    loadDataSources();
  }, []);

  // Apply filters whenever data sources or filters change
  useEffect(() => {
    let filtered = dataSources;

    if (typeFilter !== "all") {
      filtered = filtered.filter((ds) => ds.type === typeFilter);
    }

    if (sourceFilter !== "all") {
      filtered = filtered.filter((ds) => ds.source === sourceFilter);
    }

    setFilteredDataSources(filtered);
  }, [dataSources, typeFilter, sourceFilter]);

  // Calculate available types and sources from current data
  const availableTypes = useMemo(() => {
    const types = new Set(dataSources.map((ds) => ds.type));
    return Array.from(types);
  }, [dataSources]);

  const availableSources = useMemo(() => {
    const sources = new Set(dataSources.map((ds) => ds.source));
    return Array.from(sources);
  }, [dataSources]);

  const loadDataSources = async () => {
    try {
      setIsLoading(true);
      const response = await getDataSources();
      setDataSources(response.data_sources);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load knowledge base";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTypeExpansion = (type: DataSourceType) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  if (planLoading) {
    return (
      <div className="flex w-full h-full items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isFreePlan) {
    return (
      <UpgradeRequiredScreen
        featureName="Knowledge Base"
        description="Centralize your code, docs, and evidence sources in one searchable knowledge base."
      />
    );
  }

  return (
    <div className="w-full h-full p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center">
          <BookOpen className="mr-3 h-8 w-8 text-primary" />
          Knowledge Base
        </h2>
        <p className="text-muted-foreground mt-2">
          Browse your codebases, documentation, and integrated resources.
        </p>
      </div>

      {/* Filters and Connect Apps */}
      <div className="flex items-center justify-between gap-4">
        <KnowledgeBaseFilters
          typeFilter={typeFilter}
          sourceFilter={sourceFilter}
          onTypeFilterChange={setTypeFilter}
          onSourceFilterChange={setSourceFilter}
          availableTypes={availableTypes}
          availableSources={availableSources}
          totalCount={dataSources.length}
          filteredCount={filteredDataSources.length}
        />
        <Link href="/integrations">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Zap className="h-4 w-4" />
            Connect Apps
          </Button>
        </Link>
      </div>

      {/* Table */}
      <KnowledgeBaseTable
        dataSources={filteredDataSources}
        isLoading={isLoading}
        onRefresh={loadDataSources}
        expandedTypes={expandedTypes}
        onToggleTypeExpansion={toggleTypeExpansion}
      />
    </div>
  );
}
