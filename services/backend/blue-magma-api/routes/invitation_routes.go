package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterInvitationRoutes(app *fiber.App, apiOrgGroup *fiber.Group, db *gorm.DB) {
	emailService := services.NewEmailService()
	invitationHandler := &handlers.InvitationHandler{
		DB:           db,
		EmailService: emailService,
	}

	// Organization-scoped invitation routes
	userGroup := apiOrgGroup.Group("/users")
	userGroup.Post("/invite",
		middleware.RequireUserInvitationPermission(db),
		middleware.RestOrgCheckMiddleware(db),
		invitationHandler.SendInvitation)

	// Public invitation routes (no auth required)
	auth := app.Group("/auth")
	auth.Get("/invitation/:token/validate", invitationHandler.ValidateInvitation)
	auth.Post("/invitation/accept", invitationHandler.AcceptInvitation)
}
