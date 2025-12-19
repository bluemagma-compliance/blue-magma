package middleware

import (
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	log "github.com/sirupsen/logrus"
)

// OrgCheckMiddleware checks if the user belongs to the organization specified in the Url
func RestOrgCheckMiddleware(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		orgIDParam := c.Params("org_id")

		auth := c.Locals("auth").(*AuthContext)

		if auth.IsUser {
			user := c.Locals("auth").(*AuthContext).User

			if user == nil {
				log.Info("User not found in context")
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
			}

			if user.Organization.ObjectID != orgIDParam {
				log.Info("User does not belong to the organization: ", orgIDParam)
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
			}

			log.Debug("User belongs to the organization: ", orgIDParam)

			// Set organization in context for handlers to use
			c.Locals("organization", user.Organization)

			return c.Next()
		} else if auth.IsService {
			if auth.ServiceID != orgIDParam && auth.ServiceID != "service" {
				log.Info("Service does not belong to the organization: ", orgIDParam)
				return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
			}
			log.Debug("Service belongs to the organization: ", orgIDParam)

			// For service accounts, fetch the organization from DB
			var org models.Organization
			if err := db.Where("object_id = ?", orgIDParam).First(&org).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					log.Errorf("Organization not found: %s", orgIDParam)
					return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
				}
				log.Errorf("Failed to fetch organization: %v", err)
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch organization"})
			}

			// Set organization in context for handlers to use
			c.Locals("organization", org)

			return c.Next()
		}

		log.Info("User not authenticated")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})

	}
}
