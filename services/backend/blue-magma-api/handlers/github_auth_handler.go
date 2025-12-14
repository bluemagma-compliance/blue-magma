package handlers

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/go-github/v57/github"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type GitHubAuthHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
	GitHubSvc   *services.GitHubService
}

// NewGitHubAuthHandler creates a new GitHub auth handler
func NewGitHubAuthHandler(db *gorm.DB, redis *redis.Client) (*GitHubAuthHandler, error) {
	githubSvc, err := services.NewGitHubService()
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub service: %w", err)
	}

	return &GitHubAuthHandler{
		DB:          db,
		RedisClient: redis,
		GitHubSvc:   githubSvc,
	}, nil
}

// NewGitHubAuthHandlerForTesting creates a handler with a mock GitHub service for testing
func NewGitHubAuthHandlerForTesting(db *gorm.DB, redis *redis.Client) (*GitHubAuthHandler, error) {
	return &GitHubAuthHandler{
		DB:          db,
		RedisClient: redis,
		GitHubSvc:   nil, // Will be handled gracefully in methods
	}, nil
}

// Request/Response types
type StartOAuthRequest struct {
	ReturnURL string `json:"return_url"`
	Action    string `json:"action"` // "login" or "link"
}

type StartOAuthResponse struct {
	OAuthURL string `json:"oauth_url"`
	State    string `json:"state"`
}

type OAuthCallbackResponse struct {
	Success        bool   `json:"success"`
	Message        string `json:"message"`
	UserID         string `json:"user_id,omitempty"`
	AccessToken    string `json:"access_token,omitempty"`
	RefreshToken   string `json:"refresh_token,omitempty"`
	ExpiresIn      int    `json:"expires_in,omitempty"`
	Scope          string `json:"scope,omitempty"`
	OrganizationID string `json:"organization_id,omitempty"`
}

type ExchangeCodeRequest struct {
	Code  string `json:"code" validate:"required"`
	State string `json:"state" validate:"required"`
	// Action and ReturnURL are retrieved from Redis state, not from request
}

// StartOAuth initiates the GitHub OAuth flow
// @Summary Start GitHub OAuth flow
// @Description Initiates GitHub OAuth flow for user login or account linking
// @Tags auth
// @Accept json
// @Produce json
// @Param request body StartOAuthRequest true "OAuth start request"
// @Success 200 {object} StartOAuthResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /auth/github/start [post]
func (h *GitHubAuthHandler) StartOAuth(c *fiber.Ctx) error {
	var req StartOAuthRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse OAuth start request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate action
	if req.Action != "login" && req.Action != "link" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Action must be 'login' or 'link'"})
	}

	// For link action, user must be authenticated
	var userID string
	if req.Action == "link" {
		auth := c.Locals("auth")
		if auth == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required for account linking"})
		}
		// Extract user ID from auth context
		if authCtx, ok := auth.(*middleware.AuthContext); ok && authCtx.IsUser {
			userID = authCtx.User.ObjectID
		} else {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User authentication required for account linking"})
		}
	}

	// Generate state parameter
	state, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate OAuth state: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate state"})
	}

	// Store OAuth state in Redis with 15 minute TTL
	ctx := context.Background()
	sessionKey := fmt.Sprintf("gh:oauth:state:%s", state)
	sessionValue := fmt.Sprintf("%s|%s|%s", userID, req.ReturnURL, req.Action)

	log.Debugf("Storing OAuth session - Key: %s, Value: %s", sessionKey, sessionValue)

	err = h.RedisClient.SetNX(ctx, sessionKey, sessionValue, 15*time.Minute).Err()
	if err != nil {
		log.Errorf("Failed to store OAuth session state: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create session"})
	}

	// Define OAuth scopes - minimal required for user info
	scopes := []string{"user:email"}

	// Generate OAuth URL
	if h.GitHubSvc == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "GitHub service not available"})
	}

	oauthURL := h.GitHubSvc.GetOAuthURL(state, scopes)
	if oauthURL == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate OAuth URL"})
	}

	return c.JSON(StartOAuthResponse{
		OAuthURL: oauthURL,
		State:    state,
	})
}

