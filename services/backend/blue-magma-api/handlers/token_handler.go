package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	log "github.com/sirupsen/logrus"
)

// TokenHandler handles OAuth 2.0 token requests
type TokenHandler struct {
	DB *gorm.DB
}

// NewTokenHandler creates a new TokenHandler instance
func NewTokenHandler(db *gorm.DB) *TokenHandler {
	return &TokenHandler{
		DB: db,
	}
}

// TokenRequest represents the OAuth 2.0 token request
type TokenRequest struct {
	GrantType    string `json:"grant_type" form:"grant_type"`
	Username     string `json:"username" form:"username"`
	Password     string `json:"password" form:"password"`
	RefreshToken string `json:"refresh_token" form:"refresh_token"`
}

// TokenResponse represents the OAuth 2.0 token response
type TokenResponse struct {
	AccessToken    string `json:"access_token"`
	TokenType      string `json:"token_type"`
	ExpiresIn      int    `json:"expires_in"`
	RefreshToken   string `json:"refresh_token,omitempty"`
	Scope          string `json:"scope,omitempty"`
	OrganizationID string `json:"organization_id,omitempty"`
}

// RevokeTokenRequest represents a request to revoke a refresh token
type RevokeTokenRequest struct {
	RefreshToken string `json:"refresh_token" form:"refresh_token"`
}

// @Summary OAuth 2.0 token endpoint
// @Description Handles OAuth 2.0 token requests (password grant and refresh token grant)
// @Tags auth
// @Accept json
// @Produce json
// @Param body body TokenRequest true "Token request"
// @Success 200 {object} TokenResponse
// @Failure 400 {object} fiber.Map
// @Failure 401 {object} fiber.Map
// @Router /auth/token [post]
func (h *TokenHandler) HandleToken(c *fiber.Ctx) error {
	var req TokenRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse token request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Invalid request format",
		})
	}

	switch req.GrantType {
	case "password":
		return h.handlePasswordGrant(c, req)
	case "refresh_token":
		return h.handleRefreshTokenGrant(c, req)
	default:
		log.Warnf("Unsupported grant type: %s", req.GrantType)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "unsupported_grant_type",
			"error_description": "The authorization grant type is not supported",
		})
	}
}

// @Summary Revoke refresh token
// @Description Revokes a refresh token, making it invalid for future use
// @Tags auth
// @Accept json
// @Produce json
// @Param body body RevokeTokenRequest true "Revoke token request"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 401 {object} fiber.Map
// @Router /auth/revoke [post]
func (h *TokenHandler) RevokeToken(c *fiber.Ctx) error {
	var req RevokeTokenRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse revoke token request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Invalid request format",
		})
	}

	if req.RefreshToken == "" {
		log.Warn("Missing refresh token in revoke request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Refresh token is required",
		})
	}

	auth := authz.TokenService{}

	// Parse the refresh token to get the user ID
	userID, err := auth.ParseRefreshToken(req.RefreshToken)
	if err != nil {
		log.Warnf("Invalid refresh token: %v", err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":             "invalid_grant",
			"error_description": "Invalid refresh token",
		})
	}

	// Remove the refresh token from the user
	err = authz.UpdateUserRefreshTokens(userID, h.DB, "", req.RefreshToken)
	if err != nil {
		log.Errorf("Failed to revoke refresh token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":             "server_error",
			"error_description": "Failed to revoke refresh token",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Token revoked successfully",
	})
}

