package handlers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type GoogleAuthHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
	GoogleSvc   *services.GoogleService
}

// Request/Response types (reusing from GitHub auth)
type GoogleStartOAuthRequest struct {
	ReturnURL string `json:"return_url"`
	Action    string `json:"action"` // "login" or "link"
}

type GoogleStartOAuthResponse struct {
	OAuthURL string `json:"oauth_url"`
	State    string `json:"state"`
}

type GoogleOAuthCallbackResponse struct {
	Success        bool   `json:"success"`
	Message        string `json:"message"`
	UserID         string `json:"user_id,omitempty"`
	AccessToken    string `json:"access_token,omitempty"`
	RefreshToken   string `json:"refresh_token,omitempty"`
	ExpiresIn      int    `json:"expires_in,omitempty"`
	Scope          string `json:"scope,omitempty"`
	OrganizationID string `json:"organization_id,omitempty"`
}

type GoogleExchangeCodeRequest struct {
	Code   string `json:"code"`
	State  string `json:"state"`
	Action string `json:"action"` // "login" or "link"
}

// NewGoogleAuthHandler creates a new Google auth handler
func NewGoogleAuthHandler(db *gorm.DB, redisClient *redis.Client) (*GoogleAuthHandler, error) {
	googleSvc, err := services.NewGoogleService()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Google service: %w", err)
	}

	return &GoogleAuthHandler{
		DB:          db,
		RedisClient: redisClient,
		GoogleSvc:   googleSvc,
	}, nil
}

// StartOAuth initiates the Google OAuth flow
// @Summary Start Google OAuth flow
// @Description Initiates Google OAuth flow for user login or account linking
// @Tags auth
// @Accept json
// @Produce json
// @Param request body GoogleStartOAuthRequest true "OAuth start request"
// @Success 200 {object} GoogleStartOAuthResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /auth/google/start [post]
func (h *GoogleAuthHandler) StartOAuth(c *fiber.Ctx) error {
	var req GoogleStartOAuthRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse Google OAuth start request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate action
	if req.Action != "login" && req.Action != "link" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid action. Must be 'login' or 'link'"})
	}

	// For "link" action, user must be authenticated
	var userID string
	if req.Action == "link" {
		userIDInterface := c.Locals("user_id")
		if userIDInterface == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required for account linking"})
		}
		userID = userIDInterface.(string)
	} else {
		// For login, generate a temporary user ID for session tracking
		userID, _ = crypto.GenerateUUID()
	}

	// Generate state parameter for CSRF protection
	state, _ := crypto.GenerateUUID()

	log.Debugf("Starting Google OAuth flow - UserID: %s, Action: %s, State: %s", userID, req.Action, state)

	// Store OAuth state in Redis with 15 minute TTL
	ctx := context.Background()
	sessionKey := fmt.Sprintf("google:oauth:state:%s", state)
	sessionValue := fmt.Sprintf("%s|%s|%s", userID, req.ReturnURL, req.Action)

	log.Debugf("Storing Google OAuth session - Key: %s, Value: %s", sessionKey, sessionValue)

	err := h.RedisClient.SetNX(ctx, sessionKey, sessionValue, 15*time.Minute).Err()
	if err != nil {
		log.Errorf("Failed to store Google OAuth session state: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create session"})
	}

	// Define OAuth scopes
	scopes := []string{"openid", "email", "profile"}

	// Generate OAuth URL
	if h.GoogleSvc == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Google service not available"})
	}

	oauthURL := h.GoogleSvc.GetOAuthURL(state, scopes)
	if oauthURL == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate OAuth URL"})
	}

	return c.JSON(GoogleStartOAuthResponse{
		OAuthURL: oauthURL,
		State:    state,
	})
}

