package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterDocumentRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewDocumentHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/document
	group := apiOrgGroup.Group("/project/:project_id/document")

	// Document CRUD
	group.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetDocuments)
	group.Get("/tree", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetDocumentTree)
	group.Get("/:document_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetDocument)
	group.Get("/:document_id/full", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetDocumentFull)
	group.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.CreateDocument)
	group.Put("/:document_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.UpdateDocument)
	group.Delete("/:document_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.DeleteDocument)
}
