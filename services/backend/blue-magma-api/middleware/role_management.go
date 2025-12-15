package middleware

import (
	"strconv"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// RequireUserModificationPermission checks if the acting user can modify the target user
func RequireUserModificationPermission(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Locals("auth").(*AuthContext)
		if !auth.IsUser {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		// Get target user ID from URL parameter
		targetUserIDStr := c.Params("user_id")
		if targetUserIDStr == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "user_id parameter required",
			})
		}

		targetUserID, err := strconv.ParseUint(targetUserIDStr, 10, 32)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid user_id parameter",
			})
		}

		// Validate that the target user exists in the organization
		if err := authz.ValidateUserExists(db, uint(targetUserID), auth.User.OrganizationID); err != nil {
			log.Warnf("User %d attempted to modify invalid user %d: %v", auth.User.ID, targetUserID, err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "user not found in organization",
			})
		}

		// Check if the acting user can modify the target user
		if err := authz.CanUserModifyUser(db, auth.User.ID, uint(targetUserID), auth.User.OrganizationID); err != nil {
			log.Warnf("User %d cannot modify user %d: %v", auth.User.ID, targetUserID, err)

			switch err {
			case authz.ErrCannotModifySelf:
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "cannot modify your own user account",
				})
			case authz.ErrInsufficientHierarchy:
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "cannot modify users with equal or higher role level",
				})
			case authz.ErrInsufficientPermissions:
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "insufficient permissions to modify this user",
				})
			default:
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "failed to validate user modification permissions",
				})
			}
		}

		return c.Next()
	}
}

// RequireRoleAssignmentPermission checks if the acting user can assign a specific role
func RequireRoleAssignmentPermission(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Locals("auth").(*AuthContext)
		if !auth.IsUser {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		// Parse request body to get the role being assigned
		var requestBody struct {
			Role string `json:"role"`
		}

		if err := c.BodyParser(&requestBody); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		if requestBody.Role == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "role field is required",
			})
		}

		// Validate that the role exists and is active
		if err := authz.ValidateRoleExists(db, requestBody.Role); err != nil {
			log.Warnf("User %d attempted to assign invalid role %s: %v", auth.User.ID, requestBody.Role, err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid role specified",
			})
		}

		// Check if the acting user can assign this role
		if err := authz.CanUserAssignRole(db, auth.User.ID, auth.User.OrganizationID, requestBody.Role); err != nil {
			log.Warnf("User %d cannot assign role %s: %v", auth.User.ID, requestBody.Role, err)

			switch err {
			case authz.ErrInsufficientHierarchy:
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "cannot assign roles equal to or higher than your own",
				})
			case authz.ErrInsufficientPermissions:
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "insufficient permissions to assign this role",
				})
			default:
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "failed to validate role assignment permissions",
				})
			}
		}

		return c.Next()
	}
}

// RequireUserInvitationPermission checks if the acting user can invite someone with a specific role
func RequireUserInvitationPermission(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Locals("auth").(*AuthContext)
		if !auth.IsUser {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		// Parse request body to get the role being assigned to the invited user
		var requestBody struct {
			Role string `json:"role"`
		}

		if err := c.BodyParser(&requestBody); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}

		if requestBody.Role == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "role field is required",
			})
		}

		// Validate that the role exists and is active
		if err := authz.ValidateRoleExists(db, requestBody.Role); err != nil {
			log.Warnf("User %d attempted to invite with invalid role %s: %v", auth.User.ID, requestBody.Role, err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid role specified",
			})
		}

		// Check if the acting user can invite someone with this role
		if err := authz.CanUserInviteWithRole(db, auth.User.ID, auth.User.OrganizationID, requestBody.Role); err != nil {
			log.Warnf("User %d cannot invite user with role %s: %v", auth.User.ID, requestBody.Role, err)

			switch err {
			case authz.ErrInsufficientPermissions:
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "insufficient permissions to invite users",
				})
			case authz.ErrInsufficientHierarchy:
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "cannot invite users with roles equal to or higher than your own",
				})
			default:
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": "failed to validate invitation permissions",
				})
			}
		}

		return c.Next()
	}
}
