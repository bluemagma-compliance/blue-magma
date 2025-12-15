package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCreateAPIKey(t *testing.T) {
	// Load env
	_ = godotenv.Load("../../.env")
	app := fiber.New()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to in-memory database: %v", err)
	}

	// Auto-migrate the models
	if err := db.AutoMigrate(&models.Organization{}, &models.APIKey{}); err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	handler := NewAPIKeyHandler(db)
	app.Post("/api/v1/org/:org_id/api_key", handler.CreateAPIKey)

	t.Run("successfully creates an API key", func(t *testing.T) {
		// Seed the database with an organization
		db.Create(&models.Organization{ObjectID: "org123"})

		apiKeyRequest := APIKeyRequest{
			KeyName: "Test Key",
			Enabled: true,
		}
		body, _ := json.Marshal(apiKeyRequest)
		req := httptest.NewRequest("POST", "/api/v1/org/org123/api_key", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	})

	t.Run("returns 400 for invalid request body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/org/org123/api_key", bytes.NewReader([]byte("invalid")))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("returns 404 if organization not found", func(t *testing.T) {
		apiKeyRequest := APIKeyRequest{
			KeyName: "Test Key",
			Enabled: true,
		}
		body, _ := json.Marshal(apiKeyRequest)
		req := httptest.NewRequest("POST", "/api/v1/org/org123NotFound/api_key", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("returns 500 if API key creation fails", func(t *testing.T) {
		// Seed the database with an organization
		db.Create(&models.Organization{ObjectID: "org123fake"})

		// Simulate a failure in API key creation by using a transaction rollback
		db.Callback().Create().Before("gorm:create").Register("force_error", func(tx *gorm.DB) {
			tx.Statement.AddError(errors.New("db error"))
		})
		defer db.Callback().Create().Remove("force_error")

		apiKeyRequest := APIKeyRequest{
			KeyName: "Test Key",
			Enabled: true,
		}
		body, _ := json.Marshal(apiKeyRequest)
		req := httptest.NewRequest("POST", "/api/v1/org/org123fake/api_key", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})
}

func TestGenerateAPIKey(t *testing.T) {
	t.Run("generates API key with correct length", func(t *testing.T) {
		key, err := generateAPIKey(32)
		assert.NoError(t, err)
		assert.NotEmpty(t, key)
		// Base64 encoding of 32 bytes should produce a string of length ~43 characters
		assert.True(t, len(key) > 40 && len(key) < 50, "Expected key length to be around 43 characters, got %d", len(key))
	})

	t.Run("generates unique API keys", func(t *testing.T) {
		key1, err1 := generateAPIKey(32)
		key2, err2 := generateAPIKey(32)

		assert.NoError(t, err1)
		assert.NoError(t, err2)
		assert.NotEqual(t, key1, key2, "Generated keys should be unique")
	})

	t.Run("API key always starts with alphanumeric character", func(t *testing.T) {
		// Generate multiple keys to test the randomness and ensure they all start with alphanumeric
		for i := 0; i < 100; i++ {
			key, err := generateAPIKey(32)
			assert.NoError(t, err)
			assert.NotEmpty(t, key)

			firstChar := key[0]
			isAlphanumeric := (firstChar >= 'A' && firstChar <= 'Z') ||
							  (firstChar >= 'a' && firstChar <= 'z') ||
							  (firstChar >= '0' && firstChar <= '9')

			assert.True(t, isAlphanumeric, "API key should start with alphanumeric character, got '%c' in key: %s", firstChar, key)
		}
	})

	t.Run("handles different lengths correctly", func(t *testing.T) {
		lengths := []int{16, 24, 32, 48}
		for _, length := range lengths {
			key, err := generateAPIKey(length)
			assert.NoError(t, err)
			assert.NotEmpty(t, key)

			firstChar := key[0]
			isAlphanumeric := (firstChar >= 'A' && firstChar <= 'Z') ||
							  (firstChar >= 'a' && firstChar <= 'z') ||
							  (firstChar >= '0' && firstChar <= '9')

			assert.True(t, isAlphanumeric, "API key of length %d should start with alphanumeric character", length)
		}
	})
}
