package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func RegisterAccessCodeRoutes(apiGroup *fiber.Group, db *gorm.DB, redis *redis.Client) {
	h := &handlers.AccessCodeHandler{Redis: redis}
	group := apiGroup.Group("/access-code")
	group.Post("/generate", middleware.RequireRole("admin"), h.GenerateAccessCode)
}

