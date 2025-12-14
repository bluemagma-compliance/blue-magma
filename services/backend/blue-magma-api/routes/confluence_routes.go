package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// RegisterConfluenceIntegrationRoutes registers Confluence integration routes
func RegisterConfluenceIntegrationRoutes(apiGroup fiber.Router, apiOrgGroup *fiber.Group, db *gorm.DB, redis *redis.Client) {
	integrationHandler, err := handlers.NewConfluenceIntegrationHandler(db, redis)
	if err != nil {
		log.Errorf("Failed to create Confluence integration handler: %v", err)
		return
	}

	// OAuth callback exchange endpoint (called by frontend after Atlassian OAuth redirect)
	// Frontend receives OAuth callback from Atlassian, then calls this endpoint with code/state
	// This is NOT a direct callback from Atlassian - requires authentication
	// IMPORTANT: Register this BEFORE the org-scoped routes to avoid conflicts
	apiGroup.Post("/integrations/confluence/callback", integrationHandler.ConfluenceCallback)

	confluenceGroup := apiOrgGroup.Group("/integrations/confluence")

	// Confluence integration management routes
	confluenceGroup.Get("/:organization_id",
		middleware.RequireRole("user"),
		middleware.RestOrgCheckMiddleware(db),
		integrationHandler.GetConfluenceIntegration)

	confluenceGroup.Delete("/:organization_id",
		middleware.RequireRole("admin"),
		middleware.RestOrgCheckMiddleware(db),
		integrationHandler.DeleteConfluenceIntegration)

	confluenceGroup.Post("/:organization_id/ingest",
		middleware.RequireRole("admin"),
		middleware.RestOrgCheckMiddleware(db),
		integrationHandler.IngestConfluenceContent)

	// Generic proxy route for other Confluence endpoints
	confluenceGroup.Use("/proxy/*",
		middleware.RequireRole("user"),
		middleware.RestOrgCheckMiddleware(db),
		integrationHandler.Proxy)
}