// handlePasswordGrant handles the password grant type
func (h *TokenHandler) handlePasswordGrant(c *fiber.Ctx, req TokenRequest) error {
	if req.Username == "" || req.Password == "" {
		log.Warn("Missing username or password in password grant request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Username and password are required",
		})
	}

	// Find user by email (username) using email hash for fast lookup
	user, err := models.FindByEmailWithPreload(h.DB, req.Username, "Organization", "UserRoles.Role")
	if err != nil {
		log.Warnf("User not found: %s", req.Username)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":             "invalid_grant",
			"error_description": "Invalid username or password",
		})
	}

	// Verify password
	passwordHash := user.GetPasswordHash()

	if !crypto.CheckPasswordHash(req.Password, passwordHash) {
		log.Warnf("Invalid password for user: %s", req.Username)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":             "invalid_grant",
			"error_description": "Invalid username or password",
		})
	}

	// Generate tokens
	accessToken, err := authz.GenerateAccessToken(user.ObjectID, h.DB)
	if err != nil {
		log.Errorf("Failed to generate access token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":             "server_error",
			"error_description": "Failed to generate access token",
		})
	}

	// get the expiration time of the access token
	expirationTime := authz.AccessTokenExpiry

	refreshToken, err := authz.GenerateRefreshToken(user.ObjectID)
	if err != nil {
		log.Errorf("Failed to generate refresh token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":             "server_error",
			"error_description": "Failed to generate refresh token",
		})
	}

	// add the new refresh token to the user
	err = authz.UpdateUserRefreshTokens(user.ObjectID, h.DB, refreshToken, "")
	if err != nil {
		log.Errorf("Failed to update user refresh tokens: %v", err)
	}

	// Get user's primary role for the organization
	primaryRole := user.GetPrimaryRole(user.OrganizationID)

	return c.JSON(TokenResponse{
		AccessToken:    accessToken,
		TokenType:      "Bearer",
		ExpiresIn:      int(expirationTime.Seconds()),
		RefreshToken:   refreshToken,
		Scope:          primaryRole,
		OrganizationID: user.Organization.ObjectID,
	})
}

// handleRefreshTokenGrant handles the refresh token grant type
func (h *TokenHandler) handleRefreshTokenGrant(c *fiber.Ctx, req TokenRequest) error {
	if req.RefreshToken == "" {
		log.Warn("Missing refresh token in refresh token grant request")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Refresh token is required",
		})
	}
	auth := authz.TokenService{}
	// Parse the refresh token to get the user ID
	userID, err := auth.ParseRefreshToken(req.RefreshToken)
	if err != nil {
		log.Warnf("Invalid refresh token: %v", err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":             "invalid_grant",
			"error_description": "Invalid refresh token",
		})
	}

	found, err := auth.FindRefreshToken(userID, req.RefreshToken, h.DB)
	if err != nil {
		log.Warnf("Failed to find refresh token: %v", err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":             "invalid_grant",
			"error_description": "Invalid refresh token",
		})
	}
	if !found {
		log.Warnf("Refresh token not found for user %s", userID)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":             "invalid_grant",
			"error_description": "Invalid refresh token",
		})
	}

	// Verify user exists
	var user models.User
	if err := h.DB.Preload("Organization").Preload("UserRoles.Role").Where("object_id = ?", userID).First(&user).Error; err != nil {
		log.Warnf("User not found for refresh token: %s", userID)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":             "invalid_grant",
			"error_description": "User not found",
		})
	}

	// Generate new tokens
	accessToken, err := authz.GenerateAccessToken(user.ObjectID, h.DB)
	if err != nil {
		log.Errorf("Failed to generate access token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":             "server_error",
			"error_description": "Failed to generate access token",
		})
	}

	// get the expiration time of the access token
	expirationTime := authz.AccessTokenExpiry

	refreshToken, err := authz.GenerateRefreshToken(user.ObjectID)
	if err != nil {
		log.Errorf("Failed to generate refresh token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":             "server_error",
			"error_description": "Failed to generate refresh token",
		})
	}

	// remove the old refresh token from the user and add the new one
	err = authz.UpdateUserRefreshTokens(user.ObjectID, h.DB, refreshToken, req.RefreshToken)
	if err != nil {
		log.Errorf("Failed to update user refresh tokens: %v", err)
	}

	// Get user's primary role for the organization
	primaryRole := user.GetPrimaryRole(user.OrganizationID)

	return c.JSON(TokenResponse{
		AccessToken:    accessToken,
		TokenType:      "Bearer",
		ExpiresIn:      int(expirationTime.Seconds()),
		RefreshToken:   refreshToken,
		Scope:          primaryRole,
		OrganizationID: user.Organization.ObjectID,
	})
}
