package handlers

import (
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ComplianceTemplateHandler struct {
	DB *gorm.DB
}

func NewComplianceTemplateHandler(db *gorm.DB) *ComplianceTemplateHandler {
	return &ComplianceTemplateHandler{DB: db}
}

// JSON structure matching the provided schema
type ComplianceTemplateJSON struct {
	Name        string                        `json:"name"`
	Description string                        `json:"description"`
	Version     string                        `json:"version,omitempty"`
	Source      string                        `json:"source,omitempty"`
	Sections    []ComplianceTemplateSectionJSON `json:"sections"`
}

type ComplianceTemplateSectionJSON struct {
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	Rules       []ComplianceTemplateRuleJSON `json:"rules"`
}

type ComplianceTemplateRuleJSON struct {
	Name  string   `json:"name"`
	Rule  string   `json:"rule"`
	Scope string   `json:"scope"`
	Tags  []string `json:"tags"`
}

// Response structures - reusing existing response types
type ComplianceTemplateResponse struct {
	ObjectID    string                    `json:"object_id"`
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	Version     string                    `json:"version"`     // Extracted from rules' PolicyVersion
	Source      string                    `json:"source"`      // Extracted from rules' Source
	Active      bool                      `json:"active"`
	Sections    []TemplateSectionResponse `json:"sections"`    // Reuse existing TemplateSectionResponse
}

// CreateFromJSON creates a compliance template from JSON
// @Summary Create compliance template from JSON
// @Description Import a compliance template from JSON format
// @Tags compliance-template
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param template body ComplianceTemplateJSON true "Compliance Template JSON"
// @Success 201 {object} ComplianceTemplateResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/compliance-template/import [post]
// @Security Bearer
func (h *ComplianceTemplateHandler) CreateFromJSON(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	// Get organization
	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Parse JSON request
	var templateJSON ComplianceTemplateJSON
	if err := c.BodyParser(&templateJSON); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON format"})
	}

	// Validate required fields
	if templateJSON.Name == "" || templateJSON.Description == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name and description are required"})
	}

	// Start transaction
	tx := h.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create ReportTemplate (reusing existing model for compliance template)
	templateObjectID, _ := crypto.GenerateUUID()
	reportTemplate := models.ReportTemplate{
		ObjectID:       templateObjectID,
		OrganizationID: org.ID,
		Name:           templateJSON.Name,
		Description:    templateJSON.Description,
		Active:         true, // Always active for imported compliance templates
		Codebases:      []models.Codebase{}, // Empty for compliance templates
	}

	if err := tx.Create(&reportTemplate).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create compliance template"})
	}

	// Create sections and rules using existing models
	var sections []models.TemplateSection
	for _, sectionJSON := range templateJSON.Sections {
		sectionObjectID, _ := crypto.GenerateUUID()
		section := models.TemplateSection{
			ObjectID:       sectionObjectID,
			OrganizationID: org.ID,
			Name:           sectionJSON.Name,
			Description:    sectionJSON.Description,
			TemplateID:     reportTemplate.ID, // Link to ReportTemplate
		}

		if err := tx.Create(&section).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create section: " + sectionJSON.Name})
		}

		// Create rules for this section using existing Rule model
		var rules []models.Rule
		for _, ruleJSON := range sectionJSON.Rules {
			ruleObjectID, _ := crypto.GenerateUUID()
			rule := models.Rule{
				ObjectID:       ruleObjectID,
				OrganizationID: org.ID,
				Name:           ruleJSON.Name,
				Rule:           ruleJSON.Rule,
				Scope:          ruleJSON.Scope,
				Tags:           strings.Join(ruleJSON.Tags, ","),
				Source:         templateJSON.Source,        // From template level
				PolicyName:     templateJSON.Name,          // Template name as policy
				PolicyVersion:  templateJSON.Version,       // Template version
				Description:    ruleJSON.Rule,              // Use rule text as description
				Public:         false,                      // Private to organization
				Level:          "medium",                   // Default level
				Section:        sectionJSON.Name,           // Section name
			}

			if err := tx.Create(&rule).Error; err != nil {
				tx.Rollback()
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create rule: " + ruleJSON.Name})
			}
			rules = append(rules, rule)
		}

		// Associate rules with section using existing many-to-many relationship
		if err := tx.Model(&section).Association("Rules").Append(&rules); err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Failed to associate rules with section"})
		}

		section.Rules = rules
		sections = append(sections, section)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to commit transaction"})
	}

	// Build response using existing response builder pattern
	response := h.buildComplianceTemplateResponse(reportTemplate, sections, templateJSON.Version, templateJSON.Source, org)
	return c.Status(201).JSON(response)
}

// Helper function to build response using existing models
func (h *ComplianceTemplateHandler) buildComplianceTemplateResponse(template models.ReportTemplate, sections []models.TemplateSection, version, source string, org models.Organization) ComplianceTemplateResponse {
	// Initialize response as empty array to avoid returning null when no sections exist
	sectionsResponse := make([]TemplateSectionResponse, 0)
	for _, section := range sections {
		// Reuse existing BuildSectionResponse function
		sectionResponse := BuildSectionResponse(org, section.Rules, section)
		sectionsResponse = append(sectionsResponse, sectionResponse)
	}

	return ComplianceTemplateResponse{
		ObjectID:    template.ObjectID,
		Name:        template.Name,
		Description: template.Description,
		Version:     version,  // From JSON input
		Source:      source,   // From JSON input
		Active:      template.Active,
		Sections:    sectionsResponse,
	}
}

