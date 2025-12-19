package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
)

// Role hierarchy levels (higher number = higher privilege)
var roleHierarchy = map[string]int{
	"user":  1,
	"legal": 2,
	"admin": 3,
	"owner": 4,
}

// RequireRole checks if the user has the required role or higher
func RequireRole(requiredRole string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Locals("auth").(*AuthContext)

		// Service accounts (API keys) have limited access
		if auth.IsService {
			// Only allow service accounts for basic read operations
			allowedForServices := []string{"owner", "admin", "user", "legal"}
			if !contains(allowedForServices, requiredRole) {
				log.Warnf("Service %s denied access to role-restricted endpoint requiring %s", auth.ServiceID, requiredRole)
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
					"error": "service accounts not allowed for this operation",
				})
			}
			log.Debugf("Service %s granted access to %s level endpoint", auth.ServiceID, requiredRole)
			return c.Next()
		}

		// User authentication required
		if !auth.IsUser {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		// Check if user has required role or higher
		userRoleLevel, exists := roleHierarchy[auth.UserRole]
		if !exists {
			log.Errorf("User %s has unknown role: %s", auth.User.ObjectID, auth.UserRole)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "invalid user role",
			})
		}

		requiredRoleLevel, exists := roleHierarchy[requiredRole]
		if !exists {
			log.Errorf("Unknown required role: %s", requiredRole)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "invalid role requirement",
			})
		}

		if userRoleLevel >= requiredRoleLevel {
			log.Debugf("User %s (role: %s, level: %d) granted access to %s level endpoint", 
				auth.User.ObjectID, auth.UserRole, userRoleLevel, requiredRole)
			return c.Next()
		}

		log.Warnf("User %s (role: %s, level: %d) denied access to %s level endpoint (required level: %d)", 
			auth.User.ObjectID, auth.UserRole, userRoleLevel, requiredRole, requiredRoleLevel)
		
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "insufficient role privileges",
		})
	}
}

// RequireAnyRole checks if the user has any of the specified roles or higher
func RequireAnyRole(requiredRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := c.Locals("auth").(*AuthContext)

		// Service accounts (API keys) have limited access
		if auth.IsService {
			// Only allow service accounts for basic read operations
			for _, role := range requiredRoles {
				if role == "user" {
					log.Debugf("Service %s granted access to user level endpoint", auth.ServiceID)
					return c.Next()
				}
			}
			log.Warnf("Service %s denied access to role-restricted endpoint requiring %v", auth.ServiceID, requiredRoles)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "service accounts not allowed for this operation",
			})
		}

		// User authentication required
		if !auth.IsUser {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
			})
		}

		// Check if user has any of the required roles or higher
		userRoleLevel, exists := roleHierarchy[auth.UserRole]
		if !exists {
			log.Errorf("User %s has unknown role: %s", auth.User.ObjectID, auth.UserRole)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "invalid user role",
			})
		}

		for _, requiredRole := range requiredRoles {
			requiredRoleLevel, exists := roleHierarchy[requiredRole]
			if !exists {
				log.Errorf("Unknown required role: %s", requiredRole)
				continue
			}

			if userRoleLevel >= requiredRoleLevel {
				log.Debugf("User %s (role: %s, level: %d) granted access via %s requirement", 
					auth.User.ObjectID, auth.UserRole, userRoleLevel, requiredRole)
				return c.Next()
			}
		}

		log.Warnf("User %s (role: %s, level: %d) denied access to endpoint requiring any of %v", 
			auth.User.ObjectID, auth.UserRole, userRoleLevel, requiredRoles)
		
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "insufficient role privileges",
		})
	}
}

// Helper function to check if slice contains string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if strings.EqualFold(s, item) {
			return true
		}
	}
	return false
}
