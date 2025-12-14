package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterEvidenceRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewEvidenceHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/evidence
	group := apiOrgGroup.Group("/project/:project_id/evidence")

	// Evidence CRUD
	group.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetEvidence)
	group.Get("/:evidence_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetEvidenceByID)
	group.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.CreateEvidence)
	group.Put("/:evidence_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.UpdateEvidence)
	group.Delete("/:evidence_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.DeleteEvidence)

	// Evidence verification
	group.Post("/:evidence_id/verify", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.VerifyEvidence)

	// Document-specific evidence
	documentGroup := apiOrgGroup.Group("/project/:project_id/document/:document_id/evidence")
	documentGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetDocumentEvidence)
}

