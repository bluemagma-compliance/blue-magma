package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ReportSectionHandler struct {
	DB *gorm.DB
}

func NewReportSectionHandler(db *gorm.DB) *ReportSectionHandler {
	return &ReportSectionHandler{DB: db}
}

type ReportSectionRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	ReportID    string `json:"report_id"` // Foreign key to Report
}

type ReportSectionResponse struct {
	ObjectID    string           `json:"object_id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	ReportID    string           `json:"report_id"` // Foreign key to Report
	Rulings     []RulingResponse `json:"rulings"`   // List of rulings associated with the report section
}

// Helper function to build RuleResponse from Rule model
func buildRuleResponseForSection(rule models.Rule) *RuleResponse {
	return &RuleResponse{
		ObjectID:       rule.ObjectID,
		Rule:           rule.Rule,
		Name:           rule.Name,
		PolicyName:     rule.PolicyName,
		PolicyVersion:  rule.PolicyVersion,
		Scope:          rule.Scope,
		EvidenceSchema: string(rule.EvidenceSchema),
		Tags:           rule.Tags,
		Source:         rule.Source,
		Description:    rule.Description,
		Public:         rule.Public,
		Severity:       rule.Level,
		Section:        rule.Section,
	}
}

func BuildReportSectionResponse(org models.Organization, rulings []models.Ruling, reportSection models.ReportSection) ReportSectionResponse {
	// Build the rulings response
	var rulingsResponse []RulingResponse
	for _, ruling := range rulings {
		rulingsResponse = append(rulingsResponse, RulingResponse{
			ObjectID:       ruling.ObjectID,
			OrganizationID: org.ObjectID,
			Decision:       ruling.Decision,
			Reasoning:      ruling.Reasoning,
			Status:         ruling.Status,
			RuleID:         ruling.Rule.ObjectID,
			Severity:       ruling.Level,
			Rule:           buildRuleResponseForSection(ruling.Rule),
		})
	}

	return ReportSectionResponse{
		ObjectID:    reportSection.ObjectID,
		Name:        reportSection.Name,
		Description: reportSection.Description,
		ReportID:    reportSection.Report.ObjectID,
		Rulings:     rulingsResponse,
	}
}

// Create a new report section
// @Summary Create a new report section
// @Description Create a new report section for a specific organization
// @Tags ReportSection
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_section body ReportSectionRequest true "Report Section Request"
// @Success 201 {object} ReportSectionResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report-section [post]
// @Security Bearer
func (h *ReportSectionHandler) CreateReportSection(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var request ReportSectionRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	org := models.Organization{}
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
	}

	// find the report by ID
	report := models.Report{}
	if err := h.DB.First(&report, "object_id = ?", request.ReportID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Report not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find report"})
	}

	object_id, _ := crypto.GenerateUUID()

	reportSection := models.ReportSection{
		ObjectID:       object_id,
		OrganizationID: org.ID,
		ReportID:       report.ID,
		Report:         report,
		Name:           request.Name,
		Description:    request.Description,
	}

	if err := h.DB.Create(&reportSection).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create report section"})
	}

	rulings := []models.Ruling{}
	if err := h.DB.Where("report_section_id = ?", reportSection.ID).Find(&rulings).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve rulings for report section"})
	}
	response := BuildReportSectionResponse(org, rulings, reportSection)
	return c.Status(201).JSON(response)

}

// Get a report section by ID
// @Summary Get a report section by ID
// @Description Get a report section by its object ID
// @Tags ReportSection
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param section_id path string true "Report Section ID"
// @Success 200 {object} ReportSectionResponse
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report-section/{section_id} [get]
// @Security Bearer
func (h *ReportSectionHandler) GetReportSection(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	sectionId := c.Params("section_id")

	org := models.Organization{}
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
	}

	reportSection := models.ReportSection{}
	if err := h.DB.First(&reportSection, "object_id = ?", sectionId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Report section not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find report section"})
	}

	rulings := []models.Ruling{}
	if err := h.DB.Where("report_section_id = ?", reportSection.ID).Find(&rulings).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve rulings for report section"})
	}

	response := BuildReportSectionResponse(org, rulings, reportSection)
	return c.Status(200).JSON(response)
}

// Update a report section, only uopdates non-empty fields
// @Summary Update a report section
// @Description Update an existing report section with the provided details
// @Tags ReportSection
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param section_id path string true "Report Section ID"
// @Param request body ReportSectionRequest true "Report Section Request"
// @Success 200 {object} ReportSectionResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report-section/{section_id} [put]
// @Security Bearer
func (h *ReportSectionHandler) UpdateReportSection(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	sectionId := c.Params("section_id")

	var request ReportSectionRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	org := models.Organization{}
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
	}

	reportSection := models.ReportSection{}
	if err := h.DB.First(&reportSection, "object_id = ?", sectionId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Report section not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find report section"})
	}

	// Update fields that are provided in the request
	if request.Name != "" {
		reportSection.Name = request.Name
	}
	if request.Description != "" {
		reportSection.Description = request.Description
	}

	if err := h.DB.Save(&reportSection).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update report section"})
	}

	rulings := []models.Ruling{}
	if err := h.DB.Where("report_section_id = ?", reportSection.ID).Find(&rulings).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve rulings for report section"})
	}

	response := BuildReportSectionResponse(org, rulings, reportSection)
	return c.Status(200).JSON(response)
}

// Delete a report section
// @Summary Delete a report section
// @Description Delete a report section by its object ID
// @Tags ReportSection
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param section_id path string true "Report Section ID"
// @Success 204 {object} nil
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/report-section/{section_id} [delete]
// @Security Bearer
func (h *ReportSectionHandler) DeleteReportSection(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	sectionId := c.Params("section_id")

	org := models.Organization{}
	if err := h.DB.First(&org, "object_id = ?", orgId).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
	}

	reportSection := models.ReportSection{}
	if err := h.DB.First(&reportSection, "object_id = ?", sectionId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Report section not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find report section"})
	}

	if err := h.DB.Unscoped().Delete(&reportSection).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete report section"})
	}

	return c.SendStatus(204)
}
