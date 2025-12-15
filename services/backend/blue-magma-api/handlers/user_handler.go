package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{DB: db}
}

// UserMeResponse represents the response for GET /users/me
type UserMeResponse struct {
	UserID         string `json:"user_id"`
	Email          string `json:"email"`
	Name           string `json:"name"`
	OrganizationID uint   `json:"organization_id"`
	Role           string `json:"role"`
	ChatMemory     string `json:"chat_memory"`
	UserTitle      string `json:"user_title"`
	UserRole       string `json:"user_role"`
	UserKnowledge  string `json:"user_knowledge"`
}

// UpdateChatMemoryRequest represents the payload for updating chat memory
type UpdateChatMemoryRequest struct {
	ChatMemory string `json:"chat_memory"`
}

// GetCurrentUser returns the current authenticated user's information
// @Summary Get current user
// @Description Get current authenticated user's information including chat memory
// @Tags users
// @Produce json
// @Success 200 {object} UserMeResponse
// @Failure 401 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/users/me [get]
// @Security Bearer
func (h *UserHandler) GetCurrentUser(c *fiber.Ctx) error {
	// Get auth context from middleware
	auth := c.Locals("auth").(*middleware.AuthContext)
	if auth == nil || auth.User == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Fetch user with UserRoles preloaded to get the role
	var user models.User
	if err := h.DB.Preload("UserRoles.Role").
		Where("id = ?", auth.User.ID).
		First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "user not found",
			})
		}
		log.Errorf("Failed to fetch user: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch user",
		})
	}

	// Get primary role for the user's organization
	role := user.GetPrimaryRole(user.OrganizationID)

	// Build response
	response := UserMeResponse{
		UserID:         user.ObjectID,
		Email:          user.Email,
		Name:           user.FirstName,
		OrganizationID: user.OrganizationID,
		Role:           role,
		ChatMemory:     user.ChatMemory,
		UserTitle:      user.UserTitle,
		UserRole:       user.UserRole,
		UserKnowledge:  user.UserKnowledge,
	}

	return c.JSON(response)
}

// UpdateCurrentUserChatMemory updates the chat memory for the current authenticated user
// @Summary Update current user's chat memory
// @Description Update chat_memory JSON for the authenticated user
// @Tags users
// @Accept json
// @Produce json
// @Param request body UpdateChatMemoryRequest true "Chat memory payload"
// @Success 200 {object} UserMeResponse
// @Failure 400 {object} fiber.Map
// @Failure 401 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/users/me/chat-memory [patch]
// @Security Bearer
func (h *UserHandler) UpdateCurrentUserChatMemory(c *fiber.Ctx) error {
	// Get auth context from middleware
	auth := c.Locals("auth").(*middleware.AuthContext)
	if auth == nil || auth.User == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "authentication required",
		})
	}

	// Parse request body
	var req UpdateChatMemoryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request format",
		})
	}

	// Fetch user with UserRoles preloaded to get the role
	var user models.User
	if err := h.DB.Preload("UserRoles.Role").
		Where("id = ?", auth.User.ID).
		First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "user not found",
			})
		}
		log.Errorf("Failed to fetch user for chat memory update: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch user",
		})
	}

	// Update chat memory
	user.ChatMemory = req.ChatMemory
	if err := h.DB.Save(&user).Error; err != nil {
		log.Errorf("Failed to update chat memory: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update chat memory",
		})
	}

	// Get primary role for the user's organization
	role := user.GetPrimaryRole(user.OrganizationID)

	// Build response
	response := UserMeResponse{
		UserID:         user.ObjectID,
		Email:          user.Email,
		Name:           user.FirstName,
		OrganizationID: user.OrganizationID,
		Role:           role,
		ChatMemory:     user.ChatMemory,
		UserTitle:      user.UserTitle,
		UserRole:       user.UserRole,
		UserKnowledge:  user.UserKnowledge,
	}

	return c.JSON(response)
}
