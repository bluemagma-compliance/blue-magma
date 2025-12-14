"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Users,
  Mail,
  Calendar,
  Shield,
  Clock,
  UserCheck,
  UserX,
  UserPlus,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
} from "lucide-react";
import { AddUserModal } from "./add-user-modal";
import { mockUsers } from "../../mock-data";
import type { MockUser } from "../../types";

export function UsersTab() {
  const [users, setUsers] = useState<MockUser[]>(mockUsers);
  const [filteredUsers, setFilteredUsers] = useState<MockUser[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Filter users based on search term and status
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.vendorRoles.some(vr => vr.vendor.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, statusFilter]);

  const handleUserAdded = (newUser: MockUser) => {
    setUsers((prev) => [...prev, newUser]);
  };

  const handleUserUpdated = (updatedUser: MockUser) => {
    setUsers((prev) => prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
  };

  const handleUserDeleted = (userId: string) => {
    setUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  // Calculate simplified stats
  const stats = {
    active: users.filter((user) => user.status === "Active").length,
    pending: users.filter((user) => user.status === "Pending").length,
  };

  return (
    <div className="space-y-6">
      {/* Simplified Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-green-600" />
          <span>{stats.active} active users</span>
        </div>
        <div className="flex items-center gap-2">
          <span>•</span>
          <Clock className="h-4 w-4 text-yellow-600" />
          <span>{stats.pending} pending invites</span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AddUserModal onUserAdded={handleUserAdded}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </AddUserModal>
      </div>

      {/* Users Table */}
      {filteredUsers.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendor Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.status === 'Active' ? 'default' : 'secondary'}
                      className={
                        user.status === 'Active'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      }
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.vendorRoles.slice(0, 2).map((role, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {role.vendor}
                        </Badge>
                      ))}
                      {user.vendorRoles.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{user.vendorRoles.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.joinedAt).toLocaleDateString()}
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
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleUserDeleted(user.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
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
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {searchTerm || statusFilter !== "all"
                    ? "No users found"
                    : "No users yet"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {searchTerm || statusFilter !== "all"
                    ? "No users match your current filters. Try adjusting your search or filters."
                    : "Get started by adding team members to your organization."}
                </p>
              </div>
              {!searchTerm && statusFilter === "all" && (
                <AddUserModal onUserAdded={handleUserAdded}>
                  <Button size="lg">
                    <Plus className="mr-2 h-5 w-5" />
                    Add Your First User
                  </Button>
                </AddUserModal>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
