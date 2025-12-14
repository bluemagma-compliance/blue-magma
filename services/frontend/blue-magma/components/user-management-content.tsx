"use client";

import type React from "react";
import { useState, useEffect } from "react";
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
import { getOrganizationUsers } from "@/app/dashboard/actions";
import { UserOverview } from "@/types/api";

interface UserManagementContentProps {
  onClose?: () => void; // Optional: To allow parent to trigger close actions if needed
}

export function UserManagementContent({ onClose }: UserManagementContentProps) {
  const [users, setUsers] = useState<UserOverview[]>([]);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("Member");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch users when component mounts
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Use server action to fetch users (bypasses CORS)
        const users = await getOrganizationUsers();
        setUsers(users);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        setError("Failed to load users");
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) {
      toast.error("Please enter an email address.");
      return;
    }
    setIsAddingUser(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const newUser: UserOverview = {
      id: `user_${Date.now()}`,
      name: "New User (Pending Invite)",
      email: newUserEmail,
      role: newUserRole,
    };
    setUsers([...users, newUser]);
    toast.success(`${newUserEmail} has been invited as a ${newUserRole}.`);
    setIsAddingUser(false);
    setIsAddUserDialogOpen(false);
    setNewUserEmail("");
    setNewUserRole("Member");
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Users className="mr-2 h-5 w-5" />
          Manage & Invite Collaborators
        </DialogTitle>
        <DialogDescription>
          Invite new users and manage existing members of your organization.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <div className="flex justify-end mb-4">
          {/* Nested Dialog for Adding User */}
          <Dialog
            open={isAddUserDialogOpen}
            onOpenChange={setIsAddUserDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <UserPlus className="mr-2 h-4 w-4" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent
              onInteractOutside={(e) => {
                // Prevent closing outer dialog when interacting with inner
                e.preventDefault();
              }}
              className="sm:max-w-[425px]"
            >
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
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Member">Member</SelectItem>
                      <SelectItem value="BillingManager">
                        Billing Manager
                      </SelectItem>
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
        </div>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Failed to Load Users</h3>
            <p className="text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        ) : users.length > 0 ? (
          <div className="max-h-[40vh] overflow-y-auto">
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
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>{" "}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>{" "}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Team Members Yet</h3>
            <p className="text-sm">
              Invite your first team member to get started!
            </p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}
