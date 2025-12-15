package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type RoleManagementHandler struct {
	DB *gorm.DB
}

type AssignableRolesResponse struct {
	Roles []RoleInfo `json:"roles"`
}

type RoleInfo struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	Level       int    `json:"hierarchy_level"`
}

// GetAssignableRoles returns the roles that the current user can assign to others
// @Summary Get assignable roles
// @Description Get list of roles that the current user can assign to other users
// @Tags Role Management
// @Accept json
// @Produce json
// @Security Bearer
// @Param org_id path string true "Organization ID"
// @Success 200 {object} AssignableRolesResponse
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/org/{org_id}/roles/assignable [get]
func (h *RoleManagementHandler) GetAssignableRoles(c *fiber.Ctx) error {
	auth := c.Locals("auth").(*middleware.AuthContext)
	if !auth.IsUser {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Get assignable roles for the current user
	assignableRoleNames, err := authz.GetAssignableRoles(h.DB, auth.User.ID, auth.User.OrganizationID)
	if err != nil {
		log.Errorf("Failed to get assignable roles for user %d: %v", auth.User.ID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to get assignable roles",
		})
	}

	if len(assignableRoleNames) == 0 {
		return c.JSON(AssignableRolesResponse{Roles: []RoleInfo{}})
	}

	// Single query to get all role information
	var dbRoles []models.Role
	if err := h.DB.Where("name IN ? AND is_active = ?", assignableRoleNames, true).
		Select("name, description, hierarchy_level").
		Find(&dbRoles).Error; err != nil {
		log.Errorf("Failed to fetch role details: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch role details",
		})
	}

	// Convert to response format
	roles := make([]RoleInfo, len(dbRoles))
	for i, role := range dbRoles {
		roles[i] = RoleInfo{
			Name:        role.Name,
			DisplayName: getDisplayName(role.Name),
			Description: role.Description,
			Level:       role.HierarchyLevel,
		}
	}

	return c.JSON(AssignableRolesResponse{
		Roles: roles,
	})
}

// GetUserPermissions returns the current user's permissions for role management
// @Summary Get user permissions
// @Description Get the current user's role management permissions
// @Tags Role Management
// @Accept json
// @Produce json
// @Security Bearer
// @Param org_id path string true "Organization ID"
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/org/{org_id}/roles/permissions [get]
func (h *RoleManagementHandler) GetUserPermissions(c *fiber.Ctx) error {
	auth := c.Locals("auth").(*middleware.AuthContext)
	if !auth.IsUser {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Use role from JWT token for better performance
	userRole := auth.UserRole
	if userRole == "" {
		// Fallback to database lookup if not in token
		userRole = auth.User.GetPrimaryRole(auth.User.OrganizationID)
	}

	// Get hierarchy level using the proper service
	hierarchyLevel, err := authz.GetHierarchyService().GetRoleLevel(userRole)
	if err != nil {
		log.Errorf("Failed to get hierarchy level for role %s: %v", userRole, err)
		hierarchyLevel = 0 // Default to 0 if we can't get the level
	}

	// Role-based permissions (no database lookups needed)
	permissions := map[string]interface{}{
		"current_role":           userRole,
		"hierarchy_level":        hierarchyLevel,
		"can_create_users":       hierarchyLevel >= 3, // admin and above
		"can_delete_users":       hierarchyLevel >= 3, // admin and above
		"can_assign_any_role":    hierarchyLevel >= 4, // owner only
		"can_assign_below_admin": hierarchyLevel >= 3, // admin and above
		"can_modify_admins":      hierarchyLevel >= 4, // owner only
		"can_modify_owners":      hierarchyLevel >= 4, // owner only
	}

	return c.JSON(permissions)
}

// Helper function to get display names for roles
func getDisplayName(roleName string) string {
	switch roleName {
	case "owner":
		return "Owner"
	case "admin":
		return "Administrator"
	case "legal":
		return "Legal Team"
	case "user":
		return "User"
	default:
		return roleName
	}
}
