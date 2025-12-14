package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestUpdateCurrentUserChatMemory_Success verifies that the authenticated user can update their own chat memory
func TestUpdateCurrentUserChatMemory_Success(t *testing.T) {
	// Ensure encryption key is set for User model hooks
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")

	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.Role{}, &models.UserRole{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	handler := NewUserHandler(db)
	app := fiber.New()

	// Create a test user
	user := &models.User{
		ObjectID:       "user-1",
		Email:          "user@example.com",
		FirstName:      "Test",
		OrganizationID: 1,
		ChatMemory:     "{}",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// Route under test with injected auth context
	app.Patch("/api/v1/users/me/chat-memory", func(c *fiber.Ctx) error {
		c.Locals("auth", &middleware.AuthContext{
			IsUser: true,
			User:   user,
		})
		return handler.UpdateCurrentUserChatMemory(c)
	})

	// Prepare request payload
	payload := UpdateChatMemoryRequest{
		ChatMemory: "{\"messages\":[{\"role\":\"user\",\"content\":\"hello\"}]}",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	// Create test request
	req := httptest.NewRequest("PATCH", "/api/v1/users/me/chat-memory", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("failed to execute request: %v", err)
	}
	assert.Equal(t, 200, resp.StatusCode)

	// Decode response
	var response UserMeResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	assert.Equal(t, user.ObjectID, response.UserID)
	assert.Equal(t, payload.ChatMemory, response.ChatMemory)

	// Verify DB was updated
	var updated models.User
	if err := db.First(&updated, user.ID).Error; err != nil {
		t.Fatalf("failed to fetch updated user: %v", err)
	}
	assert.Equal(t, payload.ChatMemory, updated.ChatMemory)
}
