package handlers

import (
	"fmt"
	"os"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type InvitationHandler struct {
	DB           *gorm.DB
	EmailService *services.EmailService
}

type SendInvitationRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Role      string `json:"role" validate:"required"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
}

type SendInvitationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	UserID  string `json:"user_id,omitempty"`
}

type AcceptInvitationRequest struct {
	Token     string `json:"token" validate:"required"`
	FirstName string `json:"first_name" validate:"required"`
	LastName  string `json:"last_name" validate:"required"`
	Password  string `json:"password" validate:"required,min=8"`
	Phone     string `json:"phone,omitempty"`
}

type ValidateInvitationResponse struct {
	Valid            bool   `json:"valid"`
	Email            string `json:"email,omitempty"`
	OrganizationName string `json:"organization_name,omitempty"`
	Role             string `json:"role,omitempty"`
	InviterName      string `json:"inviter_name,omitempty"`
	ExpiresAt        string `json:"expires_at,omitempty"`
	Message          string `json:"message,omitempty"`
}

type AcceptInvitationResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	UserID  string `json:"user_id"`
}

// SendInvitation sends an invitation email to a new user
// @Summary Send user invitation
// @Description Send an invitation email to invite a new user to the organization
// @Tags Invitations
// @Accept json
// @Produce json
// @Security Bearer
// @Param org_id path string true "Organization ID"
// @Param body body SendInvitationRequest true "Invitation request"
// @Success 200 {object} SendInvitationResponse
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/org/{org_id}/users/invite [post]
func (h *InvitationHandler) SendInvitation(c *fiber.Ctx) error {
	auth := c.Locals("auth").(*middleware.AuthContext)
	if !auth.IsUser {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	var req SendInvitationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	// Check if user already exists using email hash for fast lookup
	if _, err := models.FindByEmail(h.DB, req.Email); err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "user with this email already exists",
		})
	}

	// Generate invitation token
	token, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate invitation token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate invitation token",
		})
	}

	// Set expiration (48 hours from now)
	expiresAt := time.Now().Add(48 * time.Hour)

	// Generate user ID
	userID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate user ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to generate user ID",
		})
	}

	// Create user record with invitation status
	user := models.User{
		ObjectID:            userID,
		Email:               req.Email,
		FirstName:           req.FirstName,
		LastName:            req.LastName,
		Username:            req.Email,
		OrganizationID:      auth.User.OrganizationID,
		Verified:            false,
		InvitationToken:     token,
		InvitationExpiresAt: &expiresAt,
		InvitedByUserID:     &auth.User.ID,
		InvitationStatus:    "pending",
	}

	if err := h.DB.Create(&user).Error; err != nil {
		log.Errorf("Failed to create user invitation: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create invitation",
		})
	}

	// Assign role to the user
	var role models.Role
	if err := h.DB.Where("name = ? AND is_active = ?", req.Role, true).First(&role).Error; err != nil {
		log.Errorf("Failed to find role %s: %v", req.Role, err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid role specified",
		})
	}

	userRole := models.UserRole{
		UserID:         user.ID,
		RoleID:         role.ID,
		OrganizationID: auth.User.OrganizationID,
		IsActive:       false, // Will be activated when invitation is accepted
	}

	if err := h.DB.Create(&userRole).Error; err != nil {
		log.Errorf("Failed to assign role: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to assign role",
		})
	}

	// Send invitation email
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000" // Default for development
	}

	emailData := services.InvitationEmailData{
		InvitedUserEmail: req.Email,
		InviterName:      fmt.Sprintf("%s %s", auth.User.FirstName, auth.User.LastName),
		OrganizationName: auth.User.Organization.OrganizationName,
		Role:             req.Role,
		InvitationURL:    fmt.Sprintf("%s/invite/%s", frontendURL, token),
		ExpirationDate:   expiresAt.Format("January 2, 2006 at 3:04 PM MST"),
	}

	if err := h.EmailService.SendInvitationEmail(emailData); err != nil {
		log.Errorf("Failed to send invitation email: %v", err)
		// Don't fail the request if email fails, but log it
		// The invitation is still created and can be resent
	}

	log.Infof("User %d sent invitation to %s for organization %d", auth.User.ID, req.Email, auth.User.OrganizationID)

	return c.JSON(SendInvitationResponse{
		Success: true,
		Message: "invitation sent successfully",
		UserID:  userID,
	})
}

// ValidateInvitation validates an invitation token
// @Summary Validate invitation token
// @Description Validate an invitation token and return invitation details
// @Tags Invitations
// @Accept json
// @Produce json
// @Param token path string true "Invitation token"
// @Success 200 {object} ValidateInvitationResponse
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /auth/invitation/{token}/validate [get]
func (h *InvitationHandler) ValidateInvitation(c *fiber.Ctx) error {
	token := c.Params("token")
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invitation token is required",
		})
	}

	var user models.User
	if err := h.DB.Preload("Organization").
		Where("invitation_token = ? AND invitation_status = ?", token, "pending").
		First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.JSON(ValidateInvitationResponse{
				Valid:   false,
				Message: "invalid or expired invitation",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to validate invitation",
		})
	}

	// Check if invitation has expired
	if user.InvitationExpiresAt != nil && time.Now().After(*user.InvitationExpiresAt) {
		// Mark as expired
		h.DB.Model(&user).Update("invitation_status", "expired")
		return c.JSON(ValidateInvitationResponse{
			Valid:   false,
			Message: "invitation has expired",
		})
	}

	// Get inviter information
	var inviter models.User
	inviterName := "Unknown"
	if user.InvitedByUserID != nil {
		if err := h.DB.Where("id = ?", *user.InvitedByUserID).First(&inviter).Error; err == nil {
			inviterName = fmt.Sprintf("%s %s", inviter.FirstName, inviter.LastName)
		}
	}

	// Get role information
	var userRole models.UserRole
	role := "Unknown"
	if err := h.DB.Preload("Role").Where("user_id = ?", user.ID).First(&userRole).Error; err == nil {
		role = userRole.Role.Name
	}

	return c.JSON(ValidateInvitationResponse{
		Valid:            true,
		Email:            user.Email,
		OrganizationName: user.Organization.OrganizationName,
		Role:             role,
		InviterName:      inviterName,
		ExpiresAt:        user.InvitationExpiresAt.Format(time.RFC3339),
	})
}

// AcceptInvitation accepts an invitation and completes user setup
// @Summary Accept invitation
// @Description Accept an invitation and complete user account setup
// @Tags Invitations
// @Accept json
// @Produce json
// @Param body body AcceptInvitationRequest true "Accept invitation request"
// @Success 200 {object} AcceptInvitationResponse
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /auth/invitation/accept [post]
func (h *InvitationHandler) AcceptInvitation(c *fiber.Ctx) error {
	var req AcceptInvitationRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	// Find user by invitation token
	var user models.User
	if err := h.DB.Preload("Organization").
		Where("invitation_token = ? AND invitation_status = ?", req.Token, "pending").
		First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "invalid or expired invitation",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to find invitation",
		})
	}

	// Check if invitation has expired
	if user.InvitationExpiresAt != nil && time.Now().After(*user.InvitationExpiresAt) {
		h.DB.Model(&user).Update("invitation_status", "expired")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invitation has expired",
		})
	}

	// Hash password
	hash, err := crypto.HashPassword(req.Password)
	if err != nil {
		log.Errorf("Failed to hash password: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to process password",
		})
	}

	// Update user with complete information
	now := time.Now()
	user.FirstName = req.FirstName
	user.LastName = req.LastName
	if req.Phone != "" {
		user.Phone = &req.Phone
	} else {
		user.Phone = nil
	}
	user.SetPasswordHash(hash)
	user.Verified = true
	user.InvitationStatus = "accepted"
	user.InvitationAcceptedAt = &now
	user.InvitationToken = "" // Clear the token for security

	// Use Save() instead of Updates() to trigger BeforeSave hook for encryption
	if err := h.DB.Save(&user).Error; err != nil {
		log.Errorf("Failed to update user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to complete invitation",
		})
	}

	// Activate user role
	if err := h.DB.Model(&models.UserRole{}).
		Where("user_id = ?", user.ID).
		Update("is_active", true).Error; err != nil {
		log.Errorf("Failed to activate user role: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to activate user role",
		})
	}

	log.Infof("User %s accepted invitation for organization %d", user.Email, user.OrganizationID)

	return c.JSON(AcceptInvitationResponse{
		Success: true,
		Message: "invitation accepted successfully",
		UserID:  user.ObjectID,
	})
}
