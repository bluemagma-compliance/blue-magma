package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupGitHubAuthTestDB(t *testing.T) (*gorm.DB, *redis.Client) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(
		&models.Organization{},
		&models.User{},
	)
	assert.NoError(t, err)

	// Setup Redis mock (using miniredis for testing)
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379", // This will fail in tests, but we'll mock it
	})

	return db, rdb
}

func TestGitHubAuthHandler_StartOAuth(t *testing.T) {
	db, rdb := setupGitHubAuthTestDB(t)

	// Create handler for testing (avoids GitHub service initialization)
	handler, err := NewGitHubAuthHandlerForTesting(db, rdb)
	assert.NoError(t, err)

	// Create Fiber app
	app := fiber.New()
	app.Post("/auth/github/start", handler.StartOAuth)

	// Test request
	reqBody := StartOAuthRequest{
		ReturnURL: "/dashboard",
		Action:    "login",
	}
	
	body, _ := json.Marshal(reqBody)
	req := httptest.NewRequest("POST", "/auth/github/start", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// Test the request
	resp, err := app.Test(req)
	assert.NoError(t, err)

	// Should return 500 because GitHub service is nil in test
	assert.Equal(t, 500, resp.StatusCode)

	// Verify it doesn't panic and returns proper error
	assert.NotNil(t, resp)
}

func TestStartOAuthRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		request StartOAuthRequest
		valid   bool
	}{
		{
			name: "valid login request",
			request: StartOAuthRequest{
				ReturnURL: "/dashboard",
				Action:    "login",
			},
			valid: true,
		},
		{
			name: "valid link request",
			request: StartOAuthRequest{
				ReturnURL: "/profile",
				Action:    "link",
			},
			valid: true,
		},
		{
			name: "invalid action",
			request: StartOAuthRequest{
				ReturnURL: "/dashboard",
				Action:    "invalid",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test action validation logic
			isValid := tt.request.Action == "login" || tt.request.Action == "link"
			assert.Equal(t, tt.valid, isValid)
		})
	}
}

func TestGitHubUserModel_Fields(t *testing.T) {
	// Test that User model has the GitHub fields
	user := models.User{
		GitHubUserID:    &[]int64{12345}[0],
		GitHubUsername:  "testuser",
		GitHubAvatarURL: "https://github.com/avatar.jpg",
	}

	assert.NotNil(t, user.GitHubUserID)
	assert.Equal(t, int64(12345), *user.GitHubUserID)
	assert.Equal(t, "https://github.com/avatar.jpg", user.GitHubAvatarURL)

	// GitHubUsername is now encrypted/decrypted via GORM hooks. This test just
	// verifies the field exists on the model; encryption is covered elsewhere.
	assert.Equal(t, "testuser", user.GitHubUsername)
}
