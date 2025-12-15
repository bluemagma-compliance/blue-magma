package routes

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// RegisterHealthRoutes registers public health endpoints at /health and /api/v1/health
// This should be called BEFORE auth middleware is applied to the /api/v1 group.
func RegisterHealthRoutes(app *fiber.App, apiGroup fiber.Router, db *gorm.DB, redisClient *redis.Client) {
	handler := func(c *fiber.Ctx) error {
		ctx := context.Background()

		// Database health check
		dbOK := db.Exec("SELECT 1").Error == nil

		// Redis health check
		redisOK := false
		if redisClient != nil {
			if err := redisClient.Ping(ctx).Err(); err == nil {
				redisOK = true
			}
		}

		status := "healthy"
		if !dbOK || !redisOK {
			status = "unhealthy"
		}

		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":          status,
			"db_connected":    dbOK,
			"redis_connected": redisOK,
			"timestamp":       time.Now().UTC().Format(time.RFC3339),
		})
	}

	// Root path for K8s probes
	app.Get("/health", handler)
	// API path used by frontend/internal checks
	apiGroup.Get("/health", handler)
}
