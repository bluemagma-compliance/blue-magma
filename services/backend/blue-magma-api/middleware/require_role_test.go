package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
)

func TestRequireRole(t *testing.T) {
	t.Run("Owner can access admin endpoint", func(t *testing.T) {
		app := fiber.New()

		// Mock owner user context
		app.Use(func(c *fiber.Ctx) error {
			auth := &AuthContext{
				IsUser:   true,
				UserRole: "owner",
				User: &models.User{
					ObjectID: "test-owner",
					Username: "owner-user",
				},
			}
			c.Locals("auth", auth)
			return c.Next()
		})

		// Test endpoint that requires admin role
		app.Get("/admin", RequireRole("admin"), func(c *fiber.Ctx) error {
			return c.SendStatus(fiber.StatusOK)
		})

		req := httptest.NewRequest("GET", "/admin", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Admin can access admin endpoint", func(t *testing.T) {
		app2 := fiber.New()
		app2.Use(func(c *fiber.Ctx) error {
			auth := &AuthContext{
				IsUser:   true,
				UserRole: "admin",
				User: &models.User{
					ObjectID: "test-admin",
					Username: "admin-user",
				},
			}
			c.Locals("auth", auth)
			return c.Next()
		})
		app2.Get("/admin", RequireRole("admin"), func(c *fiber.Ctx) error {
			return c.SendStatus(fiber.StatusOK)
		})

		req := httptest.NewRequest("GET", "/admin", nil)
		resp, _ := app2.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("User cannot access admin endpoint", func(t *testing.T) {
		app3 := fiber.New()
		app3.Use(func(c *fiber.Ctx) error {
			auth := &AuthContext{
				IsUser:   true,
				UserRole: "user",
				User: &models.User{
					ObjectID: "test-user",
					Username: "regular-user",
				},
			}
			c.Locals("auth", auth)
			return c.Next()
		})
		app3.Get("/admin", RequireRole("admin"), func(c *fiber.Ctx) error {
			return c.SendStatus(fiber.StatusOK)
		})

		req := httptest.NewRequest("GET", "/admin", nil)
		resp, _ := app3.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Service account can access user endpoint", func(t *testing.T) {
		app4 := fiber.New()
		app4.Use(func(c *fiber.Ctx) error {
			auth := &AuthContext{
				IsService: true,
				ServiceID: "test-service",
			}
			c.Locals("auth", auth)
			return c.Next()
		})
		app4.Get("/user", RequireRole("user"), func(c *fiber.Ctx) error {
			return c.SendStatus(fiber.StatusOK)
		})

		req := httptest.NewRequest("GET", "/user", nil)
		resp, _ := app4.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

}
