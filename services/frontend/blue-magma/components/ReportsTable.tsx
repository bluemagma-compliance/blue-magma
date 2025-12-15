"use client";

import { Button } from "@/components/ui/button";
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
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Eye,
  Hourglass,
} from "lucide-react";
import Link from "next/link";
import type { ComplianceReport } from "@/types/api";

interface TemplateOverviewPageProps {
  params: Promise<{
    reportId: string; // This is actually a template ID
  }>;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "Failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "Running":
      return <Clock className="h-5 w-5 text-blue-500" />;
    case "Pending":
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <AlertTriangle className="h-5 w-5 text-gray-500" />;
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "Completed":
      return "default";
    case "Failed":
      return "destructive";
    case "Running":
      return "secondary";
    case "Pending":
      return "outline";
    default:
      return "outline";
  }
}

export function ReportsTable(props: { reports: ComplianceReport[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Report Name</TableHead>
          <TableHead>Generated</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sections</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell>
              <div className="font-medium">{report.name}</div>
              <div className="text-sm text-muted-foreground">
                {report.description || "-"}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {new Date(report.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(report.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              {report.status ? (
                <div className="flex items-center gap-2">
                  {getStatusIcon(report.status)}
                  <Badge variant={getStatusBadgeVariant(report.status)}>
                    {report.status}
                  </Badge>
                </div>
              ) : (
                <Hourglass className="text-muted-foreground w-4" />
              )}
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {report.sections?.length || 0} section
                {report.sections?.length === 1 ? "" : "s"}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/compliance-reports/report/${report.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
