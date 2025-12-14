"use client";

import type React from "react";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  inviteUser,
  changeUserRole,
  type User,
} from "@/app/settings/user-actions";
import { UserPermissions } from "@/app/settings/permissions-actions";

interface UserManagementCardProps {
  currentUsers: User[];
  permissions: UserPermissions | null;
  currentUserId?: string;
}

export function UserManagementCard({
  currentUsers,
  permissions,
  currentUserId,
}: UserManagementCardProps) {
  // Filter out current user from the list
  const filteredUsers = currentUsers.filter(
    (user) => user.id !== currentUserId,
  );
  const [users, setUsers] = useState<User[]>(filteredUsers);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Edit user state
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserRole, setEditUserRole] = useState("");
  const [isEditingUser, setIsEditingUser] = useState(false);

  // Helper functions for role-based access
  const canCreateUsers = permissions?.can_create_users || false;
  const canDeleteUsers = permissions?.can_delete_users || false;
  const canAssignAnyRole = permissions?.can_assign_any_role || false;
  const canAssignBelowAdmin = permissions?.can_assign_below_admin || false;
  const canModifyAdmins = permissions?.can_modify_admins || false;
  const canModifyOwners = permissions?.can_modify_owners || false;

  // Get available roles based on permissions
  const getAvailableRoles = () => {
    const roles = [];

    // Everyone can assign 'user' role if they can create users
    if (canCreateUsers) {
      roles.push({ value: "user", label: "User" });
    }

    // Legal and above can assign legal role
    if (canAssignBelowAdmin || canAssignAnyRole) {
      roles.push({ value: "legal", label: "Legal Team" });
    }

    // Only owners and admins can assign admin role
    if (
      canAssignAnyRole ||
      (canAssignBelowAdmin && permissions?.current_role === "admin")
    ) {
      roles.push({ value: "admin", label: "Administrator" });
    }

    // Only owners can assign owner role
    if (canAssignAnyRole && permissions?.current_role === "owner") {
      roles.push({ value: "owner", label: "Owner" });
    }

    return roles;
  };

  // Check if current user can modify a specific user
  const canModifyUser = (targetUser: User) => {
    if (!permissions) return false;

    const currentRole = permissions.current_role;
    const targetRole = targetUser.role;

    // Owners can modify anyone except other owners (unless they can modify owners)
    if (currentRole === "owner") {
      return targetRole !== "owner" || canModifyOwners;
    }

    // Admins can modify users and legal, but not other admins or owners
    if (currentRole === "admin") {
      return (
        ["user", "legal"].includes(targetRole) ||
        (targetRole === "admin" && canModifyAdmins)
      );
    }

    // Legal and users cannot modify anyone
    return false;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) {
      toast.error("Email required", {
        description: "Please enter an email address.",
      });
      return;
    }
    setIsAddingUser(true);
    try {
      await inviteUser(newUserEmail, newUserRole);
      toast.success("User Invited", {
        description: `${newUserEmail} has been invited as a ${getRoleDisplayName(
          newUserRole,
        )}.`,
      });
      setIsAddUserDialogOpen(false);
      setNewUserEmail("");
      setNewUserRole("user");
      // Refresh the page to show updated user list
      window.location.reload();
    } catch (error) {
      toast.error("Failed to invite user", {
        description:
          error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsEditingUser(true);
    try {
      await changeUserRole(editingUser.id, editUserRole);
      toast.success("User role updated", {
        description: "The user's role has been successfully changed.",
      });
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      setEditUserRole("");
      // Refresh the page to show updated user list
      window.location.reload();
    } catch (error) {
      toast.error("Failed to update user role", {
        description:
          error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsEditingUser(false);
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditUserRole(user.role);
    setIsEditUserDialogOpen(true);
  };

  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case "owner":
        return "Owner";
      case "admin":
        return "Administrator";
      case "legal":
        return "Legal Team";
      case "user":
        return "User";
      default:
        return role;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Invite new users and manage existing members of your organization.
            </CardDescription>
          </div>
          {canCreateUsers && (
            <Dialog
              open={isAddUserDialogOpen}
              onOpenChange={setIsAddUserDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    Enter the email address and assign a role for the new user.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddUser} className="space-y-4 py-4">
                  <div className="space-y-1">
                    <Label htmlFor="newUserEmail">Email Address</Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="newUserRole">Role</Label>
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger id="newUserRole">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableRoles().map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddUserDialogOpen(false)}
                      disabled={isAddingUser}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isAddingUser}>
                      {isAddingUser ? "Inviting..." : "Send Invite"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      {/* Edit User Dialog */}
      <Dialog
        open={isEditUserDialogOpen}
        onOpenChange={setIsEditUserDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingUser?.name} ({editingUser?.email})
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="editUserRole">Role</Label>
              <Select value={editUserRole} onValueChange={setEditUserRole}>
                <SelectTrigger id="editUserRole">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableRoles().map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditUserDialogOpen(false)}
                disabled={isEditingUser}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isEditingUser}>
                {isEditingUser ? "Updating..." : "Update Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <CardContent>
        {users.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      {canModifyUser(user) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                        >
                          Edit
                        </Button>
                      )}
                      {canDeleteUsers && canModifyUser(user) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            // For now, just show a toast - you can implement user deletion later
                            toast.info("Remove user functionality", {
                              description:
                                "User removal will be implemented in a future update.",
                            });
                          }}
                        >
                          Remove
                        </Button>
                      )}
                      {!canModifyUser(user) && (
                        <span className="text-xs text-muted-foreground px-2 py-1">
                          No access
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">
            {canCreateUsers
              ? "No users found. Invite your first team member!"
              : "No users to display."}
          </p>
        )}

        {/* Permission notice */}
        {permissions && (
          <div className="mt-4 p-3 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground">
              <strong>Your permissions:</strong>{" "}
              {canCreateUsers && "Create users"}
              {canCreateUsers && canDeleteUsers && ", "}
              {canDeleteUsers && "Delete users"}
              {(canCreateUsers || canDeleteUsers) && canAssignAnyRole && ", "}
              {canAssignAnyRole && "Assign any role"}
              {!canCreateUsers &&
                !canDeleteUsers &&
                !canAssignAnyRole &&
                "View only"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
