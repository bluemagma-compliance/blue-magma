package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterPublicVisitorRoutes registers internal-only routes used by the
// agent service to track anonymous public visitor usage.
//
// These routes are protected by AuthenticateRequest middleware. The handler
// itself enforces that only the INTERNAL_API_KEY bearer token (service
// context) can access them.
func RegisterPublicVisitorRoutes(apiGroup *fiber.Group, db *gorm.DB) {
	handler := handlers.NewPublicVisitorHandler(db)
	group := apiGroup.Group("/public-visitors")

	group.Get("/:visitor_id", handler.GetVisitor)
	group.Post("/:visitor_id/track", handler.TrackVisitor)
}