// ExchangeCode exchanges OAuth code for tokens (called by frontend)
// @Summary Exchange GitHub OAuth code for tokens
// @Description Exchanges GitHub OAuth authorization code for access tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param request body ExchangeCodeRequest true "Code exchange request"
// @Success 200 {object} OAuthCallbackResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /auth/github/exchange [post]
func (h *GitHubAuthHandler) ExchangeCode(c *fiber.Ctx) error {
	var req ExchangeCodeRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse code exchange request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate required fields
	if req.Code == "" || req.State == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Code and state are required"})
	}

	// Retrieve and delete session state from Redis (same as original callback)
	ctx := context.Background()
	sessionKey := fmt.Sprintf("gh:oauth:state:%s", req.State)
	sessionValue, err := h.RedisClient.GetDel(ctx, sessionKey).Result()
	if err != nil {
		if err == redis.Nil {
			log.Warn("OAuth state not found or expired")
			return c.Status(fiber.StatusBadRequest).JSON(OAuthCallbackResponse{
				Success: false,
				Message: "Session expired or invalid state",
			})
		}
		log.Errorf("Failed to retrieve OAuth session state: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Session retrieval failed",
		})
	}

	// Parse session value: {user_id}|{return_url}|{action}
	parts := strings.Split(sessionValue, "|")
	if len(parts) != 3 {
		log.Errorf("Invalid session value format: %s", sessionValue)
		return c.Status(fiber.StatusBadRequest).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Invalid session data",
		})
	}

	storedUserID := parts[0]
	// storedReturnURL := parts[1] // Not used in JSON response, frontend handles redirect
	storedAction := parts[2]

	// Use stored action, not request action (prevents tampering)
	action := storedAction
	userID := storedUserID

	// Validate action
	if action != "login" && action != "link" {
		return c.Status(fiber.StatusBadRequest).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Invalid stored action",
		})
	}

	// For link action, validate user is still authenticated and matches stored user
	if action == "link" {
		auth := c.Locals("auth")
		if auth == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(OAuthCallbackResponse{
				Success: false,
				Message: "Authentication required for account linking",
			})
		}
		if authCtx, ok := auth.(*middleware.AuthContext); ok && authCtx.IsUser {
			if authCtx.User.ObjectID != userID {
				return c.Status(fiber.StatusUnauthorized).JSON(OAuthCallbackResponse{
					Success: false,
					Message: "User mismatch for account linking",
				})
			}
		} else {
			return c.Status(fiber.StatusUnauthorized).JSON(OAuthCallbackResponse{
				Success: false,
				Message: "User authentication required for account linking",
			})
		}
	}

	// Check GitHub service availability
	if h.GitHubSvc == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "GitHub service not available",
		})
	}

	// Exchange code for access token
	accessToken, err := h.GitHubSvc.ExchangeCodeForToken(req.Code)
	if err != nil {
		log.Errorf("Failed to exchange code for token: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to authenticate with GitHub",
		})
	}

	// Get user info from GitHub
	githubUser, err := h.GitHubSvc.GetAuthenticatedUser(accessToken)
	if err != nil {
		log.Errorf("Failed to get GitHub user info: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to get user information",
		})
	}

	// Process based on stored action (not request action)
	switch action {
	case "login":
		return h.handleLoginJSON(c, githubUser)
	case "link":
		return h.handleLinkJSON(c, githubUser, userID)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Invalid stored action",
		})
	}
}