// ExchangeCode exchanges OAuth code for JWT tokens (JSON response)
// @Summary Exchange Google OAuth code for tokens
// @Description Exchanges Google OAuth authorization code for JWT tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param request body GoogleExchangeCodeRequest true "Code exchange request"
// @Success 200 {object} GoogleOAuthCallbackResponse
// @Failure 400 {object} GoogleOAuthCallbackResponse
// @Failure 500 {object} GoogleOAuthCallbackResponse
// @Router /auth/google/exchange [post]
func (h *GoogleAuthHandler) ExchangeCode(c *fiber.Ctx) error {
	var req GoogleExchangeCodeRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse Google OAuth exchange request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Invalid request format",
		})
	}

	if req.Code == "" || req.State == "" {
		log.Warn("Missing code or state in Google OAuth exchange")
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Missing required parameters",
		})
	}

	// Retrieve and validate session state
	ctx := context.Background()
	sessionKey := fmt.Sprintf("google:oauth:state:%s", req.State)
	sessionValue, err := h.RedisClient.Get(ctx, sessionKey).Result()
	if err != nil {
		log.Errorf("Failed to retrieve Google OAuth session state: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Invalid or expired session",
		})
	}

	// Delete the session state (one-time use)
	h.RedisClient.Del(ctx, sessionKey)

	// Parse session value: {user_id}|{return_url}|{action}
	parts := strings.Split(sessionValue, "|")
	if len(parts) != 3 {
		log.Errorf("Invalid Google session value format: %s", sessionValue)
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Invalid session data",
		})
	}

	storedUserID := parts[0]
	storedAction := parts[2]

	// Use stored action, not request action (prevents tampering)
	action := storedAction
	userID := storedUserID

	// Validate action
	if action != "login" && action != "link" {
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Invalid stored action",
		})
	}

	// Check Google service availability
	if h.GoogleSvc == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Google service not available",
		})
	}

	// Exchange code for access token
	accessToken, err := h.GoogleSvc.ExchangeCodeForToken(req.Code)
	if err != nil {
		log.Errorf("Failed to exchange code for Google token: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to authenticate with Google",
		})
	}

	// Get user info from Google
	googleUser, err := h.GoogleSvc.GetUserInfo(accessToken)
	if err != nil {
		log.Errorf("Failed to get Google user info: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to get user information",
		})
	}

	// Process based on stored action
	switch action {
	case "login":
		return h.handleLoginJSON(c, googleUser)
	case "link":
		return h.handleLinkJSON(c, googleUser, userID)
	default:
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Invalid stored action",
		})
	}
}

// handleLoginJSON processes login flow and returns JSON response
func (h *GoogleAuthHandler) handleLoginJSON(c *fiber.Ctx, googleUser *services.GoogleUser) error {
	// First: check if user exists by Google ID
	var user models.User
	err := h.DB.Preload("Organization").Where("google_user_id = ?", googleUser.ID).First(&user).Error

	if err == nil {
		// User exists, generate tokens and return JSON
		return h.generateTokensJSON(c, &user)
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		log.Errorf("Database error checking for existing Google user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Database error",
		})
	}

	// No user by Google ID; try to find existing user by email and attach Google account
	if googleUser.Email != "" {
		existingUser, emailErr := models.FindByEmailWithPreload(h.DB, googleUser.Email, "Organization")
		if emailErr == nil {
			// Attach Google account to existing user
			existingUser.GoogleUserID = googleUser.ID
			existingUser.GoogleEmail = googleUser.Email
			existingUser.GoogleName = googleUser.Name
			existingUser.GooglePicture = googleUser.Picture

			if saveErr := h.DB.Save(existingUser).Error; saveErr != nil {
				log.Errorf("Failed to attach Google account to existing user: %v", saveErr)
				return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
					Success: false,
					Message: "Failed to link Google account",
				})
			}

			return h.generateTokensJSON(c, existingUser)
		} else if emailErr != gorm.ErrRecordNotFound {
			log.Errorf("Database error checking for existing user by email: %v", emailErr)
			return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
				Success: false,
				Message: "Database error",
			})
		}
	}

	// No existing user by Google ID or email; create new user
	return h.createNewUserJSON(c, googleUser)
}

