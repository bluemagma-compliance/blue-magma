package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterCommitmentPublicRoutes registers the unauthenticated public
// commitment endpoint. This must be called before auth middleware is applied
// to /api/v1.
func RegisterCommitmentPublicRoutes(app *fiber.App, db *gorm.DB) {
	h := handlers.NewCommitmentHandler(db)
	app.Get("/api/v1/public/commitment", h.GetPublicCommitment)
}

// RegisterCommitmentRoutes registers the authenticated, org-scoped commitment
// preview endpoint so users can see what will be shared before enabling
// ShareCommitment.
func RegisterCommitmentRoutes(orgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewCommitmentHandler(db)
	orgGroup.Get("/commitment/preview", middleware.RequireRole("user"), h.GetPrivateCommitmentPreview)
}
