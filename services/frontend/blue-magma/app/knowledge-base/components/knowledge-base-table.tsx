"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Code,
  FileText,
  Github,
  BookOpen,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { DataSource, DataSourceType } from "../types";

// Helper function to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return `${Math.floor(seconds / 2592000)}mo ago`;
}

interface KnowledgeBaseTableProps {
  dataSources: DataSource[];
  isLoading: boolean;
  onRefresh: () => void;
  expandedTypes: Set<DataSourceType>;
  onToggleTypeExpansion: (type: DataSourceType) => void;
}

export function KnowledgeBaseTable({
  dataSources,
  isLoading,
  onRefresh,
  expandedTypes,
  onToggleTypeExpansion,
}: KnowledgeBaseTableProps) {
  // Group only by concrete data source types (exclude the "all" filter value)
  type GroupedDataSourceType = Exclude<DataSourceType, "all">;

  const groupDataSourcesByType = () => {
    const grouped: Record<GroupedDataSourceType, DataSource[]> = {
      repo: [],
      documentation: [],
      policy: [],
      user: [],
    };
    dataSources.forEach((ds) => {
      if (ds.type in grouped) {
        grouped[ds.type as GroupedDataSourceType].push(ds);
      }
    });
    return Object.entries(grouped).filter(([_, sources]) => sources.length > 0) as [GroupedDataSourceType, DataSource[]][];
  };

  const getTypeIcon = (type: DataSource["type"]) => {
    switch (type) {
      case "repo":
        return <Code className="h-4 w-4 text-blue-600" />;
      case "documentation":
        return <BookOpen className="h-4 w-4 text-purple-600" />;
      case "policy":
        return <FileText className="h-4 w-4 text-orange-600" />;
      case "user":
        return <FileText className="h-4 w-4 text-gray-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getSourceIcon = (source: DataSource["source"]) => {
    switch (source) {
      case "github":
        return <Github className="h-4 w-4" />;
      case "confluence":
        return <BookOpen className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: DataSource["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="text-green-600 border-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "syncing":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-500">
            <Clock className="mr-1 h-3 w-3" />
            Syncing
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="text-red-600 border-red-500">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-500">
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeLabel = (type: DataSource["type"], plural = false) => {
    switch (type) {
      case "repo":
        return plural ? "Repositories" : "Repository";
      case "documentation":
        return plural ? "Documentation" : "Documentation";
      case "policy":
        return plural ? "Policies" : "Policy";
      case "user":
        return plural ? "Users" : "User";
      default:
        return type;
    }
  };

  const getSourceLabel = (source: DataSource["source"]) => {
    switch (source) {
      case "github":
        return "GitHub";
      case "confluence":
        return "Confluence";
      case "internal":
        return "Internal";
      case "uploaded":
        return "Uploaded";
      default:
        return source;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              <span>Loading data sources...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dataSources.length === 0) {
    return (
      <Card>
        <CardContent className="pt-8 pb-8">
          <div className="text-center space-y-4">
            <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <Code className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No data sources found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                No data sources match your current filters. Try adjusting your filters or add new data sources.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Knowledge Base</CardTitle>
          <CardDescription>
            Showing {dataSources.length} item{dataSources.length !== 1 ? "s" : ""}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {groupDataSourcesByType().map(([type, sources]) => (
            <div key={type} className="border rounded-lg">
              {/* Type Header */}
              <div className="flex items-center gap-2 p-4 bg-muted/50 hover:bg-muted cursor-pointer" onClick={() => onToggleTypeExpansion(type)}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTypeExpansion(type);
                  }}
                >
                  {expandedTypes.has(type) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
                {getTypeIcon(type as DataSource["type"])}
                <span className="font-semibold flex-1">
                  {getTypeLabel(type as DataSource["type"], true)}
                </span>
                <Badge variant="secondary">{sources.length}</Badge>
              </div>

              {/* Expanded Content */}
              {expandedTypes.has(type) && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.map((dataSource) => (
                        <TableRow key={dataSource.object_id}>
                          <TableCell className="font-medium">
                            <span>{dataSource.name}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getSourceIcon(dataSource.source)}
                              <span>{getSourceLabel(dataSource.source)}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(dataSource.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatRelativeTime(dataSource.last_updated)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

