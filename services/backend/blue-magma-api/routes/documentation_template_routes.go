package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterDocumentationTemplateRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewDocumentationTemplateHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/documentation-template
	group := apiOrgGroup.Group("/project/:project_id/documentation-template")

	group.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetDocumentationTemplate)
	group.Put("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.UpsertDocumentationTemplate)
}

