package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func RegisterAuthRoutes(app *fiber.App, db *gorm.DB, redis *redis.Client) {
	signupHandler := &handlers.SignupHandler{DB: db, Redis: redis}
	tokenHandler := &handlers.TokenHandler{DB: db}
	passwordResetHandler := &handlers.PasswordResetHandler{DB: db, Redis: redis, EmailService: services.NewEmailService()}


	auth := app.Group("/auth")
	auth.Post("/password-reset/request", passwordResetHandler.RequestPasswordReset)
	auth.Get("/password-reset/validate", passwordResetHandler.ValidatePasswordReset)
	auth.Post("/password-reset/confirm", passwordResetHandler.ConfirmPasswordReset)

	auth.Post("/signup", signupHandler.HandleSignup)
	auth.Post("/token", tokenHandler.HandleToken)
	auth.Post("/revoke", tokenHandler.RevokeToken)
}
