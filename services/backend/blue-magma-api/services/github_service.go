package services

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-github/v57/github"
	log "github.com/sirupsen/logrus"
)

type GitHubService struct {
	appID      int64
	privateKey *rsa.PrivateKey
}

// BearerTokenTransport implements http.RoundTripper for Bearer token authentication
type BearerTokenTransport struct {
	Token string
	Base  http.RoundTripper
}

func (t *BearerTokenTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", "Bearer "+t.Token)
	req.Header.Set("Accept", "application/vnd.github+json")

	base := t.Base
	if base == nil {
		base = http.DefaultTransport
	}
	return base.RoundTrip(req)
}

func NewGitHubService() (*GitHubService, error) {
	appIDStr := os.Getenv("GITHUB_APP_ID")
	if appIDStr == "" {
		return nil, fmt.Errorf("GITHUB_APP_ID environment variable is required")
	}

	log.Infof("Initializing GitHub service with App ID: %s", appIDStr)

	appID, err := strconv.ParseInt(appIDStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid GITHUB_APP_ID: %w", err)
	}

	// Check for test/fake App ID
	if appID == 123456 {
		log.Warn("Using test/fake GitHub App ID (123456). GitHub API calls will fail. Please configure real GitHub App credentials.")
	}

	privateKeyB64 := os.Getenv("GITHUB_APP_PRIVATE_KEY")
	if privateKeyB64 == "" {
		return nil, fmt.Errorf("GITHUB_APP_PRIVATE_KEY environment variable is required")
	}

	log.Infof("Private key loaded (base64 length: %d)", len(privateKeyB64))

	// Decode base64-encoded private key
	privateKeyPEM, err := base64.StdEncoding.DecodeString(privateKeyB64)
	if err != nil {
		log.Errorf("Failed to decode base64 private key (length: %d): %v", len(privateKeyB64), err)
		return nil, fmt.Errorf("failed to decode base64 private key: %w", err)
	}

	previewLen := 50
	if len(privateKeyPEM) < previewLen {
		previewLen = len(privateKeyPEM)
	}
	log.Debugf("Decoded private key PEM (length: %d, starts with: %s)", len(privateKeyPEM), string(privateKeyPEM[:previewLen]))

	// Check for test/fake private key
	if string(privateKeyPEM) == "-----BEGIN RSA PRIVATE KEY-----\nfake-private-key-for-testing\n-----END RSA PRIVATE KEY-----" {
		log.Warn("Using test/fake GitHub App private key. GitHub API calls will fail. Please configure real GitHub App credentials.")
	}

	privateKey, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM)
	if err != nil {
		log.Errorf("Failed to parse RSA private key from PEM: %v", err)
		return nil, fmt.Errorf("failed to parse GitHub App private key: %w", err)
	}

	log.Infof("Successfully created GitHub service for App ID: %d", appID)

	return &GitHubService{
		appID:      appID,
		privateKey: privateKey,
	}, nil
}

