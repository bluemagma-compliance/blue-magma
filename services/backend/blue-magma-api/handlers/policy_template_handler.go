package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type PolicyTemplateHandler struct {
	DB *gorm.DB
}

func NewPolicyTemplateHandler(db *gorm.DB) *PolicyTemplateHandler {
	return &PolicyTemplateHandler{DB: db}
}

type CreatePolicyTemplateRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Content     string `json:"content"`
	Category    string `json:"category"`
}

type UpdatePolicyTemplateRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Content     string `json:"content"`
	Category    string `json:"category"`
}

type PolicyTemplateResponse struct {
	ObjectID    string `json:"object_id"`
	ProjectID   string `json:"project_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Content     string `json:"content"`
	Category    string `json:"category"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

func buildPolicyTemplateResponse(pt models.PolicyTemplate, project models.Project) PolicyTemplateResponse {
	return PolicyTemplateResponse{
		ObjectID:    pt.ObjectID,
		ProjectID:   project.ObjectID,
		Title:       pt.Title,
		Description: pt.Description,
		Content:     pt.Content,
		Category:    pt.Category,
		CreatedAt:   pt.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:   pt.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

// GetPolicyTemplates - List all policy templates for a project
func (h *PolicyTemplateHandler) GetPolicyTemplates(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")

	// Find organization
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch organization"})
	}

	// Find project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project"})
	}

	// Find all policy templates for this project
	var policyTemplates []models.PolicyTemplate
	if err := h.DB.Where("project_id = ? AND organization_id = ?", project.ID, org.ID).Find(&policyTemplates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch policy templates"})
	}

	// Build response
	var response []PolicyTemplateResponse
	for _, pt := range policyTemplates {
		response = append(response, buildPolicyTemplateResponse(pt, project))
	}

	return c.JSON(response)
}

// GetPolicyTemplate - Get a single policy template
func (h *PolicyTemplateHandler) GetPolicyTemplate(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	policyID := c.Params("policy_id")

	// Find organization
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch organization"})
	}

	// Find project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project"})
	}

	// Find policy template
	var policyTemplate models.PolicyTemplate
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", policyID, project.ID, org.ID).First(&policyTemplate).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Policy template not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch policy template"})
	}

	return c.JSON(buildPolicyTemplateResponse(policyTemplate, project))
}

// CreatePolicyTemplate - Create a new policy template
func (h *PolicyTemplateHandler) CreatePolicyTemplate(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")

	// Find organization
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch organization"})
	}

	// Find project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project"})
	}

	// Parse request
	var req CreatePolicyTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if req.Title == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Title is required"})
	}

	// Generate UUID
	objectID, err := crypto.GenerateUUID()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Create policy template
	policyTemplate := models.PolicyTemplate{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Title:          req.Title,
		Description:    req.Description,
		Content:        req.Content,
		Category:       req.Category,
	}

	if err := h.DB.Create(&policyTemplate).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create policy template"})
	}

	return c.Status(fiber.StatusCreated).JSON(buildPolicyTemplateResponse(policyTemplate, project))
}

// UpdatePolicyTemplate - Update an existing policy template
func (h *PolicyTemplateHandler) UpdatePolicyTemplate(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	policyID := c.Params("policy_id")

	// Find organization
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch organization"})
	}

	// Find project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project"})
	}

	// Find policy template
	var policyTemplate models.PolicyTemplate
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", policyID, project.ID, org.ID).First(&policyTemplate).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Policy template not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch policy template"})
	}

	// Parse request
	var req UpdatePolicyTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields
	if req.Title != "" {
		policyTemplate.Title = req.Title
	}
	policyTemplate.Description = req.Description
	policyTemplate.Content = req.Content
	policyTemplate.Category = req.Category

	if err := h.DB.Save(&policyTemplate).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update policy template"})
	}

	return c.JSON(buildPolicyTemplateResponse(policyTemplate, project))
}

// DeletePolicyTemplate - Delete a policy template
func (h *PolicyTemplateHandler) DeletePolicyTemplate(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	policyID := c.Params("policy_id")

	// Find organization
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch organization"})
	}

	// Find project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch project"})
	}

	// Find policy template
	var policyTemplate models.PolicyTemplate
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", policyID, project.ID, org.ID).First(&policyTemplate).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Policy template not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch policy template"})
	}

	// Delete policy template
	if err := h.DB.Delete(&policyTemplate).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete policy template"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
