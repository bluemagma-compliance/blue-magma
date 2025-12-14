package handlers

import (
	"encoding/json"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type DocumentationTemplateHandler struct {
	DB *gorm.DB
}

func NewDocumentationTemplateHandler(db *gorm.DB) *DocumentationTemplateHandler {
	return &DocumentationTemplateHandler{DB: db}
}

type DocumentPage struct {
	ID        string         `json:"id"`
	Title     string         `json:"title"`
	Content   string         `json:"content"`
	Order     int            `json:"order"`
	Children  []DocumentPage `json:"children"`
	CreatedAt string         `json:"createdAt"`
	UpdatedAt string         `json:"updatedAt"`
}

type SaveDocumentationTemplateRequest struct {
	Pages []DocumentPage `json:"pages"`
}

type DocumentationTemplateResponse struct {
	ObjectID  string         `json:"object_id"`
	ProjectID string         `json:"project_id"`
	Pages     []DocumentPage `json:"pages"`
	CreatedAt string         `json:"created_at"`
	UpdatedAt string         `json:"updated_at"`
}

func buildResponse(t models.DocumentationTemplate, pages []DocumentPage, project models.Project) DocumentationTemplateResponse {
	return DocumentationTemplateResponse{
		ObjectID:  t.ObjectID,
		ProjectID: project.ObjectID,
		Pages:     pages,
		CreatedAt: t.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt: t.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

// GetDocumentationTemplate returns the documentation template for a project
// @Summary Get documentation template for a project
// @Tags DocumentationTemplate
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Success 200 {object} DocumentationTemplateResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/documentation-template [get]
// @Security Bearer
func (h *DocumentationTemplateHandler) GetDocumentationTemplate(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectObjID := c.Params("project_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectObjID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	var tmpl models.DocumentationTemplate
	if err := h.DB.Where("organization_id = ? AND project_id = ?", org.ID, project.ID).First(&tmpl).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Documentation template not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch documentation template"})
	}

	// Parse JSON into pages
	var payload struct{ Pages []DocumentPage `json:"pages"` }
	if len(tmpl.Template) > 0 {
		_ = json.Unmarshal(tmpl.Template, &payload)
	}

	return c.JSON(buildResponse(tmpl, payload.Pages, project))
}

// UpsertDocumentationTemplate saves or updates the documentation template for a project
// @Summary Save documentation template for a project
// @Tags DocumentationTemplate
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param request body SaveDocumentationTemplateRequest true "Template pages"
// @Success 200 {object} DocumentationTemplateResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/documentation-template [put]
// @Security Bearer
func (h *DocumentationTemplateHandler) UpsertDocumentationTemplate(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectObjID := c.Params("project_id")

	var req SaveDocumentationTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Find org and project
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectObjID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	// Serialize pages -> JSON
	payload := struct{ Pages []DocumentPage `json:"pages"` }{Pages: req.Pages}
	bytes, err := json.Marshal(payload)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to encode template"})
	}

	var tmpl models.DocumentationTemplate
	err = h.DB.Where("organization_id = ? AND project_id = ?", org.ID, project.ID).First(&tmpl).Error
	if err == gorm.ErrRecordNotFound {
		objID, _ := crypto.GenerateUUID()
		tmpl = models.DocumentationTemplate{
			ObjectID:       objID,
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			Template:       datatypes.JSON(bytes),
		}
		if err := h.DB.Create(&tmpl).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation template"})
		}
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch documentation template"})
	} else {
		// Update existing
		tmpl.Template = datatypes.JSON(bytes)
		if err := h.DB.Save(&tmpl).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update documentation template"})
		}
	}

	return c.JSON(buildResponse(tmpl, req.Pages, project))
}

