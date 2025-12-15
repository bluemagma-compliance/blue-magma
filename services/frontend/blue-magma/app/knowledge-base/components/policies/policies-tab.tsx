"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  FileText,
  Upload,
  Download,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddPolicyModal } from "./add-policy-modal";
import { mockPolicies } from "../../mock-data";
import type { MockPolicy } from "../../types";

export function PoliciesTab() {
  const [policies, setPolicies] = useState<MockPolicy[]>(mockPolicies);
  const [filteredPolicies, setFilteredPolicies] = useState<MockPolicy[]>(mockPolicies);
  const [searchTerm, setSearchTerm] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");

  // Filter policies based on search term and filters
  useEffect(() => {
    let filtered = policies;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (policy) =>
          policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          policy.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (policy.author && policy.author.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // File type filter
    if (fileTypeFilter !== "all") {
      filtered = filtered.filter((policy) => policy.fileType === fileTypeFilter);
    }

    setFilteredPolicies(filtered);
  }, [policies, searchTerm, fileTypeFilter]);

  const handlePolicyAdded = (newPolicy: MockPolicy) => {
    setPolicies((prev) => [...prev, newPolicy]);
  };

  const handlePolicyDeleted = (policyId: string) => {
    setPolicies((prev) => prev.filter((policy) => policy.id !== policyId));
  };

  // Get unique file types for filter
  const fileTypes = Array.from(new Set(policies.map((policy) => policy.fileType)));

  // Calculate simplified stats
  const stats = {
    total: policies.length,
    totalPages: policies.reduce((sum, policy) => sum + policy.pageCount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Simplified Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>{stats.total} documents</span>
        </div>
        <div className="flex items-center gap-2">
          <span>•</span>
          <span>{stats.totalPages} total pages</span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, author, or summary..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="File Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {fileTypes.map((fileType) => (
                  <SelectItem key={fileType} value={fileType}>
                    {fileType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AddPolicyModal onPolicyAdded={handlePolicyAdded}>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </AddPolicyModal>
      </div>

      {/* Documents Table */}
      {filteredPolicies.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pages</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPolicies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{policy.name}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {policy.summary}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        policy.fileType === "PDF"
                          ? "border-red-200 text-red-700 bg-red-50"
                          : "border-blue-200 text-blue-700 bg-blue-50"
                      }
                    >
                      {policy.fileType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {policy.pageCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {policy.author || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(policy.uploadedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handlePolicyDeleted(policy.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {searchTerm || fileTypeFilter !== "all"
                    ? "No documents found"
                    : "No documents yet"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchTerm || fileTypeFilter !== "all"
                    ? "No documents match your current filters. Try adjusting your search or filters."
                    : "Get started by uploading policy documents for your organization."}
                </p>
              </div>
              {!searchTerm && fileTypeFilter === "all" && (
                <AddPolicyModal onPolicyAdded={handlePolicyAdded}>
                  <Button size="lg">
                    <Upload className="mr-2 h-5 w-5" />
                    Upload Your First Document
                  </Button>
                </AddPolicyModal>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