// GenerateAppJWT generates a JWT for GitHub App authentication
func (g *GitHubService) GenerateAppJWT() (string, error) {
	now := time.Now()

	// Log current time details for debugging
	log.Infof("Current system time: %s (Unix: %d)", now.Format(time.RFC3339), now.Unix())
	log.Infof("Current UTC time: %s (Unix: %d)", now.UTC().Format(time.RFC3339), now.UTC().Unix())

	// Use UTC time for JWT to avoid timezone issues
	nowUTC := now.UTC()

	// Add clock skew tolerance and use shorter expiration
	iatTime := nowUTC.Add(-60 * time.Second) // 60s in the past for clock skew
	expTime := nowUTC.Add(9 * time.Minute)   // 9 minutes (less than 10 min limit)

	log.Infof("JWT timestamps: iat=%d (60s ago), exp=%d (9min from now)", iatTime.Unix(), expTime.Unix())

	// Use string App ID to avoid encoding issues
	appIDStr := strconv.FormatInt(g.appID, 10)

	claims := jwt.MapClaims{
		"iat": iatTime.Unix(),
		"exp": expTime.Unix(),
		"iss": appIDStr, // Use string instead of int64
	}

	log.Debugf("Generating JWT for App ID: %d, iat: %d, exp: %d", g.appID, nowUTC.Unix(), nowUTC.Add(10*time.Minute).Unix())

	// Log the claims being used
	claimsJSON, _ := json.Marshal(claims)
	log.Debugf("JWT claims: %s", string(claimsJSON))

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	// Set explicit headers to ensure correct format
	token.Header["typ"] = "JWT"
	token.Header["alg"] = "RS256"
	signedToken, err := token.SignedString(g.privateKey)
	if err != nil {
		log.Errorf("Failed to sign JWT token: %v", err)
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	log.Debugf("Successfully generated JWT token (length: %d)", len(signedToken))

	// Basic JWT format validation (should have 3 parts separated by dots)
	parts := strings.Split(signedToken, ".")
	if len(parts) != 3 {
		log.Errorf("Generated JWT has invalid format - expected 3 parts, got %d", len(parts))
		return "", fmt.Errorf("invalid JWT format")
	}

	// Decode and log JWT payload for debugging
	if payload, err := base64.RawURLEncoding.DecodeString(parts[1]); err == nil {
		log.Debugf("JWT payload decoded: %s", string(payload))
	} else {
		log.Errorf("Failed to decode JWT payload: %v", err)
	}

	// Log JWT header too
	if header, err := base64.RawURLEncoding.DecodeString(parts[0]); err == nil {
		log.Debugf("JWT header decoded: %s", string(header))
	}

	// Test parsing the JWT back to verify it's valid
	testToken, err := jwt.Parse(signedToken, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return &g.privateKey.PublicKey, nil
	})

	if err != nil {
		log.Errorf("JWT self-validation failed: %v", err)
		return "", fmt.Errorf("generated JWT is invalid: %w", err)
	}

	if !testToken.Valid {
		log.Errorf("Generated JWT is not valid")
		return "", fmt.Errorf("generated JWT is not valid")
	}

	log.Debugf("JWT self-validation passed - token is valid")
	return signedToken, nil
}

// GetAppClient returns a GitHub client authenticated as the app
func (g *GitHubService) GetAppClient() (*github.Client, error) {
	jwt, err := g.GenerateAppJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to generate app JWT: %w", err)
	}

	jwtPreview := jwt
	if len(jwt) > 50 {
		jwtPreview = jwt[:50] + "..."
	}
	log.Debugf("Using JWT for GitHub API: %s", jwtPreview)

	// Use Bearer token transport instead of BasicAuth
	transport := &BearerTokenTransport{
		Token: jwt,
	}

	httpClient := &http.Client{Transport: transport}
	client := github.NewClient(httpClient)

	// Set proper headers for GitHub API
	client.UserAgent = "blue-magma-api/1.0"

	log.Debugf("Created GitHub client with Bearer JWT authentication and User-Agent")

	return client, nil
}

// TestAppJWT tests the JWT by calling GET /app endpoint
func (g *GitHubService) TestAppJWT() error {
	log.Infof("Testing JWT by calling GitHub /app endpoint")

	client, err := g.GetAppClient()
	if err != nil {
		return fmt.Errorf("failed to get app client: %w", err)
	}

	ctx := context.Background()
	app, resp, err := client.Apps.Get(ctx, "")
	if err != nil {
		if resp != nil {
			log.Errorf("GitHub /app API error - Status: %s, StatusCode: %d", resp.Status, resp.StatusCode)
			log.Errorf("Response headers: %+v", resp.Header)
		}
		return fmt.Errorf("failed to get app info: %w", err)
	}

	log.Infof("JWT test successful! App: %s (ID: %d, Slug: %s)",
		app.GetName(), app.GetID(), app.GetSlug())
	return nil
}

// GetInstallationClient returns a GitHub client authenticated for a specific installation
func (g *GitHubService) GetInstallationClient(installationID int64) (*github.Client, error) {
	appClient, err := g.GetAppClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get app client: %w", err)
	}

	ctx := context.Background()
	token, _, err := appClient.Apps.CreateInstallationToken(ctx, installationID, &github.InstallationTokenOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to create installation token: %w", err)
	}

	transport := &github.BasicAuthTransport{
		Username: "x-access-token",
		Password: token.GetToken(),
	}

	return github.NewClient(transport.Client()), nil
}

