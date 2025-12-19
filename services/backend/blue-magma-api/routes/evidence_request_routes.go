package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterEvidenceRequestRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewEvidenceRequestHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/evidence-request
	group := apiOrgGroup.Group("/project/:project_id/evidence-request")

	// Evidence Request CRUD
	group.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetEvidenceRequests)
	group.Get("/:request_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetEvidenceRequest)
	group.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.CreateEvidenceRequest)
	group.Put("/:request_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.UpdateEvidenceRequest)
	group.Delete("/:request_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.DeleteEvidenceRequest)

	// Fulfillment and rejection
	group.Post("/:request_id/fulfill", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.FulfillEvidenceRequest)
	group.Post("/:request_id/reject", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.RejectEvidenceRequest)

	// Document-specific evidence requests
	documentGroup := apiOrgGroup.Group("/project/:project_id/document/:document_id/evidence-request")
	documentGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetDocumentEvidenceRequests)
}

