package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ProjectTemplateHandler struct {
	DB *gorm.DB
}

func NewProjectTemplateHandler(db *gorm.DB) *ProjectTemplateHandler {
	return &ProjectTemplateHandler{DB: db}
}

type ProjectTemplateListResponse struct {
	ObjectID    string `json:"object_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"`
	IsActive    bool   `json:"is_active"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type ProjectTemplateDetailResponse struct {
	ObjectID     string      `json:"object_id"`
	Title        string      `json:"title"`
	Description  string      `json:"description"`
	Category     string      `json:"category"`
	TemplateData interface{} `json:"template_data"`
	IsActive     bool        `json:"is_active"`
	CreatedAt    string      `json:"created_at"`
	UpdatedAt    string      `json:"updated_at"`
}

// GetProjectTemplates - List all public project templates
func (h *ProjectTemplateHandler) GetProjectTemplates(c *fiber.Ctx) error {
	var templates []models.ProjectTemplate

	// Query for public templates (organization_id = 1) that are active
	if err := h.DB.Where("organization_id = ? AND is_active = ?", 1, true).Find(&templates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project templates"})
	}

	// Build response (without template_data for performance)
	// Initialize response as empty array to avoid returning null when no templates exist
	response := make([]ProjectTemplateListResponse, 0)
	for _, t := range templates {
		response = append(response, ProjectTemplateListResponse{
			ObjectID:    t.ObjectID,
			Title:       t.Title,
			Description: t.Description,
			Category:    t.Category,
			IsActive:    t.IsActive,
			CreatedAt:   t.CreatedAt.Format("2006-01-02 15:04:05"),
			UpdatedAt:   t.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	return c.JSON(response)
}

// GetProjectTemplate - Get a single project template with full details
func (h *ProjectTemplateHandler) GetProjectTemplate(c *fiber.Ctx) error {
	templateID := c.Params("template_id")

	var template models.ProjectTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ? AND is_active = ?", templateID, 1, true).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project template not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project template"})
	}

	// Parse template_data JSON
	var templateData interface{}
	if err := template.TemplateData.UnmarshalJSON(template.TemplateData); err == nil {
		templateData = template.TemplateData
	}

	response := ProjectTemplateDetailResponse{
		ObjectID:     template.ObjectID,
		Title:        template.Title,
		Description:  template.Description,
		Category:     template.Category,
		TemplateData: templateData,
		IsActive:     template.IsActive,
		CreatedAt:    template.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:    template.UpdatedAt.Format("2006-01-02 15:04:05"),
	}

	return c.JSON(response)
}

