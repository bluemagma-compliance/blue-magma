package middleware

import (
	"strings"

	log "github.com/sirupsen/logrus"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/utils"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type AuthContext struct {
	IsUser         bool
	User           *models.User
	UserRole       string
	OrganizationID uint
	IsService      bool
	ServiceID      string
	Scopes         []string
}

// GetServiceToken previously lived in this package but its logic has been moved
// to utils.GetServiceToken to avoid import cycles and keep middleware depending
// on utils, not the other way around. This wrapper is kept for compatibility
// with existing code that imports middleware.GetServiceToken.
func GetServiceToken() string {
	return utils.GetServiceToken()
}

type TokenValidator interface {
	ParseUserToken(token string) (string, error)
	ParseUserClaims(token string) (*authz.UserClaims, error)
}

func AuthenticateRequest(db *gorm.DB, tv TokenValidator) fiber.Handler {
	return func(c *fiber.Ctx) error {
		auth := AuthContext{}

		log.Info("Authentication middleware triggered")

		token := c.Get("Authorization")
		log.Debug("Authorization header: ", token)
		if strings.HasPrefix(token, "Bearer ") {
			token = strings.TrimPrefix(token, "Bearer ")

			// Try service token first
			serviceToken := GetServiceToken()
			if token == serviceToken && serviceToken != "" {
				log.Debug("Service token authentication")
				auth.IsService = true
				auth.ServiceID = "service"
				c.Locals("auth", &auth)
				return c.Next()
			}

			// Try user JWT with enhanced claims
			claims, err := tv.ParseUserClaims(token)
			if err == nil {
				// Lightweight user lookup - no heavy preloading
				var user models.User
				if err := db.Preload("Organization").Where("object_id = ?", claims.UserID).First(&user).Error; err == nil {
					// Validate organization ID matches token
					if user.OrganizationID != claims.OrganizationID {
						log.Warnf("Organization ID mismatch for user %s: token=%d, db=%d",
							claims.UserID, claims.OrganizationID, user.OrganizationID)
						return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid token"})
					}

					auth.IsUser = true
					auth.User = &user
					auth.UserRole = claims.Role
					auth.OrganizationID = claims.OrganizationID
					c.Locals("auth", &auth)
					log.Debugf("User authenticated: %s (role: %s)", user.Username, claims.Role)
					return c.Next()
				}
			}

			log.Printf("Failed to parse user token: %v", err)

		} else if strings.HasPrefix(token, "APIKey ") {
			log.Info("API key authentication")
			token = strings.TrimPrefix(token, "APIKey ")
			var apiKey models.APIKey
			if err := db.Preload("Organization").Where("key = ?", token).First(&apiKey).Error; err == nil {
				auth.IsUser = false
				auth.IsService = true
				auth.ServiceID = apiKey.Organization.ObjectID
				c.Locals("auth", &auth)
				log.Debugf("API key authenticated: %s", apiKey.Name)
				return c.Next()
			} else {
				log.Printf("Failed to parse API key: %v", err)
			}

		}

		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}
}
