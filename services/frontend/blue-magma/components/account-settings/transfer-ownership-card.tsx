"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Send, Search } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type User } from "@/app/settings/user-actions";

interface TransferOwnershipCardProps {
  orgName: string;
  availableUsers: User[];
  currentUserId: string;
}

export function TransferOwnershipCard({
  orgName,
  availableUsers,
  currentUserId,
}: TransferOwnershipCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter out current user and get eligible users (admins and other owners)
  const eligibleUsers = availableUsers.filter(
    (user) =>
      user.id !== currentUserId &&
      (user.role === "admin" || user.role === "owner"),
  );

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return eligibleUsers;

    const query = searchQuery.toLowerCase();
    return eligibleUsers.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query),
    );
  }, [searchQuery, eligibleUsers]);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSearchQuery(`${user.name} (${user.email})`);
    setShowSuggestions(false);
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setSelectedUser(null);
    setShowSuggestions(value.length > 0);
  };

  const handleTransfer = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    try {
      // TODO: Implement actual transfer API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("Transferring ownership to:", selectedUser.email);
      toast.success("Ownership Transfer Initiated", {
        description: `Ownership of ${orgName} has been transferred to ${selectedUser.name}.`,
      });
      setSearchQuery("");
      setSelectedUser(null);
    } catch (error) {
      toast.error("Transfer failed", {
        description: "Failed to transfer ownership. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Send className="mr-2 h-5 w-5" />
          Transfer Organization Ownership
        </CardTitle>
        <CardDescription>
          Transfer ownership of this organization to another user. This action
          is critical and should be done with caution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <div className="space-y-2 relative">
            <Label htmlFor="newOwner">Search for New Owner</Label>
            {eligibleUsers.length > 0 ? (
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newOwner"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => setShowSuggestions(searchQuery.length > 0)}
                    placeholder="Search by name or email..."
                    className="pl-10"
                  />
                </div>

                {/* Search suggestions dropdown */}
                {showSuggestions && filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleUserSelect(user)}
                        className="w-full px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none border-b border-border last:border-b-0"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {user.email} • {user.role}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showSuggestions &&
                  searchQuery.length > 0 &&
                  filteredUsers.length === 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-3">
                      <p className="text-sm text-muted-foreground">
                        No eligible users found matching &quot;{searchQuery}
                        &quot;
                      </p>
                    </div>
                  )}
              </div>
            ) : (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  No eligible users found. Only administrators and other owners
                  can receive ownership.
                </p>
              </div>
            )}

            {selectedUser && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-700">
                  <strong>Selected:</strong> {selectedUser.name} (
                  {selectedUser.email}) - {selectedUser.role}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-start space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <p className="text-sm text-yellow-700">
              <strong>Warning:</strong> Transferring ownership is a permanent
              action for your account. You will lose administrative control once
              the new owner accepts. Ensure the email address is correct.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={
                  !selectedUser || isLoading || eligibleUsers.length === 0
                }
              >
                Initiate Transfer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Ownership Transfer</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to transfer ownership of{" "}
                  <strong>{orgName}</strong> to{" "}
                  <strong>{selectedUser?.name}</strong> ({selectedUser?.email})?
                  You will no longer be the owner and will lose administrative
                  privileges associated with ownership.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleTransfer}
                  disabled={isLoading}
                >
                  {isLoading ? "Transferring..." : "Yes, Transfer Ownership"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </CardContent>
    </Card>
  );
}