// GetComplianceTemplates retrieves all compliance templates for an organization
// @Summary Get all compliance templates
// @Description Get all compliance templates for an organization
// @Tags compliance-template
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {array} ComplianceTemplateResponse
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/compliance-template [get]
// @Security Bearer
func (h *ComplianceTemplateHandler) GetComplianceTemplates(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	// Get organization
	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Get all ReportTemplates for the organization (compliance templates are stored as ReportTemplates)
	var templates []models.ReportTemplate
	if err := h.DB.Where("organization_id = ?", org.ID).Find(&templates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve compliance templates"})
	}

	// Build responses
	// Initialize response as empty array to avoid returning null when no templates exist
	responses := make([]ComplianceTemplateResponse, 0)
	for _, template := range templates {
		// Get sections for this template
		var sections []models.TemplateSection
		if err := h.DB.Preload("Rules").Where("template_id = ?", template.ID).Find(&sections).Error; err != nil {
			continue // Skip templates with no sections or errors
		}

		// Extract version and source from first rule (if any)
		version, source := "", ""
		if len(sections) > 0 && len(sections[0].Rules) > 0 {
			version = sections[0].Rules[0].PolicyVersion
			source = sections[0].Rules[0].Source
		}

		response := h.buildComplianceTemplateResponse(template, sections, version, source, org)
		responses = append(responses, response)
	}

	return c.JSON(responses)
}

// GetComplianceTemplate retrieves a single compliance template
// @Summary Get compliance template by ID
// @Description Get a single compliance template by its ID
// @Tags compliance-template
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param template_id path string true "Compliance Template ID"
// @Success 200 {object} ComplianceTemplateResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/compliance-template/{template_id} [get]
// @Security Bearer
func (h *ComplianceTemplateHandler) GetComplianceTemplate(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	templateId := c.Params("template_id")

	// Get organization
	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Get ReportTemplate (compliance template)
	var template models.ReportTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", templateId, org.ID).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Compliance template not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve compliance template"})
	}

	// Get sections for this template
	var sections []models.TemplateSection
	if err := h.DB.Preload("Rules").Where("template_id = ?", template.ID).Find(&sections).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve template sections"})
	}

	// Extract version and source from first rule (if any)
	version, source := "", ""
	if len(sections) > 0 && len(sections[0].Rules) > 0 {
		version = sections[0].Rules[0].PolicyVersion
		source = sections[0].Rules[0].Source
	}

	response := h.buildComplianceTemplateResponse(template, sections, version, source, org)
	return c.JSON(response)
}

// DeleteComplianceTemplate deletes a compliance template
// @Summary Delete compliance template
// @Description Delete a compliance template and all its sections and rules
// @Tags compliance-template
// @Param org_id path string true "Organization ID"
// @Param template_id path string true "Compliance Template ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/compliance-template/{template_id} [delete]
// @Security Bearer
func (h *ComplianceTemplateHandler) DeleteComplianceTemplate(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	templateId := c.Params("template_id")

	// Get organization
	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Get ReportTemplate (compliance template)
	var template models.ReportTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", templateId, org.ID).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Compliance template not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find compliance template"})
	}

	// Delete the template (cascade will handle sections and rules via existing relationships)
	if err := h.DB.Delete(&template).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete compliance template"})
	}

	return c.SendStatus(204)
}

// ExportComplianceTemplate exports a compliance template to JSON format
// @Summary Export compliance template to JSON
// @Description Export a compliance template to the same JSON format used for import
// @Tags compliance-template
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param template_id path string true "Compliance Template ID"
// @Success 200 {object} ComplianceTemplateJSON
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/compliance-template/{template_id}/export [get]
// @Security Bearer
func (h *ComplianceTemplateHandler) ExportComplianceTemplate(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	templateId := c.Params("template_id")

	// Get organization
	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Get ReportTemplate (compliance template)
	var template models.ReportTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", templateId, org.ID).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Compliance template not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve compliance template"})
	}

	// Get sections for this template with rules
	var sections []models.TemplateSection
	if err := h.DB.Preload("Rules").Where("template_id = ?", template.ID).Find(&sections).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve template sections"})
	}

	// Extract version and source from first rule (if any)
	version, source := "", ""
	if len(sections) > 0 && len(sections[0].Rules) > 0 {
		version = sections[0].Rules[0].PolicyVersion
		source = sections[0].Rules[0].Source
	}

	// Build export JSON structure
	exportJSON := h.buildExportJSON(template, sections, version, source)
	return c.JSON(exportJSON)
}

// Helper function to build export JSON from existing models
func (h *ComplianceTemplateHandler) buildExportJSON(template models.ReportTemplate, sections []models.TemplateSection, version, source string) ComplianceTemplateJSON {
	var sectionsJSON []ComplianceTemplateSectionJSON

	for _, section := range sections {
		var rulesJSON []ComplianceTemplateRuleJSON

		for _, rule := range section.Rules {
			// Parse tags from comma-separated string back to slice
			var tags []string
			if rule.Tags != "" {
				tags = strings.Split(rule.Tags, ",")
				// Trim whitespace from each tag
				for i, tag := range tags {
					tags[i] = strings.TrimSpace(tag)
				}
			}

			ruleJSON := ComplianceTemplateRuleJSON{
				Name:  rule.Name,
				Rule:  rule.Rule,
				Scope: rule.Scope,
				Tags:  tags,
			}
			rulesJSON = append(rulesJSON, ruleJSON)
		}

		sectionJSON := ComplianceTemplateSectionJSON{
			Name:        section.Name,
			Description: section.Description,
			Rules:       rulesJSON,
		}
		sectionsJSON = append(sectionsJSON, sectionJSON)
	}

	return ComplianceTemplateJSON{
		Name:        template.Name,
		Description: template.Description,
		Version:     version,
		Source:      source,
		Sections:    sectionsJSON,
	}
}
