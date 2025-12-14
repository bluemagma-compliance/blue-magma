package admin

import (
	"encoding/json"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ProjectTemplateHandler struct {
	DB *gorm.DB
}

func NewProjectTemplateHandler(db *gorm.DB) *ProjectTemplateHandler {
	return &ProjectTemplateHandler{DB: db}
}

type CreateProjectTemplateRequest struct {
	Title        string      `json:"title"`
	Description  string      `json:"description"`
	Category     string      `json:"category"`
	TemplateData interface{} `json:"template_data"`
}

type UpdateProjectTemplateRequest struct {
	Title        string      `json:"title"`
	Description  string      `json:"description"`
	Category     string      `json:"category"`
	TemplateData interface{} `json:"template_data"`
	IsActive     *bool       `json:"is_active"`
}

type ProjectTemplateResponse struct {
	ObjectID     string      `json:"object_id"`
	Title        string      `json:"title"`
	Description  string      `json:"description"`
	Category     string      `json:"category"`
	TemplateData interface{} `json:"template_data"`
	IsActive     bool        `json:"is_active"`
	CreatedAt    string      `json:"created_at"`
	UpdatedAt    string      `json:"updated_at"`
}

// CreateProjectTemplate - Create a new public project template (super-admin only)
func (h *ProjectTemplateHandler) CreateProjectTemplate(c *fiber.Ctx) error {
	var req CreateProjectTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if req.Title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Title is required"})
	}
	if req.TemplateData == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Template data is required"})
	}

	// Convert template_data to JSON
	templateDataJSON, err := json.Marshal(req.TemplateData)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid template data format"})
	}

	// Generate UUID
	objectID, err := crypto.GenerateUUID()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Create project template (always organization_id = 1 for public templates)
	template := models.ProjectTemplate{
		ObjectID:       objectID,
		OrganizationID: 1, // Public organization
		Title:          req.Title,
		Description:    req.Description,
		Category:       req.Category,
		TemplateData:   datatypes.JSON(templateDataJSON),
		IsActive:       true,
	}

	if err := h.DB.Create(&template).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create project template"})
	}

	// Parse template_data for response
	var templateData interface{}
	json.Unmarshal(template.TemplateData, &templateData)

	response := ProjectTemplateResponse{
		ObjectID:     template.ObjectID,
		Title:        template.Title,
		Description:  template.Description,
		Category:     template.Category,
		TemplateData: templateData,
		IsActive:     template.IsActive,
		CreatedAt:    template.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:    template.UpdatedAt.Format("2006-01-02 15:04:05"),
	}

	return c.Status(fiber.StatusCreated).JSON(response)
}

// UpdateProjectTemplate - Update an existing project template (super-admin only)
func (h *ProjectTemplateHandler) UpdateProjectTemplate(c *fiber.Ctx) error {
	templateID := c.Params("template_id")

	var template models.ProjectTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", templateID, 1).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project template not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project template"})
	}

	var req UpdateProjectTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields
	if req.Title != "" {
		template.Title = req.Title
	}
	template.Description = req.Description
	template.Category = req.Category

	if req.TemplateData != nil {
		templateDataJSON, err := json.Marshal(req.TemplateData)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid template data format"})
		}
		template.TemplateData = datatypes.JSON(templateDataJSON)
	}

	if req.IsActive != nil {
		template.IsActive = *req.IsActive
	}

	if err := h.DB.Save(&template).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update project template"})
	}

	// Parse template_data for response
	var templateData interface{}
	json.Unmarshal(template.TemplateData, &templateData)

	response := ProjectTemplateResponse{
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

// DeleteProjectTemplate - Delete a project template (super-admin only)
func (h *ProjectTemplateHandler) DeleteProjectTemplate(c *fiber.Ctx) error {
	templateID := c.Params("template_id")

	var template models.ProjectTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", templateID, 1).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project template not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project template"})
	}

	if err := h.DB.Delete(&template).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete project template"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// GetAllProjectTemplates - List all project templates including inactive (super-admin only)
func (h *ProjectTemplateHandler) GetAllProjectTemplates(c *fiber.Ctx) error {
	var templates []models.ProjectTemplate

	// Get all templates (including inactive)
	if err := h.DB.Where("organization_id = ?", 1).Find(&templates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project templates"})
	}

	// Build response (without template_data for performance)
	var response []fiber.Map
	for _, t := range templates {
		response = append(response, fiber.Map{
			"object_id":   t.ObjectID,
			"title":       t.Title,
			"description": t.Description,
			"category":    t.Category,
			"is_active":   t.IsActive,
			"created_at":  t.CreatedAt.Format("2006-01-02 15:04:05"),
			"updated_at":  t.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	return c.JSON(response)
}

// GetProjectTemplate - Get a single project template with full details (super-admin only)
func (h *ProjectTemplateHandler) GetProjectTemplate(c *fiber.Ctx) error {
	templateID := c.Params("template_id")

	var template models.ProjectTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", templateID, 1).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project template not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project template"})
	}

	// Parse template_data for response
	var templateData interface{}
	json.Unmarshal(template.TemplateData, &templateData)

	response := ProjectTemplateResponse{
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
