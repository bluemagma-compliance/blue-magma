package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterPolicyTemplateRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewPolicyTemplateHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/policy-template
	// Note: RestOrgCheckMiddleware is already applied at the org_group level in main.go
	group := apiOrgGroup.Group("/project/:project_id/policy-template")

	group.Get("/", middleware.RequireRole("user"), h.GetPolicyTemplates)
	group.Get("/:policy_id", middleware.RequireRole("user"), h.GetPolicyTemplate)
	group.Post("/", middleware.RequireRole("admin"), h.CreatePolicyTemplate)
	group.Put("/:policy_id", middleware.RequireRole("admin"), h.UpdatePolicyTemplate)
	group.Delete("/:policy_id", middleware.RequireRole("admin"), h.DeletePolicyTemplate)
}
