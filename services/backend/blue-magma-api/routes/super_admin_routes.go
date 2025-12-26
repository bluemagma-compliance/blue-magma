package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterSuperAdminRoutes registers all super admin routes
// These routes are separate from regular user routes and have their own authentication
func RegisterSuperAdminRoutes(app *fiber.App, db *gorm.DB) {
	// Create super admin auth handler
	authHandler := &handlers.SuperAdminAuthHandler{
		DB:           db,
		EmailService: services.NewEmailService(),
	}

	// Super admin group - no authentication required for auth endpoints
	superAdminGroup := app.Group("/super-admin")

	// Authentication endpoints (public - no middleware)
	authGroup := superAdminGroup.Group("/auth")
	authGroup.Post("/login", authHandler.HandleSuperAdminLogin)
	authGroup.Post("/verify-2fa", authHandler.HandleSuperAdminVerify2FA)

	// Protected super admin endpoints (require super admin JWT)
	// Future endpoints will be added here with the super admin middleware
	protectedGroup := superAdminGroup.Group("/api")
	protectedGroup.Use(middleware.AuthenticateSuperAdmin(db))
	protectedGroup.Use(middleware.RequireSuperAdmin())

	// Example protected endpoint (can be removed or used for testing)
	protectedGroup.Get("/status", func(c *fiber.Ctx) error {
		ctx := middleware.GetSuperAdminContext(c)
		return c.JSON(fiber.Map{
			"message":          "Super admin authenticated",
			"login_identifier": ctx.LoginIdentifier,
			"origin_ip":        ctx.OriginIP,
		})
	})

	// Future super admin endpoints will be registered here
	// Example:
	// protectedGroup.Get("/users", superAdminHandler.ListAllUsers)
	// protectedGroup.Get("/organizations", superAdminHandler.ListAllOrganizations)
	// protectedGroup.Post("/system/maintenance", superAdminHandler.EnableMaintenanceMode)
}

