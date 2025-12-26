package middleware

import (
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/utils"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// SuperAdminAuthContext represents the authentication context for super admin requests
type SuperAdminAuthContext struct {
	IsSuperAdmin    bool
	LoginIdentifier string
	OriginIP        string
}

// AuthenticateSuperAdmin is a middleware that validates super admin JWT tokens
// It checks:
// 1. Bearer token is present and valid
// 2. Token is a valid super admin JWT
// 3. Origin IP in token matches current request IP
// 4. Super admin account is still active
func AuthenticateSuperAdmin(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		log.Debug("Super admin authentication middleware triggered")

		// Get Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			log.Warn("Super admin request missing Authorization header")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"message": "Authorization header required",
			})
		}

		// Check for Bearer token
		if !strings.HasPrefix(authHeader, "Bearer ") {
			log.Warn("Super admin request with invalid Authorization header format")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"message": "Invalid authorization format",
			})
		}

		// Extract token
		token := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate super admin token
		claims, err := authz.ParseSuperAdminToken(token)
		if err != nil {
			log.Warnf("Invalid super admin token: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "unauthorized",
				"message": "Invalid or expired token",
			})
		}

		// Get current request IP
		currentIP := utils.GetClientIP(
			c.Get("X-Forwarded-For"),
			c.Get("X-Real-IP"),
			c.Context().RemoteAddr().String(),
		)

		log.Debugf("Super admin request - Token IP: %s, Current IP: %s", claims.OriginIP, currentIP)

		// Validate origin IP matches
		if err := authz.ValidateSuperAdminTokenOrigin(claims, currentIP); err != nil {
			log.Warnf("Super admin token origin IP mismatch: %v", err)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "forbidden",
				"message": "Origin IP mismatch - token not valid from this location",
			})
		}

		// Verify super admin still exists and is active
		var superAdmin models.SuperAdmin
		if err := db.Where("login_identifier = ?", claims.LoginIdentifier).First(&superAdmin).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				log.Warnf("Super admin not found: %s", claims.LoginIdentifier)
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "unauthorized",
					"message": "Super admin account not found",
				})
			}
			log.Errorf("Database error checking super admin: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "internal_error",
				"message": "Internal server error",
			})
		}

		// Check if account is still active
		if !superAdmin.IsActive {
			log.Warnf("Inactive super admin attempted access: %s", claims.LoginIdentifier)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "forbidden",
				"message": "Super admin account is disabled",
			})
		}

		// Set super admin context
		superAdminContext := &SuperAdminAuthContext{
			IsSuperAdmin:    true,
			LoginIdentifier: claims.LoginIdentifier,
			OriginIP:        claims.OriginIP,
		}

		c.Locals("super_admin_auth", superAdminContext)

		log.Debugf("Super admin authenticated: %s from IP: %s", claims.LoginIdentifier, currentIP)

		return c.Next()
	}
}

// GetSuperAdminContext retrieves the super admin auth context from fiber locals
// Returns nil if not authenticated as super admin
func GetSuperAdminContext(c *fiber.Ctx) *SuperAdminAuthContext {
	ctx := c.Locals("super_admin_auth")
	if ctx == nil {
		return nil
	}

	superAdminCtx, ok := ctx.(*SuperAdminAuthContext)
	if !ok {
		return nil
	}

	return superAdminCtx
}

// RequireSuperAdmin is a helper middleware that ensures the request is from an authenticated super admin
// Use this after AuthenticateSuperAdmin to ensure the context is set
func RequireSuperAdmin() fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx := GetSuperAdminContext(c)
		if ctx == nil || !ctx.IsSuperAdmin {
			log.Warn("Super admin endpoint accessed without super admin authentication")
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "forbidden",
				"message": "Super admin access required",
			})
		}
		return c.Next()
	}
}