// HandleOAuthCallback processes the GitHub OAuth callback
// @Summary Handle GitHub OAuth callback
// @Description Processes the callback from GitHub OAuth and creates/logs in user
// @Tags auth
// @Accept json
// @Produce json
// @Param code query string true "Authorization code"
// @Param state query string true "State parameter"
// @Success 302 "Redirect to frontend"
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /auth/github/callback [get]
func (h *GitHubAuthHandler) HandleOAuthCallback(c *fiber.Ctx) error {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		log.Warn("Missing code or state in OAuth callback")
		return h.redirectWithError(c, "Missing required parameters")
	}

	// Retrieve and delete session state from Redis
	ctx := context.Background()
	sessionKey := fmt.Sprintf("gh:oauth:state:%s", state)
	sessionValue, err := h.RedisClient.GetDel(ctx, sessionKey).Result()
	if err != nil {
		if err == redis.Nil {
			log.Warn("OAuth state not found or expired")
			return h.redirectWithError(c, "Session expired or invalid")
		}
		log.Errorf("Failed to retrieve OAuth session state: %v", err)
		return h.redirectWithError(c, "Session retrieval failed")
	}

	// Parse session value
	parts := strings.Split(sessionValue, "|")
	if len(parts) != 3 {
		log.Errorf("Invalid session value format: %s", sessionValue)
		return h.redirectWithError(c, "Invalid session data")
	}

	userID := parts[0]
	returnURL := parts[1]
	action := parts[2]

	// Check GitHub service availability
	if h.GitHubSvc == nil {
		return h.redirectWithError(c, "GitHub service not available")
	}

	// Exchange code for access token
	accessToken, err := h.GitHubSvc.ExchangeCodeForToken(code)
	if err != nil {
		log.Errorf("Failed to exchange code for token: %v", err)
		return h.redirectWithError(c, "Failed to authenticate with GitHub")
	}

	// Get user info from GitHub
	githubUser, err := h.GitHubSvc.GetAuthenticatedUser(accessToken)
	if err != nil {
		log.Errorf("Failed to get GitHub user info: %v", err)
		return h.redirectWithError(c, "Failed to get user information")
	}

	// Process based on action
	switch action {
	case "login":
		return h.handleLogin(c, githubUser, returnURL)
	case "link":
		return h.handleLink(c, githubUser, userID, returnURL)
	default:
		log.Errorf("Unknown OAuth action: %s", action)
		return h.redirectWithError(c, "Invalid action")
	}
}

// handleLogin processes login flow - create user if doesn't exist, login if exists
func (h *GitHubAuthHandler) handleLogin(c *fiber.Ctx, githubUser *github.User, returnURL string) error {
	// Check if user exists by GitHub ID
	var user models.User
	err := h.DB.Preload("Organization").Where("git_hub_user_id = ?", githubUser.GetID()).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// User doesn't exist, create new user
		return h.createNewUser(c, githubUser, returnURL)
	} else if err != nil {
		log.Errorf("Database error checking for existing user: %v", err)
		return h.redirectWithError(c, "Database error")
	}

	// User exists, generate tokens and redirect
	return h.loginExistingUser(c, &user, returnURL)
}

// handleLink processes account linking flow
func (h *GitHubAuthHandler) handleLink(c *fiber.Ctx, githubUser *github.User, userID string, returnURL string) error {
	// TODO: Implement account linking
	// This would link the GitHub account to an existing authenticated user
	log.Infof("Account linking not yet implemented for user %s", userID)
	return h.redirectWithError(c, "Account linking not yet implemented")
}

// createNewUser creates a new user from GitHub OAuth data
func (h *GitHubAuthHandler) createNewUser(c *fiber.Ctx, githubUser *github.User, returnURL string) error {
	// Generate user ID
	userID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate user ID: %v", err)
		return h.redirectWithError(c, "Failed to create user")
	}

	// Generate organization ID
	orgID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate organization ID: %v", err)
		return h.redirectWithError(c, "Failed to create organization")
	}

	// Create organization
	org := models.Organization{
		ObjectID:                orgID,
		OrganizationName:        githubUser.GetLogin() + "'s Organization",
		OrganizationDescription: "Organization created via GitHub OAuth",
	}
	if err := h.DB.Create(&org).Error; err != nil {
		log.Errorf("Failed to create organization: %v", err)
		return h.redirectWithError(c, "Failed to create organization")
	}

	// Create user
	user := models.User{
		ObjectID:        userID,
		FirstName:       githubUser.GetName(), // This will be encrypted by BeforeSave
		LastName:        "",
		Username:        githubUser.GetLogin(),
		Email:           githubUser.GetEmail(), // This will be encrypted by BeforeSave
		OrganizationID:  org.ID,
		GitHubUserID:    &[]int64{githubUser.GetID()}[0],
		GitHubUsername:  githubUser.GetLogin(),
		GitHubAvatarURL: githubUser.GetAvatarURL(),
	}

	if err := h.DB.Create(&user).Error; err != nil {
		log.Errorf("Failed to create user: %v", err)
		// Rollback organization creation
		h.DB.Delete(&org)
		return h.redirectWithError(c, "Failed to create user")
	}

	// Assign owner role to the user who created the organization
	var ownerRole models.Role
	if err := h.DB.Where("name = ? AND is_active = ?", "owner", true).First(&ownerRole).Error; err != nil {
		log.Errorf("Failed to find owner role: %v", err)
		// Rollback user and organization creation
		h.DB.Delete(&user)
		h.DB.Delete(&org)
		return h.redirectWithError(c, "Failed to assign user role")
	}

	userRole := models.UserRole{
		UserID:         user.ID,
		RoleID:         ownerRole.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}

	if err := h.DB.Create(&userRole).Error; err != nil {
		log.Errorf("Failed to assign owner role: %v", err)
		// Rollback user and organization creation
		h.DB.Delete(&user)
		h.DB.Delete(&org)
		return h.redirectWithError(c, "Failed to assign user role")
	}

	// Load organization for token generation
	user.Organization = org

	return h.loginExistingUser(c, &user, returnURL)
}

