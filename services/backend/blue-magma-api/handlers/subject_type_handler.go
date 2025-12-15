package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type SubjectTypeHandler struct {
	db *gorm.DB
}

func NewSubjectTypeHandler(db *gorm.DB) *SubjectTypeHandler {
	return &SubjectTypeHandler{
		db: db,
	}
}

// GetAllSubjectTypes retrieves all subject types from the database.
// @Summary Get all subject types
// @Description Retrieve all subject types from the database
// @Tags Subject Types
// @Accept json
// @Produce json
// @Success 200 {array} models.SubjectType
// @Failure 500 {object} fiber.Error
// @Router /api/v1/subject-types [get]
// @Security Bearer
func (h *SubjectTypeHandler) GetAllSubjectTypes(c *fiber.Ctx) error {
	var subjectTypes []models.SubjectType
	if err := h.db.Find(&subjectTypes).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to retrieve subject types")
	}

	return c.JSON(subjectTypes)
}
