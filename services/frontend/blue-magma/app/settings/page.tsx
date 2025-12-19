"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  User as UserIcon,
  Building,
  Trash2,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { ProfileSettingsCard } from "@/components/account-settings/profile-settings-card";
import { TransferOwnershipCard } from "@/components/account-settings/transfer-ownership-card";
import { UserManagementCard } from "@/components/account-settings/user-management-card";

import { DeleteAccountCard } from "@/components/account-settings/delete-account-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/context/AuthContext";
import {
  fetchOrganization,
  fetchUsers,
  fetchCurrentUser,
  type User,
  type Organization,
} from "@/app/settings/user-actions";

export default function GlobalSettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const {
    permissions,
    loading: permissionsLoading,
    error: permissionsError,
    canManageUsers,
    canManageOrganization,
    canDeleteOrganization,
    canTransferOwnership,
    getRoleDisplayName,
  } = usePermissions();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Fetch organization and user data
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated || !user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const [orgData, usersData, currentUser] = await Promise.all([
          fetchOrganization(),
          fetchUsers(),
          fetchCurrentUser(),
        ]);

        // Derive the current user's email from the dedicated /users/me endpoint when possible.
        let derivedEmail: string | null = currentUser?.email ?? null;

        // Fallback: try to match the current user by object_id in the org users list.
        if (!derivedEmail && user?.object_id) {
          const selfById = usersData.find((u) => u.id === user.object_id);
          if (selfById?.email) {
            derivedEmail = selfById.email;
          }
        }

        // Final fallback: if there's exactly one user in the org, assume it's the current user.
        if (!derivedEmail && usersData.length === 1 && usersData[0]?.email) {
          derivedEmail = usersData[0].email;
        }

        setCurrentUserEmail(derivedEmail);
        setOrganization(orgData);
        setUsers(usersData);
        setDataError(null);
      } catch (error) {
        console.error("Error loading settings data:", error);
        setDataError(
          error instanceof Error ? error.message : "Failed to load data",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, user]);

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Settings className="h-12 w-12 animate-spin text-primary" />
        <span className="ml-4 text-xl">Loading Settings...</span>
      </div>
    );
  }

  if (permissionsError || dataError) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Error Loading Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {permissionsError ||
                dataError ||
                "Unable to load settings. Please try refreshing the page."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Determine available tabs based on permissions
  const availableTabs = [];

  // Profile tab - available to everyone (now includes appearance)
  availableTabs.push("profile");

  // Users & Access tab - HIDDEN: Not allowing multiple users per org yet
  // if (canManageUsers()) {
  //   availableTabs.push("users");
  // }

  // Danger zone - only for owners
  if (canDeleteOrganization()) {
    availableTabs.push("danger");
  }

  const defaultTab = availableTabs[0] || "profile";

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <Settings className="mr-3 h-8 w-8 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your organization&apos;s profile, users, billing, and
              appearance.
            </p>
          </div>
          {permissions && (
            <div className="flex items-center space-x-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Your role:</span>
              <span className="font-medium">
                {getRoleDisplayName(permissions.current_role)}
              </span>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList
          className={`grid w-full mb-6 ${
            availableTabs.length === 1
              ? "grid-cols-1"
              : availableTabs.length === 2
                ? "grid-cols-2"
                : availableTabs.length === 3
                  ? "grid-cols-3"
                  : availableTabs.length === 4
                    ? "grid-cols-4"
                    : "grid-cols-5"
          }`}
        >
          {availableTabs.includes("profile") && (
            <TabsTrigger value="profile">
              <Building className="mr-2 h-4 w-4 sm:hidden md:inline-block" />{" "}
              Profile & Appearance
            </TabsTrigger>
          )}
          {availableTabs.includes("users") && (
            <TabsTrigger value="users">
              <UserIcon className="mr-2 h-4 w-4 sm:hidden md:inline-block" />{" "}
              Users & Access
            </TabsTrigger>
          )}
          {availableTabs.includes("danger") && (
            <TabsTrigger
              value="danger"
              className="text-destructive focus:ring-destructive"
            >
              <Trash2
                className="mr-2 h-4 w-4 sm:hidden md:inline-block"
                strokeWidth={2.5}
              />{" "}
              Delete Organization
            </TabsTrigger>
          )}
        </TabsList>

        {availableTabs.includes("profile") && (
          <TabsContent value="profile">
            <ProfileSettingsCard
              currentOrgName={organization?.name || ""}
              currentUserRole={permissions?.current_role}
              currentUserEmail={currentUserEmail || undefined}
            />
          </TabsContent>
        )}

        {availableTabs.includes("users") && (
          <TabsContent value="users">
            <div className="space-y-8">
              <UserManagementCard
                currentUsers={users}
                permissions={permissions}
                currentUserId={user?.object_id}
              />
              {canTransferOwnership() && (
                <>
                  <Separator />
                  <TransferOwnershipCard
                    orgName={organization?.name || ""}
                    availableUsers={users}
                    currentUserId={user?.object_id || ""}
                  />
                </>
              )}
            </div>
          </TabsContent>
        )}

        {availableTabs.includes("danger") && (
          <TabsContent value="danger">
            <DeleteAccountCard
              orgId={organization?.id || ""}
              orgName={organization?.name || ""}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
