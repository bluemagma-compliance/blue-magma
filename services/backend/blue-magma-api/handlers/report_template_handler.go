package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ReportTemplateHandler struct {
	DB *gorm.DB
}

func NewReportTemplateHandler(db *gorm.DB) *ReportTemplateHandler {
	return &ReportTemplateHandler{
		DB: db,
	}
}

type ReportTemplateRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Codebases   []string `json:"codebases"`
	Active      bool     `json:"active"` // Indicates if the template is active or not
}

type ReportTemplateResponse struct {
	ObjectID       string                    `json:"object_id"`
	OrganizationID string                    `json:"organization_id"`
	Name           string                    `json:"name"`
	Description    string                    `json:"description"`
	Codebases      []CodebaseResponse        `json:"codebases"`
	Sections       []TemplateSectionResponse `json:"sections"` // List of section responses
	Active         bool                      `json:"active"`   // Indicates if the template is active or not
}

func (h *ReportTemplateHandler) BuildTemplateResponse(template models.ReportTemplate, org models.Organization) ReportTemplateResponse {

	codebasesResponse := []CodebaseResponse{}
	for _, codebase := range template.Codebases {
		codebasesResponse = append(codebasesResponse, CodebaseResponse{
			ObjectID:            codebase.ObjectID,
			CodebaseName:        codebase.ServiceName,
			CodebaseDescription: codebase.ServiceDescription,
			CodebaseType:        codebase.SubjectType.Name,
		})
	}

	// find all sections that belong to this template, return empty if not found
	var sections []models.TemplateSection
	if err := h.DB.Preload("Rules").Where("template_id = ?", template.ID).Find(&sections).Error; err != nil {
		return ReportTemplateResponse{
			ObjectID:    template.ObjectID,
			Name:        template.Name,
			Description: template.Description,
			Codebases:   codebasesResponse,
			Sections:    []TemplateSectionResponse{},
			Active:      template.Active,
		}
	}

	// get rules for each section
	sectionsResponse := make([]TemplateSectionResponse, 0)
	for _, section := range sections {
		sectionResponse := BuildSectionResponse(org, section.Rules, section)
		sectionsResponse = append(sectionsResponse, sectionResponse)
	}

	response := ReportTemplateResponse{
		ObjectID:    template.ObjectID,
		Name:        template.Name,
		Description: template.Description,
		Codebases:   codebasesResponse,
		Sections:    sectionsResponse,
		Active:      template.Active,
	}
	return response
}

// CreateReportTemplate handles the creation of a new report template for an organization.
// It expects the organization ID as a URL parameter and the report template details in the request body.
// @Summary Create a new report template
// @Description Create a new report template for an organization.
// @Tags ReportTemplate
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param request body ReportTemplateRequest true "Report Template Request"
// @Success 201 {object} ReportTemplateResponse
// @Failure 400 {object} fiber.Map "Invalid request body"
// @Failure 404 {object} fiber.Map "Organization not found"
// @Failure 500 {object} fiber.Map "Failed to create report template"
// @Router /api/v1/org/{org_id}/report-template [post]
// @Security Bearer
func (h *ReportTemplateHandler) CreateReportTemplate(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var request ReportTemplateRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	org := models.Organization{}
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Organization not found",
		})
	}

	// find the codebases and rules by their object IDs
	var codebases []models.Codebase
	if len(request.Codebases) > 0 {
		if err := h.DB.Preload("SubjectType").Where("object_id IN ?", request.Codebases).Find(&codebases).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Codebases not found",
			})
		}
	}

	objectId, _ := crypto.GenerateUUID()

	reportTemplate := models.ReportTemplate{
		ObjectID:       objectId,
		OrganizationID: org.ID,
		Name:           request.Name,
		Description:    request.Description,
		Codebases:      codebases,
		Active:         request.Active,
	}

	if err := h.DB.Create(&reportTemplate).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create report template",
		})
	}

	response := h.BuildTemplateResponse(reportTemplate, org)

	return c.Status(fiber.StatusCreated).JSON(response)
}

// GetReportTemplates retrieves all report templates for an organization.
// It expects the organization ID as a URL parameter.
// @Summary Get all report templates for an organization
// @Description Retrieve all report templates for an organization.
// @Tags ReportTemplate
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {array} ReportTemplateResponse
// @Failure 404 {object} fiber.Map "Organization not found"
// @Failure 500 {object} fiber.Map "Failed to retrieve report templates"
// @Router /api/v1/org/{org_id}/report-template [get]
// @Security Bearer
func (h *ReportTemplateHandler) GetReportTemplates(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	org := models.Organization{}
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Organization not found",
		})
	}

	var reportTemplates []models.ReportTemplate
	if err := h.DB.Preload("Codebases").Where("organization_id = ?", org.ID).Find(&reportTemplates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve report templates",
		})
	}

	// Initialize response as empty array to ensure JSON returns [] instead of null
	response := make([]ReportTemplateResponse, 0)
	for _, template := range reportTemplates {
		response = append(response, h.BuildTemplateResponse(template, org))
	}

	return c.JSON(response)
}

