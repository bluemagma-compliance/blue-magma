package handlers

import (
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ReportHandler struct {
	DB *gorm.DB
}

func NewReportHandler(db *gorm.DB) *ReportHandler {
	return &ReportHandler{DB: db}
}

type ReportRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`      // Status of the report (e.g., "draft", "finalized")
	TemplateID  string `json:"template_id"` // Foreign key to ReportTemplate
}

type ReportResponse struct {
	ObjectID    string `json:"object_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"`      // Status of the report (e.g., "draft", "finalized")
	TemplateID  string `json:"template_id"` // Foreign key to ReportTemplate
	CreatedAt   string `json:"created_at"`

	// Summary fields
	Summary              string  `json:"summary"`
	CompliantCount       int     `json:"compliant_count"`
	NonCompliantCount    int     `json:"non_compliant_count"`
	IndeterminateCount   int     `json:"indeterminate_count"`
	TotalRulingsCount    int     `json:"total_rulings_count"`
	CompliancePercentage float64 `json:"compliance_percentage"`

	Sections        []ReportSectionResponse  `json:"sections"`         // List of sections associated with the report
	ActionableItems []ActionableItemResponse `json:"actionable_items"` // List of actionable items for the report
}

func BuildReportResponse(org models.Organization, report models.Report, sections []models.ReportSection, db *gorm.DB) ReportResponse {
	// Build the sections response and collect all rulings
	var sectionsResponse []ReportSectionResponse
	var allRulings []models.Ruling

	for _, section := range sections {
		// Preload rulings for each section with Rule details
		var rulings []models.Ruling
		if err := db.Preload("Rule").Where("report_section_id = ?", section.ID).Find(&rulings).Error; err != nil {
			// Handle error if needed
			continue
		}
		allRulings = append(allRulings, rulings...)
		sectionsResponse = append(sectionsResponse, BuildReportSectionResponse(org, rulings, section))
	}

	// Calculate summary statistics
	compliantCount := 0
	nonCompliantCount := 0
	indeterminateCount := 0

	for _, ruling := range allRulings {
		decision := strings.ToLower(ruling.Decision)

		// Handle both simple decisions and council's detailed decisions
		if strings.Contains(decision, "compliance") {
			if strings.Contains(decision, "non-compliance") || strings.Contains(decision, "good evidence of non-compliance") {
				nonCompliantCount++
			} else if strings.Contains(decision, "good evidence of compliance") || decision == "compliant" {
				compliantCount++
			} else {
				indeterminateCount++
			}
		} else {
			// Handle simple format decisions
			switch decision {
			case "compliant":
				compliantCount++
			case "non-compliant":
				nonCompliantCount++
			case "warning":
				indeterminateCount++
			default:
				indeterminateCount++
			}
		}
	}

	totalRulings := len(allRulings)
	var compliancePercentage float64
	if totalRulings > 0 {
		compliancePercentage = float64(compliantCount) / float64(totalRulings) * 100
	}

	// Get actionable items for this report
	var actionableItems []models.ActionableItem
	if err := db.Preload("Ruling").
		Joins("JOIN rulings ON actionable_items.ruling_id = rulings.id").
		Joins("JOIN report_sections ON rulings.report_section_id = report_sections.id").
		Where("report_sections.report_id = ? AND actionable_items.organization_id = ?", report.ID, org.ID).
		Find(&actionableItems).Error; err != nil {
		// Handle error if needed, but continue
	}

	// Build actionable items response
	var actionableItemsResponse []ActionableItemResponse
	for _, item := range actionableItems {
		actionableItemsResponse = append(actionableItemsResponse, BuildActionableItemResponse(org, item))
	}

	return ReportResponse{
		ObjectID:             report.ObjectID,
		Name:                 report.Name,
		Description:          report.Description,
		Status:               report.Status,
		TemplateID:           report.ReportTemplate.ObjectID,
		Summary:              report.Summary,
		CompliantCount:       compliantCount,
		NonCompliantCount:    nonCompliantCount,
		IndeterminateCount:   indeterminateCount,
		TotalRulingsCount:    totalRulings,
		CompliancePercentage: compliancePercentage,
		Sections:             sectionsResponse,
		ActionableItems:      actionableItemsResponse,
		CreatedAt:            report.CreatedAt.Format("2006-01-02 15:04:05"),
	}
}

// Create a new report
// @Summary Create a new report
// @Description Create a new report for a specific organization
// @Tags Report
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report body ReportRequest true "Report data"
// @Success 201 {object} ReportResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report [post]
// @Security Bearer
func (h *ReportHandler) CreateReport(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	var request ReportRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	// Validate the request
	if request.Name == "" || request.TemplateID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Name and Template ID are required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the report template by ID
	var template models.ReportTemplate
	if err := h.DB.First(&template, "object_id = ?", request.TemplateID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Report template not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report template")
	}

	objectID, _ := crypto.GenerateUUID()

	// Create the report
	report := models.Report{
		ObjectID:         objectID,
		Name:             request.Name,
		Description:      request.Description,
		Status:           request.Status,
		OrganizationID:   org.ID,
		ReportTemplateID: template.ID,
		ReportTemplate:   template,
	}
	if err := h.DB.Create(&report).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create report")
	}

	return c.Status(fiber.StatusCreated).JSON(BuildReportResponse(org, report, []models.ReportSection{}, h.DB))
}

// Get a report by its object ID
// @Summary Get a report by its object ID
// @Description Retrieve a report by its object ID for a specific organization
// @Tags Report
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report Object ID"
// @Success 200 {object} ReportResponse
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report/{report_id} [get]
// @Security Bearer
func (h *ReportHandler) GetReport(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	reportID := c.Params("report_id")
	if orgID == "" || reportID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Report ID are required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the report by its object ID
	var report models.Report
	if err := h.DB.Preload("ReportTemplate").First(&report, "object_id = ?", reportID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Report not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report")
	}

	// Find all sections associated with the report
	var sections []models.ReportSection
	if err := h.DB.Where("report_id = ?", report.ID).Find(&sections).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report sections")
	}

	return c.JSON(BuildReportResponse(org, report, sections, h.DB))
}

// Get all reports for an organization
// @Summary Get all reports for an organization
// @Description Retrieve all reports for a specific organization
// @Tags Report
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {array} ReportResponse
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report [get]
// @Security Bearer
func (h *ReportHandler) GetAllReports(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find all reports for the organization
	var reports []models.Report
	if err := h.DB.Preload("ReportTemplate").Where("organization_id = ?", org.ID).Preload("ReportTemplate").Find(&reports).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find reports")
	}

	// Build the response for each report
	response := make([]ReportResponse, 0)
	for _, report := range reports {
		var sections []models.ReportSection
		if err := h.DB.Where("report_id = ?", report.ID).Find(&sections).Error; err != nil {
		}
		response = append(response, BuildReportResponse(org, report, sections, h.DB))
	}

	return c.JSON(response)
}

// Update a report by its object ID, only update non-empty fields
// @Summary Update a report by its object ID
// @Description Update a report's details for a specific organization
// @Tags Report
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report Object ID"
// @Param report body ReportRequest true "Report data"
// @Success 200 {object} ReportResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report/{report_id} [put]
// @Security Bearer
func (h *ReportHandler) UpdateReport(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	reportID := c.Params("report_id")
	if orgID == "" || reportID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Report ID are required")
	}

	var request ReportRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the report by its object ID
	var report models.Report
	if err := h.DB.Preload("ReportTemplate").First(&report, "object_id = ?", reportID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Report not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report")
	}

	// Update fields that are provided in the request
	if request.Name != "" {
		report.Name = request.Name
	}
	if request.Description != "" {
		report.Description = request.Description
	}
	if request.Status != "" {
		report.Status = request.Status
	}

	if err := h.DB.Save(&report).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update report")
	}

	var sections []models.ReportSection
	if err := h.DB.Where("report_id = ?", report.ID).Find(&sections).Error; err != nil {
	}

	return c.JSON(BuildReportResponse(org, report, sections, h.DB))
}

// Delete a report by its object ID
// @Summary Delete a report by its object ID
// @Description Delete a report for a specific organization
// @Tags Report
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report Object ID"
// @Success 204
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report/{report_id} [delete]
// @Security Bearer
func (h *ReportHandler) DeleteReport(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	reportID := c.Params("report_id")
	if orgID == "" || reportID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Report ID are required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the report by its object ID
	var report models.Report
	if err := h.DB.First(&report, "object_id = ?", reportID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Report not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report")
	}

	// Delete the report
	if err := h.DB.Unscoped().Delete(&report).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to delete report")
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// Get report summary
// @Summary Get report summary
// @Description Get summary statistics for a specific report
// @Tags Report
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report Object ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report/{report_id}/summary [get]
// @Security Bearer
func (h *ReportHandler) GetReportSummary(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	reportID := c.Params("report_id")
	if orgID == "" || reportID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Report ID are required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the report by its object ID
	var report models.Report
	if err := h.DB.Preload("ReportTemplate").First(&report, "object_id = ? AND organization_id = ?", reportID, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Report not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report")
	}

	// Calculate summary statistics
	var rulings []models.Ruling
	if err := h.DB.Joins("JOIN report_sections ON rulings.report_section_id = report_sections.id").
		Where("report_sections.report_id = ?", report.ID).
		Find(&rulings).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find rulings")
	}

	compliantCount := 0
	nonCompliantCount := 0
	indeterminateCount := 0

	for _, ruling := range rulings {
		switch ruling.Decision {
		case "compliant":
			compliantCount++
		case "non-compliant":
			nonCompliantCount++
		case "warning":
			indeterminateCount++
		default:
			indeterminateCount++
		}
	}

	totalRulings := len(rulings)
	var compliancePercentage float64
	if totalRulings > 0 {
		compliancePercentage = float64(compliantCount) / float64(totalRulings) * 100
	}

	summary := map[string]interface{}{
		"report_id":             report.ObjectID,
		"summary":               report.Summary,
		"compliant_count":       compliantCount,
		"non_compliant_count":   nonCompliantCount,
		"indeterminate_count":   indeterminateCount,
		"total_rulings_count":   totalRulings,
		"compliance_percentage": compliancePercentage,
	}

	return c.JSON(summary)
}

// Regenerate report summary
// @Summary Regenerate report summary
// @Description Recalculate and update summary statistics for a specific report
// @Tags Report
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report Object ID"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report/{report_id}/regenerate-summary [post]
// @Security Bearer
func (h *ReportHandler) RegenerateSummary(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	reportID := c.Params("report_id")
	if orgID == "" || reportID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Report ID are required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the report by its object ID
	var report models.Report
	if err := h.DB.First(&report, "object_id = ? AND organization_id = ?", reportID, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Report not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report")
	}

	// Calculate and update summary statistics
	var rulings []models.Ruling
	if err := h.DB.Joins("JOIN report_sections ON rulings.report_section_id = report_sections.id").
		Where("report_sections.report_id = ?", report.ID).
		Find(&rulings).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find rulings")
	}

	compliantCount := 0
	nonCompliantCount := 0
	indeterminateCount := 0

	for _, ruling := range rulings {
		switch ruling.Decision {
		case "compliant":
			compliantCount++
		case "non-compliant":
			nonCompliantCount++
		case "warning":
			indeterminateCount++
		default:
			indeterminateCount++
		}
	}

	totalRulings := len(rulings)
	var compliancePercentage float64
	if totalRulings > 0 {
		compliancePercentage = float64(compliantCount) / float64(totalRulings) * 100
	}

	// Update the report with calculated values
	report.CompliantCount = compliantCount
	report.NonCompliantCount = nonCompliantCount
	report.IndeterminateCount = indeterminateCount
	report.TotalRulingsCount = totalRulings
	report.CompliancePercentage = compliancePercentage

	if err := h.DB.Save(&report).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update report summary")
	}

	summary := map[string]interface{}{
		"message":               "Summary regenerated successfully",
		"report_id":             report.ObjectID,
		"compliant_count":       compliantCount,
		"non_compliant_count":   nonCompliantCount,
		"indeterminate_count":   indeterminateCount,
		"total_rulings_count":   totalRulings,
		"compliance_percentage": compliancePercentage,
	}

	return c.JSON(summary)
}
