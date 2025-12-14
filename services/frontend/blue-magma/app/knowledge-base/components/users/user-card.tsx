"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Mail,
  Calendar,
  Clock,
  UserCheck,
  MoreHorizontal,
  Edit,
  Trash2,
  UserMinus,
  UserPlus,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import type { MockUser } from "../../types";

interface UserCardProps {
  user: MockUser;
  onUserUpdated: (user: MockUser) => void;
  onUserDeleted: (userId: string) => void;
}

export function UserCard({ user, onUserUpdated, onUserDeleted }: UserCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return (
          <Badge variant="outline" className="text-green-600 border-green-500">
            <UserCheck className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "Pending":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-500">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVendorBadgeColor = (vendor: string) => {
    const colors: Record<string, string> = {
      GitHub: "bg-gray-900 text-white",
      AWS: "bg-orange-100 text-orange-800",
      Jira: "bg-blue-100 text-blue-800",
      Slack: "bg-purple-100 text-purple-800",
      Confluence: "bg-blue-100 text-blue-800",
      "Docker Hub": "bg-blue-100 text-blue-800",
    };
    return colors[vendor] || "bg-gray-100 text-gray-800";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleStatusToggle = () => {
    const newStatus = user.status === "Active" ? "Pending" : "Active";
    const updatedUser = { ...user, status: newStatus as MockUser["status"] };
    onUserUpdated(updatedUser);
    toast.success(`User ${newStatus.toLowerCase()}`);
  };

  const handleDelete = () => {
    onUserDeleted(user.id);
    setShowDeleteDialog(false);
    toast.success("User deleted successfully");
  };

  const handleResendInvite = () => {
    // Mock resend invite functionality
    toast.success("Invitation resent successfully");
  };

  return (
    <>
      <Card className="relative group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <CardDescription className="flex items-center">
                  <Mail className="mr-1 h-3 w-3" />
                  {user.email}
                </CardDescription>
              </div>
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
                <DropdownMenuItem onClick={() => toast.info("Edit user functionality coming soon")}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit User
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleStatusToggle}>
                  {user.status === "Active" ? (
                    <>
                      <UserMinus className="mr-2 h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                {user.status === "Pending" && (
                  <DropdownMenuItem onClick={handleResendInvite}>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              {getStatusBadge(user.status)}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Joined:</span>
              <span className="text-muted-foreground flex items-center">
                <Calendar className="mr-1 h-3 w-3" />
                {formatDate(user.joinedAt)}
              </span>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center">
                  <Building2 className="mr-1 h-3 w-3" />
                  Vendor Roles
                </span>
                <Badge variant="outline" className="text-xs">
                  {user.vendorRoles.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {user.vendorRoles.map((vr, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <Badge variant="secondary" className={getVendorBadgeColor(vr.vendor)}>
                      {vr.vendor}
                    </Badge>
                    <span className="text-muted-foreground">{vr.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
              The user will lose access to all resources and their data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