// GetReportTemplate retrieves a specific report template by its object ID.
// It expects the organization ID as a URL parameter and the report template object ID as a query parameter.
// @Summary Get a report template by object ID
// @Description Retrieve a specific report template by its object ID.
// @Tags ReportTemplate
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_template_id path string true "Template object ID"
// @Success 200 {object} ReportTemplateResponse
// @Failure 400 {object} fiber.Map "Invalid request"
// @Failure 404 {object} fiber.Map "Report template not found"
// @Failure 500 {object} fiber.Map "Failed to retrieve report template"
// @Router /api/v1/org/{org_id}/report-template/{report_template_id} [get]
// @Security Bearer
func (h *ReportTemplateHandler) GetReportTemplate(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	objectId := c.Params("report_template_id")
	if objectId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Report template object ID is required",
		})
	}
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Organization not found",
		})
	}
	var reportTemplate models.ReportTemplate
	if err := h.DB.Preload("Codebases").First(&reportTemplate, "object_id = ? AND organization_id = ?", objectId, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Report template not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve report template",
		})
	}
	response := h.BuildTemplateResponse(reportTemplate, org)
	return c.JSON(response)
}

// DeleteReportTemplate deletes a report template by its object ID.
// It expects the organization ID as a URL parameter and the report template object ID as a query parameter.
// @Summary Delete a report template
// @Description Delete a report template by its object ID.
// @Tags ReportTemplate
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_template_id path string true "Template object ID"
// @Success 204 "Report template deleted successfully"
// @Failure 400 {object} fiber.Map "Invalid request"
// @Failure 404 {object} fiber.Map "Report template not found"
// @Failure 500 {object} fiber.Map "Failed to delete report template"
// @Router /api/v1/org/{org_id}/report-template/{report_template_id} [delete]
// @Security Bearer
func (h *ReportTemplateHandler) DeleteReportTemplate(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	objectId := c.Params("report_template_id")

	if objectId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Report template object ID is required",
		})
	}

	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Organization not found",
		})
	}

	var reportTemplate models.ReportTemplate
	if err := h.DB.First(&reportTemplate, "object_id = ? AND organization_id = ?", objectId, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Report template not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve report template",
		})
	}

	if err := h.DB.Delete(&reportTemplate).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete report template",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// UpdateReportTemplate updates an existing report template.
// It expects the organization ID as a URL parameter and the report template object ID as a query parameter. It only updates non empty values in the request body.
// @Summary Update a report template
// @Description Update an existing report template.
// @Tags ReportTemplate
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_template_id path string true "Template object ID"
// @Param request body ReportTemplateRequest true "Report Template Request"
// @Success 200 {object} ReportTemplateResponse
// @Failure 400 {object} fiber.Map "Invalid request"
// @Failure 404 {object} fiber.Map "Report template not found"
// @Failure 500 {object} fiber.Map "Failed to update report template"
// @Router /api/v1/org/{org_id}/report-template/{report_template_id} [put]
// @Security Bearer
func (h *ReportTemplateHandler) UpdateReportTemplate(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	objectId := c.Params("report_template_id")

	if objectId == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Report template object ID is required",
		})
	}

	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Organization not found",
		})
	}

	var reportTemplate models.ReportTemplate
	if err := h.DB.First(&reportTemplate, "object_id = ? AND organization_id = ?", objectId, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Report template not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to retrieve report template",
		})
	}

	var request ReportTemplateRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	if request.Name != "" {
		reportTemplate.Name = request.Name
	}
	if request.Description != "" {
		reportTemplate.Description = request.Description
	}
	reportTemplate.Active = request.Active

	if len(request.Codebases) > 0 {
		var codebases []models.Codebase
		if err := h.DB.Where("object_id IN ?", request.Codebases).Find(&codebases).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Codebases not found",
			})
		}
		if err := h.DB.Model(&reportTemplate).Association("Codebases").Replace(&codebases); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update codebases"})
		}
	}

	if err := h.DB.Save(&reportTemplate).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update report template",
		})
	}

	response := h.BuildTemplateResponse(reportTemplate, org)

	return c.JSON(response)
}
