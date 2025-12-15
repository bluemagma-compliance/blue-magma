package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// RegisterGoogleAuthRoutes registers Google OAuth authentication routes
func RegisterGoogleAuthRoutes(app *fiber.App, apiGroup fiber.Router, db *gorm.DB, redisClient *redis.Client) {
	// Initialize Google auth handler
	authHandler, err := handlers.NewGoogleAuthHandler(db, redisClient)
	if err != nil {
		log.Errorf("Failed to initialize Google auth handler: %v", err)
		return
	}

	// OAuth routes under /auth/google
	googleAuthGroup := apiGroup.Group("/auth/google")

	// Start OAuth flow (requires authentication for "link" action)
	googleAuthGroup.Post("/start", authHandler.StartOAuth)

	// Exchange OAuth code for tokens (called by frontend after OAuth callback)
	googleAuthGroup.Post("/exchange", authHandler.ExchangeCode)

	// Account linking endpoint (requires authentication)
	googleAuthGroup.Post("/link",
		middleware.AuthenticateRequest(db, authz.TokenService{}),
		authHandler.StartOAuth) // Reuse StartOAuth with action="link"
}
