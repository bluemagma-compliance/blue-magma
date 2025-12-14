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

// RegisterGitHubAuthRoutes registers GitHub OAuth authentication routes
func RegisterGitHubAuthRoutes(app *fiber.App, apiGroup fiber.Router, db *gorm.DB, redis *redis.Client) {
	authHandler, err := handlers.NewGitHubAuthHandler(db, redis)
	if err != nil {
		log.Errorf("Failed to create GitHub auth handler: %v", err)
		return
	}

	// OAuth routes under /auth/github
	githubAuthGroup := apiGroup.Group("/auth/github")

	// Start OAuth flow (requires authentication for "link" action)
	githubAuthGroup.Post("/start", authHandler.StartOAuth)

	// Exchange OAuth code for tokens (called by frontend after OAuth callback)
	githubAuthGroup.Post("/exchange", authHandler.ExchangeCode)

	// OAuth callback (public endpoint, no auth required) - for direct GitHub redirects
	// Register directly on app to avoid auth middleware
	app.Get("/api/v1/auth/github/callback", authHandler.HandleOAuthCallback)

	// Optional: Account linking endpoint (requires authentication)
	githubAuthGroup.Post("/link",
		middleware.AuthenticateRequest(db, authz.TokenService{}),
		authHandler.StartOAuth) // Reuse StartOAuth with action="link"
}
