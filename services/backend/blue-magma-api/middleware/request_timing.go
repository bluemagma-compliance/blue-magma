package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
)

func RequestTimingMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		elapsed := time.Since(start)

		// Set header as human-readable duration, e.g. "2.3ms"
		c.Set("X-Response-Time", elapsed.String())

		// Log duration
		log.WithFields(log.Fields{
			"method":        c.Method(),
			"path":          c.Path(),
			"status":        c.Response().StatusCode(),
			"response_time": elapsed.String(),
		}).Info("Request processed")

		return err
	}
}
