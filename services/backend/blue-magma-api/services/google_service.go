package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	log "github.com/sirupsen/logrus"
)

type GoogleService struct{}

// GoogleUser represents the user data returned by Google OAuth
type GoogleUser struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// NewGoogleService creates a new Google service instance
func NewGoogleService() (*GoogleService, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("Google OAuth credentials not configured")
	}

	log.Info("Google OAuth service initialized successfully")
	return &GoogleService{}, nil
}

// GetOAuthURL generates the Google OAuth authorization URL
func (g *GoogleService) GetOAuthURL(state string, scopes []string) string {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		log.Error("GOOGLE_CLIENT_ID not configured")
		return ""
	}

	baseURL := "https://accounts.google.com/o/oauth2/v2/auth"
	scopeStr := strings.Join(scopes, " ")
	redirectURI := fmt.Sprintf("%s/auth/google/callback", os.Getenv("FRONTEND_URL"))

	params := url.Values{}
	params.Add("client_id", clientID)
	params.Add("redirect_uri", redirectURI)
	params.Add("response_type", "code")
	params.Add("scope", scopeStr)
	params.Add("state", state)
	params.Add("access_type", "offline") // for refresh tokens if needed

	return fmt.Sprintf("%s?%s", baseURL, params.Encode())
}

// ExchangeCodeForToken exchanges an OAuth authorization code for an access token
func (g *GoogleService) ExchangeCodeForToken(code string) (string, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("Google OAuth credentials not configured")
	}

	// Google token endpoint
	tokenURL := "https://oauth2.googleapis.com/token"
	redirectURI := fmt.Sprintf("%s/auth/google/callback", os.Getenv("FRONTEND_URL"))

	data := url.Values{}
	data.Set("client_id", clientID)
	data.Set("client_secret", clientSecret)
	data.Set("code", code)
	data.Set("grant_type", "authorization_code")
	data.Set("redirect_uri", redirectURI)

	client := &http.Client{}
	req, err := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to exchange code for token: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int    `json:"expires_in"`
		RefreshToken string `json:"refresh_token"`
		Scope        string `json:"scope"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	if tokenResp.Error != "" {
		return "", fmt.Errorf("Google OAuth error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("no access token received from Google")
	}

	log.Debugf("Successfully exchanged code for Google access token")
	return tokenResp.AccessToken, nil
}

// GetUserInfo fetches user profile from Google API
func (g *GoogleService) GetUserInfo(accessToken string) (*GoogleUser, error) {
	client := &http.Client{}
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user info request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Google API returned status %d", resp.StatusCode)
	}

	var user GoogleUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	log.Debugf("Successfully retrieved Google user info for user ID: %s", user.ID)
	return &user, nil
}