// loginExistingUser generates tokens for existing user and redirects
func (h *GitHubAuthHandler) loginExistingUser(c *fiber.Ctx, user *models.User, returnURL string) error {
	// Generate JWT tokens
	accessToken, err := authz.GenerateAccessToken(user.ObjectID, h.DB)
	if err != nil {
		log.Errorf("Failed to generate access token: %v", err)
		return h.redirectWithError(c, "Failed to generate access token")
	}

	refreshToken, err := authz.GenerateRefreshToken(user.ObjectID)
	if err != nil {
		log.Errorf("Failed to generate refresh token: %v", err)
		return h.redirectWithError(c, "Failed to generate refresh token")
	}

	// Update user refresh tokens
	err = authz.UpdateUserRefreshTokens(user.ObjectID, h.DB, refreshToken, "")
	if err != nil {
		log.Errorf("Failed to update user refresh tokens: %v", err)
	}

	// Redirect to frontend with tokens
	frontendURL := os.Getenv("FRONTEND_URL")
	if returnURL == "" {
		returnURL = "/dashboard"
	}

	expiresIn := int(authz.AccessTokenExpiry.Seconds())

	redirectURL := fmt.Sprintf("%s%s?access_token=%s&refresh_token=%s&expires_in=%d&user_id=%s&organization_id=%s",
		frontendURL, returnURL, accessToken, refreshToken, expiresIn, user.ObjectID, user.Organization.ObjectID)

	return c.Redirect(redirectURL, fiber.StatusFound)
}

// handleLoginJSON processes login flow and returns JSON response
func (h *GitHubAuthHandler) handleLoginJSON(c *fiber.Ctx, githubUser *github.User) error {
	// Check if user exists by GitHub ID
	var user models.User
	err := h.DB.Preload("Organization").Where("git_hub_user_id = ?", githubUser.GetID()).First(&user).Error

	if err == gorm.ErrRecordNotFound {
		// User doesn't exist, create new user
		return h.createNewUserJSON(c, githubUser)
	} else if err != nil {
		log.Errorf("Database error checking for existing user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Database error",
		})
	}

	// User exists, generate tokens and return JSON
	return h.generateTokensJSON(c, &user)
}

// handleLinkJSON processes account linking flow and returns JSON response
func (h *GitHubAuthHandler) handleLinkJSON(c *fiber.Ctx, githubUser *github.User, userID string) error {
	// Check if GitHub account is already linked to another user
	var existingUser models.User
	err := h.DB.Where("git_hub_user_id = ?", githubUser.GetID()).First(&existingUser).Error
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "GitHub account is already linked to another user",
		})
	} else if err != gorm.ErrRecordNotFound {
		log.Errorf("Database error checking for existing GitHub link: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Database error",
		})
	}

	// Get the current user
	var user models.User
	err = h.DB.Preload("Organization").Where("object_id = ?", userID).First(&user).Error
	if err != nil {
		log.Errorf("Failed to find user for linking: %v", err)
		return c.Status(fiber.StatusNotFound).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "User not found",
		})
	}

	// Link GitHub account to user
	user.GitHubUserID = &[]int64{githubUser.GetID()}[0]
	user.GitHubUsername = githubUser.GetLogin()
	user.GitHubAvatarURL = githubUser.GetAvatarURL()

	if err := h.DB.Save(&user).Error; err != nil {
		log.Errorf("Failed to link GitHub account: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to link GitHub account",
		})
	}

	return c.JSON(OAuthCallbackResponse{
		Success:        true,
		Message:        "GitHub account linked successfully",
		UserID:         user.ObjectID,
		OrganizationID: user.Organization.ObjectID,
	})
}

