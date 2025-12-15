import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  fetchUserPermissions,
  type UserPermissions,
} from "@/app/settings/permissions-actions";

export interface RoleInfo {
  name: string;
  displayName: string;
  level: number;
}

export const usePermissions = () => {
  const { user, organizationId, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!isAuthenticated || !user || !organizationId) {
        setPermissions(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const permissionsData = await fetchUserPermissions();
        setPermissions(permissionsData);
        setError(null);
      } catch (err) {
        console.error("Error fetching permissions:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch permissions",
        );
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [isAuthenticated, user, organizationId]);

  // Helper functions for common permission checks
  const isOwner = () => permissions?.current_role === "owner";
  const isAdmin = () => permissions?.current_role === "admin";
  const isLegal = () => permissions?.current_role === "legal";
  const isUser = () => permissions?.current_role === "user";

  const canManageUsers = () =>
    permissions?.can_create_users || permissions?.can_delete_users;
  const canManageOrganization = () => isOwner() || isAdmin();
  const canViewBilling = () => isOwner() || isAdmin();
  const canDeleteOrganization = () => isOwner();
  const canTransferOwnership = () => isOwner();

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

  return {
    permissions,
    loading,
    error,
    // Role checks
    isOwner,
    isAdmin,
    isLegal,
    isUser,
    // Permission checks
    canManageUsers,
    canManageOrganization,
    canViewBilling,
    canDeleteOrganization,
    canTransferOwnership,
    // Utilities
    getRoleDisplayName,
  };
};
