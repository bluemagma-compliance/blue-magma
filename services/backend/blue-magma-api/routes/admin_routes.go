package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers/admin"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAdminRoutes(apiGroup *fiber.Group, db *gorm.DB) {
	h := admin.NewProjectTemplateHandler(db)

	// Base: /api/v1/admin/project-template
	group := apiGroup.Group("/admin/project-template")

	// All admin routes require admin role
	group.Get("/", middleware.RequireRole("admin"), h.GetAllProjectTemplates)
	group.Get("/:template_id", middleware.RequireRole("admin"), h.GetProjectTemplate)
	group.Post("/", middleware.RequireRole("admin"), h.CreateProjectTemplate)
	group.Put("/:template_id", middleware.RequireRole("admin"), h.UpdateProjectTemplate)
	group.Delete("/:template_id", middleware.RequireRole("admin"), h.DeleteProjectTemplate)
}

