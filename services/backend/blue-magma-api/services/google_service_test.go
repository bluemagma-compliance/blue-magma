package services

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGoogleService_GetOAuthURL(t *testing.T) {
	// Set required environment variables
	os.Setenv("GOOGLE_CLIENT_ID", "test-client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
	os.Setenv("FRONTEND_URL", "http://localhost:3000")

	service, err := NewGoogleService()
	assert.NoError(t, err)
	assert.NotNil(t, service)

	state := "test-state-123"
	scopes := []string{"openid", "email", "profile"}

	oauthURL := service.GetOAuthURL(state, scopes)

	assert.NotEmpty(t, oauthURL)
	assert.Contains(t, oauthURL, "accounts.google.com/o/oauth2/v2/auth")
	assert.Contains(t, oauthURL, "client_id=test-client-id")
	assert.Contains(t, oauthURL, "state=test-state-123")
	assert.Contains(t, oauthURL, "scope=openid+email+profile")
	assert.Contains(t, oauthURL, "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fgoogle%2Fcallback")
	assert.Contains(t, oauthURL, "response_type=code")
	assert.Contains(t, oauthURL, "access_type=offline")
}

func TestGoogleService_NewGoogleService(t *testing.T) {
	tests := []struct {
		name        string
		clientID    string
		clientSecret string
		expectError bool
	}{
		{
			name:         "valid credentials",
			clientID:     "test-client-id",
			clientSecret: "test-client-secret",
			expectError:  false,
		},
		{
			name:         "missing client ID",
			clientID:     "",
			clientSecret: "test-client-secret",
			expectError:  true,
		},
		{
			name:         "missing client secret",
			clientID:     "test-client-id",
			clientSecret: "",
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Setenv("GOOGLE_CLIENT_ID", tt.clientID)
			os.Setenv("GOOGLE_CLIENT_SECRET", tt.clientSecret)

			service, err := NewGoogleService()

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, service)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, service)
			}
		})
	}
}

func TestGoogleUser_Structure(t *testing.T) {
	user := GoogleUser{
		ID:      "123456789",
		Email:   "test@example.com",
		Name:    "Test User",
		Picture: "https://lh3.googleusercontent.com/avatar.jpg",
	}

	assert.Equal(t, "123456789", user.ID)
	assert.Equal(t, "test@example.com", user.Email)
	assert.Equal(t, "Test User", user.Name)
	assert.Equal(t, "https://lh3.googleusercontent.com/avatar.jpg", user.Picture)
}

func TestGoogleService_GetOAuthURL_MissingClientID(t *testing.T) {
	// Clear environment variables
	os.Unsetenv("GOOGLE_CLIENT_ID")
	os.Setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
	os.Setenv("FRONTEND_URL", "http://localhost:3000")

	service := &GoogleService{}
	state := "test-state"
	scopes := []string{"openid", "email", "profile"}

	oauthURL := service.GetOAuthURL(state, scopes)
	assert.Empty(t, oauthURL)
}
