package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterDataSourcesRoutes registers data sources aggregation routes
func RegisterDataSourcesRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	handler := handlers.NewDataSourcesHandler(db)

	// Data sources group
	dataSourcesGroup := apiOrgGroup.Group("/data-sources")

	// Get all data sources for an organization
	dataSourcesGroup.Get("/",
		middleware.RequireRole("user"),
		middleware.RestOrgCheckMiddleware(db),
		handler.GetDataSources)
}

