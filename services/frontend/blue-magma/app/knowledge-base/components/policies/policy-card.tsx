"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MoreHorizontal,
  Trash2,
  FileText,
  Calendar,
  User,
  FileType,
  HardDrive,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import type { MockPolicy } from "../../types";

interface PolicyCardProps {
  policy: MockPolicy;
  onPolicyDeleted: (policyId: string) => void;
}

export function PolicyCard({ policy, onPolicyDeleted }: PolicyCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getFileTypeBadge = (fileType: string) => {
    const colors = {
      PDF: "bg-red-100 text-red-800 border-red-200",
      DOCX: "bg-blue-100 text-blue-800 border-blue-200",
      DOC: "bg-blue-100 text-blue-800 border-blue-200",
      TXT: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return (
      <Badge variant="outline" className={colors[fileType as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        <FileType className="mr-1 h-3 w-3" />
        {fileType}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDownload = () => {
    toast.info("Download functionality coming soon");
  };

  const handleDelete = () => {
    onPolicyDeleted(policy.id);
    setShowDeleteDialog(false);
    toast.success("Policy document deleted successfully");
  };

  return (
    <>
      <Card className="relative group hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">{policy.name}</CardTitle>
              </div>
              <CardDescription className="line-clamp-2">
                {policy.summary}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownload}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">File Type:</span>
              {getFileTypeBadge(policy.fileType)}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pages:</span>
              <span className="font-medium">{policy.pageCount}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">File Size:</span>
              <span className="text-muted-foreground flex items-center">
                <HardDrive className="mr-1 h-3 w-3" />
                {policy.fileSize}
              </span>
            </div>

            {policy.author && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Author:</span>
                <span className="text-muted-foreground flex items-center">
                  <User className="mr-1 h-3 w-3" />
                  {policy.author}
                </span>
              </div>
            )}

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Uploaded:</span>
                <span className="flex items-center">
                  <Calendar className="mr-1 h-3 w-3" />
                  {formatDate(policy.uploadedAt)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{policy.name}</strong>? This action cannot be undone.
              The document will be permanently removed from your organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
