package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	log "github.com/sirupsen/logrus"
)

// SignupHandler handles user signup requests
type SignupHandler struct {
	DB    *gorm.DB
	Redis *redis.Client
}

type signupRequest struct {
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Phone      string `json:"phone"`
	AccessCode string `json:"access_code"`
}

type SignupResponse struct {
	Success        bool   `json:"success"`
	Message        string `json:"message"`
	UserID         string `json:"user_id"`
	AccessToken    string `json:"access_token,omitempty"`
	RefreshToken   string `json:"refresh_token,omitempty"`
	ExpiresIn      int    `json:"expires_in,omitempty"`
	Scope          string `json:"scope,omitempty"`
	OrganizationID string `json:"organization_id,omitempty"`
}

// @Summary User signup
// @Description Handles user signup
// @Tags auth
// @Accept json
// @Produce json
// @Param body body signupRequest true "User signup request"
// @Success 201 {object} SignupResponse
// @Failure 400 {object} SignupResponse
// @Failure 409 {object} SignupResponse
// @Router /auth/signup [post]
func (h *SignupHandler) HandleSignup(c *fiber.Ctx) error {
	var req signupRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(SignupResponse{
			Success: false,
			Message: "Invalid request format",
		})
	}

	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Password == "" || req.Phone == "" {
		log.Warn("Missing required fields in signup request")
		return c.Status(fiber.StatusBadRequest).JSON(SignupResponse{
			Success: false,
			Message: "All fields are required",
		})
	}

	// Access codes are now entirely optional. If provided, we currently ignore them.
	// This keeps the request shape backward compatible while allowing open signup.

	// Check if user already exists by email using email hash for fast lookup
	if _, err := models.FindByEmail(h.DB, req.Email); err == nil {
		log.Warnf("User with email %s already exists", req.Email)
		return c.Status(fiber.StatusConflict).JSON(SignupResponse{
			Success: false,
			Message: "User already exists",
		})
	}

	hash, err := crypto.HashPassword(req.Password)
	if err != nil {
		log.Errorf("Failed to hash password: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to hash password",
		})
	}

	// generate a unique organization ID uuid
	orgID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate organization ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to generate organization ID",
		})
	}

	// create a generic organization for the user
	org := models.Organization{
		ObjectID:                orgID,
		OrganizationName:        req.FirstName + " " + req.LastName + "'s Organization",
		OrganizationDescription: "Your brand new organization",
	}
	if err := h.DB.Create(&org).Error; err != nil {
		log.Errorf("Failed to create organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to create organization",
		})
	}

	userID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate user ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to generate user ID",
		})
	}

	user := models.User{
		ObjectID:       userID,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		Email:          req.Email,
		Phone:          &req.Phone,
		Verified:       true, // we will implement email verification later,
		Organization:   org,
		OrganizationID: org.ID,
		Username:       req.Email,
	}

	user.SetPasswordHash(hash)

	if err := h.DB.Create(&user).Error; err != nil {
		log.Errorf("Failed to create user: %v", err)
		// Rollback organization creation if user creation fails
		if err := h.DB.Delete(&org).Error; err != nil {
			log.Errorf("Failed to rollback organization creation: %v", err)
		}
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to create user",
		})
	}

	// Assign owner role to the user
	var ownerRole models.Role
	if err := h.DB.Where("name = ?", "owner").First(&ownerRole).Error; err != nil {
		log.Errorf("Failed to find owner role: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
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
		log.Errorf("Failed to create user role: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to assign user role",
		})
	}

	// Generate JWT tokens
	log.Debugf("Generating JWT tokens for user ID: %s", user.ObjectID)
	accessToken, err := authz.GenerateAccessToken(user.ObjectID, h.DB)
	if err != nil {
		log.Errorf("Failed to generate access token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to generate access token",
		})
	}
	expirationTime := authz.AccessTokenExpiry
	refreshToken, err := authz.GenerateRefreshToken(user.ObjectID)
	if err != nil {
		log.Errorf("Failed to generate refresh token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SignupResponse{
			Success: false,
			Message: "Failed to generate refresh token",
		})
	}

	// add the new refresh token to the user
	err = authz.UpdateUserRefreshTokens(user.ObjectID, h.DB, refreshToken, "")
	if err != nil {
		log.Errorf("Failed to update user refresh tokens: %v", err)
	}

	return c.Status(fiber.StatusCreated).JSON(SignupResponse{
		Success:        true,
		Message:        "User created successfully",
		UserID:         user.ObjectID,
		AccessToken:    accessToken,
		RefreshToken:   refreshToken,
		ExpiresIn:      int(expirationTime.Seconds()),
		Scope:          "owner", // Since we just assigned owner role
		OrganizationID: orgID,
	})
}
