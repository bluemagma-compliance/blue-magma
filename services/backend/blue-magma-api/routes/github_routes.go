package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// RegisterGitHubIntegrationRoutes registers GitHub integration routes
func RegisterGitHubIntegrationRoutes(apiOrgGroup *fiber.Group, db *gorm.DB, redis *redis.Client) {
	integrationHandler, err := handlers.NewGitHubIntegrationHandler(db, redis)
	if err != nil {
		log.Errorf("Failed to create GitHub integration handler: %v", err)
		return
	}

	githubGroup := apiOrgGroup.Group("/integrations/github")

	// Installation management routes
	githubGroup.Post("/install/session",
		middleware.RequireRole("admin"),
		middleware.RestOrgCheckMiddleware(db),
		integrationHandler.StartInstallation)

	githubGroup.Use("/proxy/*",
		middleware.RequireRole("user"),
		middleware.RestOrgCheckMiddleware(db),
		integrationHandler.Proxy)
}

// RegisterGitHubWebhookRoutes registers GitHub webhook routes (public, no auth)
// These routes must be registered BEFORE the authenticated /api/v1 group to avoid auth middleware
func RegisterGitHubWebhookRoutes(app *fiber.App, db *gorm.DB, redis *redis.Client) {
	integrationHandler, err := handlers.NewGitHubIntegrationHandler(db, redis)
	if err != nil {
		log.Errorf("Failed to create GitHub integration handler for callback: %v", err)
		return
	}

	// Register public endpoints directly on app (no /api/v1 prefix to avoid auth middleware)
	app.Get("/api/v1/integrations/github/setup", integrationHandler.CompleteInstallation)
}
