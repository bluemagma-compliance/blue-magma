package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterCollectionRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewCollectionHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/collection
	group := apiOrgGroup.Group("/project/:project_id/collection")

	// Collection CRUD
	group.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetCollections)
	group.Get("/:collection_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetCollection)
	group.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.CreateCollection)
	group.Put("/:collection_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.UpdateCollection)
	group.Delete("/:collection_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), h.DeleteCollection)
}

