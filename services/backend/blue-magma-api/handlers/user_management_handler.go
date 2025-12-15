package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type UserManagementHandler struct {
	DB *gorm.DB
}

type ChangeRoleRequest struct {
	Role string `json:"role" validate:"required"`
}

type UserListResponse struct {
	Users []UserInfo `json:"users"`
}

type UserInfo struct {
	ID               uint       `json:"id"`
	ObjectID         string     `json:"object_id"`
	FirstName        string     `json:"first_name"`
	LastName         string     `json:"last_name"`
	Email            string     `json:"email"`
	Username         string     `json:"username"`
	Role             string     `json:"role"`
	HierarchyLevel   int        `json:"hierarchy_level"`
	IsActive         bool       `json:"is_active"`
	InvitationStatus string     `json:"invitation_status,omitempty"` // pending, accepted, expired
	InvitedAt        *time.Time `json:"invited_at,omitempty"`
	AcceptedAt       *time.Time `json:"accepted_at,omitempty"`
}

// ListUsers returns all users in the organization
// @Summary List organization users
// @Description Get list of all users in the organization
// @Tags User Management
// @Accept json
// @Produce json
// @Security Bearer
// @Param org_id path string true "Organization ID"
// @Success 200 {object} UserListResponse
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/org/{org_id}/users [get]
func (h *UserManagementHandler) ListUsers(c *fiber.Ctx) error {
	auth := c.Locals("auth").(*middleware.AuthContext)
	if !auth.IsUser {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Get all users in the organization with their roles
	var users []models.User
	if err := h.DB.Preload("UserRoles.Role").
		Where("organization_id = ?", auth.User.OrganizationID).
		Find(&users).Error; err != nil {
		log.Errorf("Failed to fetch users: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch users",
		})
	}

	// Get current user's role and hierarchy level for filtering
	currentUserRole := auth.User.GetPrimaryRole(auth.User.OrganizationID)
	currentUserLevel := 0
	if currentUserRole != "" {
		if level, err := authz.GetHierarchyService().GetRoleLevel(currentUserRole); err == nil {
			currentUserLevel = level
		}
	}

	// Check if user has admin permissions to see sensitive data (legal or above)
	userRole := auth.UserRole
	if userRole == "" {
		userRole = auth.User.GetPrimaryRole(auth.User.OrganizationID)
	}
	userLevel, _ := authz.GetHierarchyService().GetRoleLevel(userRole)
	canViewSensitiveData := userLevel >= 2 // legal and above

	// Convert to response format with access control
	userInfos := make([]UserInfo, 0)
	for _, user := range users {
		role := user.GetPrimaryRole(auth.User.OrganizationID)

		// Get hierarchy level using the proper service
		hierarchyLevel := 0
		if role != "" {
			if level, err := authz.GetHierarchyService().GetRoleLevel(role); err == nil {
				hierarchyLevel = level
			}
		}

		// Apply access control - users can only see users at their level or below
		if !canViewSensitiveData && hierarchyLevel >= currentUserLevel && user.ID != auth.User.ID {
			continue // Skip users at same or higher level unless user has admin permissions
		}

		userInfo := UserInfo{
			ID:        user.ID,
			ObjectID:  user.ObjectID,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Email:     user.Email,
			Username:  user.Username,
			IsActive:  user.Verified,
		}

		// Only include sensitive fields if user has appropriate permissions
		if canViewSensitiveData {
			userInfo.Role = role
			userInfo.HierarchyLevel = hierarchyLevel
			userInfo.InvitationStatus = user.InvitationStatus
			userInfo.InvitedAt = &user.CreatedAt
			userInfo.AcceptedAt = user.InvitationAcceptedAt
		}

		userInfos = append(userInfos, userInfo)
	}

	return c.JSON(UserListResponse{
		Users: userInfos,
	})
}

