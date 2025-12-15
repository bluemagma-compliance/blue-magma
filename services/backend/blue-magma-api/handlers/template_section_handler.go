package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type TemplateSectionHandler struct {
	DB *gorm.DB
}

func NewTemplateSectionHandler(db *gorm.DB) *TemplateSectionHandler {
	return &TemplateSectionHandler{DB: db}
}

type TemplateSectionRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	TemplateID  string   `json:"template_id"`
	Rules       []string `json:"rules"` // List of rule object IDs
}

type TemplateSectionResponse struct {
	ObjectID    string         `json:"object_id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	TemplateID  string         `json:"template_id"`
	Rules       []RuleResponse `json:"rules"` // List of rule object IDs
}

func BuildSectionResponse(org models.Organization, rules []models.Rule, templateSection models.TemplateSection) TemplateSectionResponse {

	// build the rules response
	var rulesResponse []RuleResponse
	for _, rule := range rules {
		rulesResponse = append(rulesResponse, RuleResponse{
			ObjectID:      rule.ObjectID,
			Name:          rule.Name,
			Description:   rule.Description,
			Rule:          rule.Rule,
			PolicyName:    rule.PolicyName,
			PolicyVersion: rule.PolicyVersion,
			Scope:         rule.Scope,
			Tags:          rule.Tags,
			Public:        rule.Public,
			Source:        rule.Source,
			Severity:      rule.Level,
			Section:       rule.Section,
		})
	}

	return TemplateSectionResponse{
		ObjectID:    templateSection.ObjectID,
		Name:        templateSection.Name,
		Description: templateSection.Description,
		TemplateID:  templateSection.Template.ObjectID,
		Rules:       rulesResponse,
	}

}

// @Summary Create a new template section
// @Description Create a new template section with the provided details
// @Tags TemplateSection
// @Accept json
// @Produce json
// @Param request body TemplateSectionRequest true "Template Section Request"
// @Param org_id path string true "Organization ID"
// @Success 201 {object} TemplateSectionResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/template-section [post]
// @Security Bearer
func (h *TemplateSectionHandler) CreateTemplateSection(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var request TemplateSectionRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Validate the request
	if request.Name == "" || request.Description == "" || request.TemplateID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name, description, and template ID are required"})
	}

	// find the template by ID
	var template models.ReportTemplate
	if err := h.DB.Where("object_id = ?", request.TemplateID).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Template not found"})
		}

		return c.Status(500).JSON(fiber.Map{"error": "Failed to find template"})
	}

	// find all the rules by their object IDs
	var rules []models.Rule
	if len(request.Rules) > 0 {
		if err := h.DB.Where("object_id IN ?", request.Rules).Find(&rules).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to find rules"})
		}
	}

	objectID, _ := crypto.GenerateUUID()

	// Create the template section in the database
	templateSection := models.TemplateSection{
		ObjectID:       objectID,
		Name:           request.Name,
		Description:    request.Description,
		TemplateID:     template.ID,
		Rules:          rules,
		OrganizationID: org.ID, // Assuming a function to get the current organization ID
	}

	if err := h.DB.Create(&templateSection).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create template section"})
	}

	response := BuildSectionResponse(org, rules, templateSection)
	return c.Status(201).JSON(response)
}

// only edit fields that are not empty in the request
// @Summary Edit an existing template section
// @Description Edit an existing template section with the provided details
// @Tags TemplateSection
// @Accept json
// @Produce json
// @Param request body TemplateSectionRequest true "Template Section Request"
// @Param org_id path string true "Organization ID"
// @Param section_id path string true "Template Section ID"
// @Success 200 {object} TemplateSectionResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/template-section/{section_id} [put]
// @Security Bearer
func (h *TemplateSectionHandler) EditTemplateSection(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	sectionId := c.Params("section_id")

	var request TemplateSectionRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Find the template section by ID
	var templateSection models.TemplateSection
	if err := h.DB.Where("object_id = ?", sectionId).First(&templateSection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Template section not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find template section"})
	}

	// Update fields that are provided in the request
	if request.Name != "" {
		templateSection.Name = request.Name
	}
	if request.Description != "" {
		templateSection.Description = request.Description
	}

	if len(request.Rules) > 0 {
		var rules []models.Rule
		if err := h.DB.Where("object_id IN ?", request.Rules).Find(&rules).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to find rules"})
		}
		if err := h.DB.Model(&templateSection).Association("Rules").Replace(&rules); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update rules"})
		}
	}

	if err := h.DB.Save(&templateSection).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update template section"})
	}
	response := BuildSectionResponse(org, templateSection.Rules, templateSection)
	return c.Status(200).JSON(response)
}

// @Summary Delete a template section
// @Description Delete a template section by its ID
// @Tags TemplateSection
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param section_id path string true "Template Section ID"
// @Success 204
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/template-section/{section_id} [delete]
// @Security Bearer
func (h *TemplateSectionHandler) DeleteTemplateSection(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	sectionId := c.Params("section_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Find the template section by ID
	var templateSection models.TemplateSection
	if err := h.DB.Where("object_id = ?", sectionId).First(&templateSection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Template section not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find template section"})
	}

	if err := h.DB.Delete(&templateSection).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete template section"})
	}

	return c.SendStatus(204)
}
