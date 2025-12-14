package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterProjectTemplateRoutes(apiGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewProjectTemplateHandler(db)

	// Base: /api/v1/project-template
	group := apiGroup.Group("/project-template")

	// Public read access (all authenticated users)
	group.Get("/", middleware.RequireRole("user"), h.GetProjectTemplates)
	group.Get("/:template_id", middleware.RequireRole("user"), h.GetProjectTemplate)
}