// ChangeUserRole changes a user's role
// @Summary Change user role
// @Description Change the role of a specific user
// @Tags User Management
// @Accept json
// @Produce json
// @Security Bearer
// @Param org_id path string true "Organization ID"
// @Param user_id path string true "User ID"
// @Param body body ChangeRoleRequest true "Role change request"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/org/{org_id}/users/{user_id}/role [put]
func (h *UserManagementHandler) ChangeUserRole(c *fiber.Ctx) error {
	auth := c.Locals("auth").(*middleware.AuthContext)
	if !auth.IsUser {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Get target user ID from URL
	targetUserIDStr := c.Params("user_id")
	targetUserID, err := strconv.ParseUint(targetUserIDStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid user_id parameter",
		})
	}

	// Parse request body
	var req ChangeRoleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if req.Role == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "role field is required",
		})
	}

	// Validate that the role exists (additional validation in handler for defense in depth)
	if err := authz.ValidateRoleExists(h.DB, req.Role); err != nil {
		// Log security violation attempt
		if auditLogger := authz.GetAuditLogger(); auditLogger != nil {
			auditLogger.LogSecurityViolation(
				"user",
				fmt.Sprintf("%d", auth.User.ID),
				auth.User.OrganizationID,
				"invalid_role_assignment",
				fmt.Sprintf("Attempted to assign invalid role: %s", req.Role),
				c.IP(),
				c.Get("User-Agent"),
			)
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid role specified",
		})
	}

	var targetRole models.Role
	if err := h.DB.Where("name = ? AND is_active = ?", req.Role, true).First(&targetRole).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid role specified",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to validate role",
		})
	}

	// Get target user
	var targetUser models.User
	if err := h.DB.Preload("UserRoles.Role").Where("id = ?", uint(targetUserID)).First(&targetUser).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "user not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to find user",
		})
	}

	// Check if user belongs to the same organization
	if targetUser.OrganizationID != auth.User.OrganizationID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "user not in your organization",
		})
	}

	// Deactivate current role assignments
	if err := h.DB.Model(&models.UserRole{}).
		Where("user_id = ? AND organization_id = ?", targetUser.ID, auth.User.OrganizationID).
		Update("is_active", false).Error; err != nil {
		log.Errorf("Failed to deactivate old roles: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update user role",
		})
	}

	// Create new role assignment
	newUserRole := models.UserRole{
		UserID:         targetUser.ID,
		RoleID:         targetRole.ID,
		OrganizationID: auth.User.OrganizationID,
		IsActive:       true,
	}

	if err := h.DB.Create(&newUserRole).Error; err != nil {
		log.Errorf("Failed to assign new role: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to assign new role",
		})
	}

	oldRole := targetUser.GetPrimaryRole(auth.User.OrganizationID)

	// Log successful role change
	if auditLogger := authz.GetAuditLogger(); auditLogger != nil {
		auditLogger.LogRoleChange(
			"user",
			fmt.Sprintf("%d", auth.User.ID),
			auth.User.OrganizationID,
			fmt.Sprintf("%d", targetUser.ID),
			oldRole,
			req.Role,
			true,
			c.IP(),
			c.Get("User-Agent"),
		)
	}

	log.Infof("User %d changed role of user %d from %s to %s", auth.User.ID, targetUser.ID, oldRole, req.Role)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "user role updated successfully",
		"user": fiber.Map{
			"id":       targetUser.ID,
			"username": targetUser.Username,
			"old_role": oldRole,
			"new_role": req.Role,
		},
	})
}

// RemoveUser removes a user from the organization
// @Summary Remove user
// @Description Remove a user from the organization
// @Tags User Management
// @Accept json
// @Produce json
// @Security Bearer
// @Param org_id path string true "Organization ID"
// @Param user_id path string true "User ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/org/{org_id}/users/{user_id} [delete]
func (h *UserManagementHandler) RemoveUser(c *fiber.Ctx) error {
	auth := c.Locals("auth").(*middleware.AuthContext)
	if !auth.IsUser {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Get target user ID from URL
	targetUserIDStr := c.Params("user_id")
	targetUserID, err := strconv.ParseUint(targetUserIDStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid user_id parameter",
		})
	}

	// Get target user
	var targetUser models.User
	if err := h.DB.Where("id = ?", uint(targetUserID)).First(&targetUser).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "user not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to find user",
		})
	}

	// Check if user belongs to the same organization
	if targetUser.OrganizationID != auth.User.OrganizationID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "user not in your organization",
		})
	}

	// Deactivate all role assignments (soft delete approach)
	if err := h.DB.Model(&models.UserRole{}).
		Where("user_id = ? AND organization_id = ?", targetUser.ID, auth.User.OrganizationID).
		Update("is_active", false).Error; err != nil {
		log.Errorf("Failed to deactivate user roles: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to remove user",
		})
	}

	// Log successful user removal
	if auditLogger := authz.GetAuditLogger(); auditLogger != nil {
		auditLogger.LogUserModification(
			"user",
			fmt.Sprintf("%d", auth.User.ID),
			auth.User.OrganizationID,
			fmt.Sprintf("%d", targetUser.ID),
			"remove_user",
			true,
			c.IP(),
			c.Get("User-Agent"),
		)
	}

	log.Infof("User %d removed user %d from organization", auth.User.ID, targetUser.ID)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "user removed successfully",
		"removed_user": fiber.Map{
			"id":       targetUser.ID,
			"username": targetUser.Username,
		},
	})
}
