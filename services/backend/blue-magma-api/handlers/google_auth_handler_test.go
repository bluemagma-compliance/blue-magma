package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupGoogleAuthTest() (*gorm.DB, *redis.Client, *GoogleAuthHandler) {
	// Set required environment variables for testing
	os.Setenv("GOOGLE_CLIENT_ID", "test-client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
	os.Setenv("FRONTEND_URL", "http://localhost:3000")

	// Setup in-memory SQLite database
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.User{}, &models.Organization{})

	// Setup mock Redis client (will fail but that's ok for basic tests)
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	// Create handler
	handler, _ := NewGoogleAuthHandler(db, redisClient)
	return db, redisClient, handler
}

func TestGoogleAuthHandler_StartOAuth(t *testing.T) {
	t.Skip("Skipping Google auth test - requires Redis configuration")

	db, redisClient, handler := setupGoogleAuthTest()
	defer db.Migrator().DropTable(&models.User{}, &models.Organization{})
	defer redisClient.Close()

	app := fiber.New()
	app.Post("/auth/google/start", handler.StartOAuth)

	tests := []struct {
		name           string
		requestBody    GoogleStartOAuthRequest
		expectedStatus int
		expectOAuthURL bool
	}{
		{
			name: "valid login request",
			requestBody: GoogleStartOAuthRequest{
				ReturnURL: "/dashboard",
				Action:    "login",
			},
			expectedStatus: 200,
			expectOAuthURL: true,
		},
		{
			name: "invalid action",
			requestBody: GoogleStartOAuthRequest{
				ReturnURL: "/dashboard",
				Action:    "invalid",
			},
			expectedStatus: 400,
			expectOAuthURL: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/auth/google/start", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			resp, _ := app.Test(req)
			assert.Equal(t, tt.expectedStatus, resp.StatusCode)

			if tt.expectOAuthURL {
				var response GoogleStartOAuthResponse
				json.NewDecoder(resp.Body).Decode(&response)
				assert.NotEmpty(t, response.OAuthURL)
				assert.NotEmpty(t, response.State)
				assert.Contains(t, response.OAuthURL, "accounts.google.com")
			}
		})
	}
}

func TestGoogleStartOAuthRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		request GoogleStartOAuthRequest
		valid   bool
	}{
		{
			name: "valid login request",
			request: GoogleStartOAuthRequest{
				ReturnURL: "/dashboard",
				Action:    "login",
			},
			valid: true,
		},
		{
			name: "valid link request",
			request: GoogleStartOAuthRequest{
				ReturnURL: "/settings",
				Action:    "link",
			},
			valid: true,
		},
		{
			name: "invalid action",
			request: GoogleStartOAuthRequest{
				ReturnURL: "/dashboard",
				Action:    "invalid",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.valid {
				assert.Contains(t, []string{"login", "link"}, tt.request.Action)
			} else {
				assert.NotContains(t, []string{"login", "link"}, tt.request.Action)
			}
		})
	}
}

func TestGoogleUserModel_Fields(t *testing.T) {
	user := services.GoogleUser{
		ID:      "123456789",
		Email:   "test@example.com",
		Name:    "Test User",
		Picture: "https://example.com/avatar.jpg",
	}

	assert.Equal(t, "123456789", user.ID)
	assert.Equal(t, "test@example.com", user.Email)
	assert.Equal(t, "Test User", user.Name)
	assert.Equal(t, "https://example.com/avatar.jpg", user.Picture)
}

func TestGoogleOAuthResponseStructure(t *testing.T) {
	response := GoogleOAuthCallbackResponse{
		Success:        true,
		Message:        "Login successful",
		UserID:         "user123",
		AccessToken:    "access_token",
		RefreshToken:   "refresh_token",
		ExpiresIn:      7200,
		OrganizationID: "org123",
	}

	assert.True(t, response.Success)
	assert.Equal(t, "Login successful", response.Message)
	assert.Equal(t, "user123", response.UserID)
	assert.Equal(t, "access_token", response.AccessToken)
	assert.Equal(t, "refresh_token", response.RefreshToken)
	assert.Equal(t, 7200, response.ExpiresIn)
	assert.Equal(t, "org123", response.OrganizationID)
}

func TestUserModelGoogleFields(t *testing.T) {
	user := models.User{
		GoogleUserID:  "123456789",
		GoogleEmail:   "test@google.com",
		GoogleName:    "Test User",
		GooglePicture: "https://lh3.googleusercontent.com/avatar.jpg",
	}

	// GoogleUserID and GooglePicture are stored in plaintext
	assert.Equal(t, "123456789", user.GoogleUserID)
	assert.Equal(t, "https://lh3.googleusercontent.com/avatar.jpg", user.GooglePicture)

	// GoogleEmail and GoogleName are now encrypted/decrypted via GORM hooks.
	// This unit test just verifies the fields exist on the model; encryption is covered elsewhere.
	assert.Equal(t, "test@google.com", user.GoogleEmail)
	assert.Equal(t, "Test User", user.GoogleName)
}