// createNewUserJSON creates a new user from GitHub OAuth data and returns JSON
func (h *GitHubAuthHandler) createNewUserJSON(c *fiber.Ctx, githubUser *github.User) error {
	// Generate user ID
	userID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate user ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to create user",
		})
	}

	// Generate organization ID
	orgID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate organization ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to create organization",
		})
	}

	// Create organization
	org := models.Organization{
		ObjectID:                orgID,
		OrganizationName:        githubUser.GetLogin() + "'s Organization",
		OrganizationDescription: "Organization created via GitHub OAuth",
	}
	if err := h.DB.Create(&org).Error; err != nil {
		log.Errorf("Failed to create organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to create organization",
		})
	}

	// Create user
	user := models.User{
		ObjectID:        userID,
		FirstName:       githubUser.GetName(), // This will be encrypted by BeforeSave
		LastName:        "",
		Username:        githubUser.GetLogin(),
		Email:           githubUser.GetEmail(), // This will be encrypted by BeforeSave
		OrganizationID:  org.ID,
		GitHubUserID:    &[]int64{githubUser.GetID()}[0],
		GitHubUsername:  githubUser.GetLogin(),
		GitHubAvatarURL: githubUser.GetAvatarURL(),
	}

	if err := h.DB.Create(&user).Error; err != nil {
		log.Errorf("Failed to create user: %v", err)
		// Rollback organization creation
		h.DB.Delete(&org)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to create user",
		})
	}

	// Assign owner role to the user who created the organization
	var ownerRole models.Role
	if err := h.DB.Where("name = ? AND is_active = ?", "owner", true).First(&ownerRole).Error; err != nil {
		log.Errorf("Failed to find owner role: %v", err)
		// Rollback user and organization creation
		h.DB.Delete(&user)
		h.DB.Delete(&org)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to assign user role",
		})
	}

	userRole := models.UserRole{
		UserID:         user.ID,
		RoleID:         ownerRole.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}

	if err := h.DB.Create(&userRole).Error; err != nil {
		log.Errorf("Failed to assign owner role: %v", err)
		// Rollback user and organization creation
		h.DB.Delete(&user)
		h.DB.Delete(&org)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to assign user role",
		})
	}

	// Load organization for token generation
	user.Organization = org

	return h.generateTokensJSON(c, &user)
}

// generateTokensJSON generates JWT tokens for user and returns JSON response
func (h *GitHubAuthHandler) generateTokensJSON(c *fiber.Ctx, user *models.User) error {
	// Generate JWT tokens
	accessToken, err := authz.GenerateAccessToken(user.ObjectID, h.DB)
	if err != nil {
		log.Errorf("Failed to generate access token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to generate access token",
		})
	}

	refreshToken, err := authz.GenerateRefreshToken(user.ObjectID)
	if err != nil {
		log.Errorf("Failed to generate refresh token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(OAuthCallbackResponse{
			Success: false,
			Message: "Failed to generate refresh token",
		})
	}

	// Update user refresh tokens
	err = authz.UpdateUserRefreshTokens(user.ObjectID, h.DB, refreshToken, "")
	if err != nil {
		log.Errorf("Failed to update user refresh tokens: %v", err)
	}

	expiresIn := int(authz.AccessTokenExpiry.Seconds())

	return c.JSON(OAuthCallbackResponse{
		Success:        true,
		Message:        "Authentication successful",
		UserID:         user.ObjectID,
		AccessToken:    accessToken,
		RefreshToken:   refreshToken,
		ExpiresIn:      expiresIn,
		Scope:          user.GetPrimaryRole(user.OrganizationID),
		OrganizationID: user.Organization.ObjectID,
	})
}

// Helper method to redirect with error
func (h *GitHubAuthHandler) redirectWithError(c *fiber.Ctx, errorMsg string) error {
	frontendURL := os.Getenv("FRONTEND_URL")
	errorURL := fmt.Sprintf("%s/auth/error?message=%s", frontendURL, errorMsg)
	return c.Redirect(errorURL, fiber.StatusFound)
}