// GetInstallation fetches installation details
func (g *GitHubService) GetInstallation(installationID int64) (*github.Installation, error) {
	log.Infof("Fetching installation details for ID: %d", installationID)

	// First test JWT with /app endpoint
	if err := g.TestAppJWT(); err != nil {
		log.Errorf("JWT test failed: %v", err)
		return nil, fmt.Errorf("JWT validation failed: %w", err)
	}

	client, err := g.GetAppClient()
	if err != nil {
		log.Errorf("Failed to get app client: %v", err)
		return nil, fmt.Errorf("failed to get app client: %w", err)
	}

	ctx := context.Background()

	// Log the exact API call being made
	apiURL := fmt.Sprintf("https://api.github.com/app/installations/%d", installationID)
	log.Infof("Making GitHub API call: GET %s", apiURL)

	installation, resp, err := client.Apps.GetInstallation(ctx, installationID)
	if err != nil {
		if resp != nil {
			log.Errorf("GitHub API error - Status: %s, StatusCode: %d, Error: %v", resp.Status, resp.StatusCode, err)
			if resp.Body != nil {
				// Try to read response body for more details
				log.Errorf("Response headers: %+v", resp.Header)
			}
		} else {
			log.Errorf("GitHub API error (no response): %v", err)
		}
		return nil, fmt.Errorf("failed to get installation: %w", err)
	}

	log.Infof("Successfully fetched installation: %s (%s)", installation.GetAccount().GetLogin(), installation.GetAccount().GetType())
	return installation, nil
}

// ListInstallationRepositories lists repositories accessible to an installation
func (g *GitHubService) ListInstallationRepositories(installationID int64) ([]*github.Repository, error) {
	client, err := g.GetInstallationClient(installationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation client: %w", err)
	}

	ctx := context.Background()
	var allRepos []*github.Repository
	opts := &github.ListOptions{PerPage: 100}

	for {
		repos, resp, err := client.Apps.ListRepos(ctx, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list repositories: %w", err)
		}

		allRepos = append(allRepos, repos.Repositories...)

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return allRepos, nil
}

// VerifyWebhookSignature verifies the GitHub webhook signature
func (g *GitHubService) VerifyWebhookSignature(payload []byte, signature string) bool {
	secret := os.Getenv("GITHUB_WEBHOOK_SECRET")
	if secret == "" {
		log.Error("GITHUB_WEBHOOK_SECRET not configured")
		return false
	}

	err := github.ValidateSignature(signature, payload, []byte(secret))
	return err == nil
}

// GetInstallationURL generates the GitHub App installation URL
func (g *GitHubService) GetInstallationURL(state string) string {
	appSlug := os.Getenv("GITHUB_APP_SLUG")
	if appSlug == "" {
		log.Error("GITHUB_APP_SLUG not configured")
		return ""
	}

	return fmt.Sprintf("https://github.com/apps/%s/installations/new?state=%s", appSlug, state)
}

// GetOAuthURL generates the GitHub OAuth authorization URL for user login
func (g *GitHubService) GetOAuthURL(state string, scopes []string) string {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	if clientID == "" {
		log.Error("GITHUB_CLIENT_ID not configured")
		return ""
	}

	baseURL := "https://github.com/login/oauth/authorize"
	scopeStr := strings.Join(scopes, " ")
	redirectURI := fmt.Sprintf("%s/auth/github/callback", os.Getenv("FRONTEND_URL"))

	params := url.Values{}
	params.Add("client_id", clientID)
	params.Add("redirect_uri", redirectURI)
	params.Add("state", state)
	params.Add("scope", scopeStr)

	return fmt.Sprintf("%s?%s", baseURL, params.Encode())
}

// ExchangeCodeForToken exchanges an OAuth authorization code for an access token
func (g *GitHubService) ExchangeCodeForToken(code string) (string, error) {
	clientID := os.Getenv("GITHUB_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return "", fmt.Errorf("GitHub OAuth credentials not configured")
	}

	// Create HTTP client for token exchange
	client := &http.Client{}

	// Prepare request data
	data := fmt.Sprintf("client_id=%s&client_secret=%s&code=%s", clientID, clientSecret, code)
	req, err := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to exchange code for token: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	if tokenResp.Error != "" {
		return "", fmt.Errorf("GitHub OAuth error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("no access token received from GitHub")
	}

	return tokenResp.AccessToken, nil
}

// GetAuthenticatedUser fetches user information using an OAuth access token
func (g *GitHubService) GetAuthenticatedUser(accessToken string) (*github.User, error) {
	transport := &BearerTokenTransport{
		Token: accessToken,
	}

	httpClient := &http.Client{Transport: transport}
	client := github.NewClient(httpClient)
	client.UserAgent = "blue-magma-api/1.0"

	ctx := context.Background()
	user, resp, err := client.Users.Get(ctx, "")
	if err != nil {
		if resp != nil {
			log.Errorf("GitHub user API error - Status: %s, StatusCode: %d", resp.Status, resp.StatusCode)
		}
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}

	return user, nil
}