// handleLinkJSON processes account linking flow and returns JSON response
func (h *GoogleAuthHandler) handleLinkJSON(c *fiber.Ctx, googleUser *services.GoogleUser, userID string) error {
	// Check if Google account is already linked to another user
	var existingUser models.User
	err := h.DB.Where("google_user_id = ?", googleUser.ID).First(&existingUser).Error
	if err == nil {
		return c.Status(fiber.StatusBadRequest).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Google account already linked to another user",
		})
	} else if err != gorm.ErrRecordNotFound {
		log.Errorf("Database error checking for existing Google link: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Database error",
		})
	}

	// Get the current user
	var user models.User
	err = h.DB.Preload("Organization").Where("object_id = ?", userID).First(&user).Error
	if err != nil {
		log.Errorf("Failed to find user for linking: %v", err)
		return c.Status(fiber.StatusNotFound).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "User not found",
		})
	}

	// Link Google account to user
	user.GoogleUserID = googleUser.ID
	user.GoogleEmail = googleUser.Email
	user.GoogleName = googleUser.Name
	user.GooglePicture = googleUser.Picture

	err = h.DB.Save(&user).Error
	if err != nil {
		log.Errorf("Failed to link Google account: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to link account",
		})
	}

	return c.JSON(GoogleOAuthCallbackResponse{
		Success:        true,
		Message:        "Google account linked successfully",
		UserID:         user.ObjectID,
		OrganizationID: user.Organization.ObjectID,
	})
}

// createNewUserJSON creates a new user from Google OAuth data and returns JSON
func (h *GoogleAuthHandler) createNewUserJSON(c *fiber.Ctx, googleUser *services.GoogleUser) error {
	// Generate organization ID
	orgID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate organization ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to create organization",
		})
	}

	// Create new organization for the user
	org := models.Organization{
		ObjectID:         orgID,
		OrganizationName: fmt.Sprintf("%s's Organization", googleUser.Name),
	}

	err = h.DB.Create(&org).Error
	if err != nil {
		log.Errorf("Failed to create organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to create organization",
		})
	}

	// Generate user ID
	userID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate user ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to create user",
		})
	}

	// Create new user
	user := models.User{
		ObjectID:       userID,
		FirstName:      googleUser.Name,
		Email:          googleUser.Email,
		Username:       googleUser.Email,
		Verified:       true,
		OrganizationID: org.ID,
		GoogleUserID:   googleUser.ID,
		GoogleEmail:    googleUser.Email,
		GoogleName:     googleUser.Name,
		GooglePicture:  googleUser.Picture,
	}

	// Omit Phone so it stays NULL/omitted and doesn't collide on uni_users_phone
	err = h.DB.Omit("Phone").Create(&user).Error
	if err != nil {
		log.Errorf("Failed to create user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to create user",
		})
	}

	// Assign owner role to the user who created the organization
	var ownerRole models.Role
	if err := h.DB.Where("name = ? AND is_active = ?", "owner", true).First(&ownerRole).Error; err != nil {
		log.Errorf("Failed to find owner role: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
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
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to assign user role",
		})
	}

	// Load organization for token generation
	user.Organization = org

	return h.generateTokensJSON(c, &user)
}

// generateTokensJSON generates tokens for user and returns JSON response
func (h *GoogleAuthHandler) generateTokensJSON(c *fiber.Ctx, user *models.User) error {
	// Generate JWT tokens
	accessToken, err := authz.GenerateAccessToken(user.ObjectID, h.DB)
	if err != nil {
		log.Errorf("Failed to generate access token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
			Success: false,
			Message: "Failed to generate access token",
		})
	}

	refreshToken, err := authz.GenerateRefreshToken(user.ObjectID)
	if err != nil {
		log.Errorf("Failed to generate refresh token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(GoogleOAuthCallbackResponse{
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

	return c.JSON(GoogleOAuthCallbackResponse{
		Success:        true,
		Message:        "Login successful",
		UserID:         user.ObjectID,
		AccessToken:    accessToken,
		RefreshToken:   refreshToken,
		ExpiresIn:      expiresIn,
		OrganizationID: user.Organization.ObjectID,
	})
}
