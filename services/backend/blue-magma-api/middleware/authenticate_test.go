package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/database"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type MockAuth struct{}

func (m MockAuth) ParseUserToken(tokenString string) (string, error) {
	if tokenString == "valid-user-token" || tokenString == "mock-service-token" {
		return "12345", nil
	}
	return "", fiber.ErrUnauthorized
}

func (m MockAuth) ParseUserClaims(tokenString string) (*authz.UserClaims, error) {
	if tokenString == "valid-user-token" {
		return &authz.UserClaims{
			UserID:         "12345",
			OrganizationID: 1,
			Role:           "owner",
		}, nil
	}
	return nil, fiber.ErrUnauthorized
}

func TestAuthenticateRequest(t *testing.T) {
	// Set debug logging
	log.SetLevel(log.DebugLevel)

	// Set up encryption key for user model
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012") // 32 bytes
	defer os.Unsetenv("ENCRYPTION_KEY")

	// Mock database
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})

	// Migrate all models including RBAC
	db.AutoMigrate(
		&models.Organization{},
		&models.User{},
		&models.Role{},
		&models.UserRole{},
	)

	// Seed RBAC data
	database.SeedRBAC(db)

	// Create mock organization
	mockOrg := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	db.Create(&mockOrg)

	// Mock user
	mockUser := models.User{
		ObjectID:       "12345",
		Username:       "testuser",
		Email:          "test@example.com",
		OrganizationID: mockOrg.ID, // Match the token organization ID
	}
	result := db.Create(&mockUser)
	if result.Error != nil {
		t.Fatalf("Failed to create mock user: %v", result.Error)
	}

	// Create user role
	var ownerRole models.Role
	db.Where("name = ?", "owner").First(&ownerRole)
	userRole := models.UserRole{
		UserID:         mockUser.ID,
		RoleID:         ownerRole.ID,
		OrganizationID: mockOrg.ID,
		IsActive:       true,
	}
	result = db.Create(&userRole)
	if result.Error != nil {
		t.Fatalf("Failed to create user role: %v", result.Error)
	}

	// Mock service token
	os.Setenv("INTERNAL_API_KEY", "mock-service-token")
	defer os.Unsetenv("INTERNAL_API_KEY")

	app := fiber.New()
	app.Use(AuthenticateRequest(db, MockAuth{}))
	app.Get("/", func(c *fiber.Ctx) error {
		auth := c.Locals("auth").(*AuthContext)
		if auth.IsUser || auth.IsService {
			return c.SendStatus(fiber.StatusOK)
		}
		return c.SendStatus(fiber.StatusUnauthorized)
	})

	t.Run("Valid user token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer valid-user-token")
		resp, _ := app.Test(req)

		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Invalid user token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer invalid-user-token")
		resp, _ := app.Test(req)

		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Valid service token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Authorization", "Bearer mock-service-token")
		resp, _ := app.Test(req)

		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("No token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		resp, _ := app.Test(req)

		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}
