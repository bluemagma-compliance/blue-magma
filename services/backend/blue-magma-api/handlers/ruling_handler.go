package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type RulingHandler struct {
	DB *gorm.DB
}

func NewRulingHandler(db *gorm.DB) *RulingHandler {
	return &RulingHandler{
		DB: db,
	}
}

type RulingRequest struct {
	RuleID            string `json:"rule_id"`
	Decision          string `json:"decision"` // "compliant" | "non-compliant" | "warning"
	Reasoning         string `json:"reasoning"`
	Status            string `json:"status"`              // "pending" | "completed" | "failed"
	CodebaseVersionID string `json:"codebase_version_id"` // Foreign key to CodebaseVersion
	ReportSectionID   string `json:"report_section_id"`   // Foreign key to ReportSection
}

type RulingResponse struct {
	ObjectID       string             `json:"object_id"`
	OrganizationID string             `json:"organization_id"` // Foreign key to Organization
	RuleID         string             `json:"rule_id"`         // FK column in Ruling table
	Decision       string             `json:"decision"`        // "compliant" | "non-compliant" | "warning"
	Reasoning      string             `json:"reasoning"`
	Severity       string             `json:"level"`     // e.g., "critical", "high
	Quesions       []QuestionResponse `json:"questions"` // List of questions related to the ruling
	Status         string             `json:"status"`    // "pending" | "completed" | "failed"
	Rule           *RuleResponse      `json:"rule"`      // Complete rule details
}

// Helper function to build RuleResponse from Rule model
func BuildRuleResponse(rule models.Rule) *RuleResponse {
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

// CreateRuling creates a new ruling in the database
// @Summary Create a new ruling
// @Description Create a new ruling in the database
// @Tags ruling
// @Accept json
// @Produce json
// @Param ruling body RulingRequest true "Ruling Request"
// @Param org_id path string true "Organization ID"
// @Success 201 {object} RulingResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/ruling [post]
// @Security Bearer
func (h *RulingHandler) CreateRuling(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var rulingRequest RulingRequest
	if err := c.BodyParser(&rulingRequest); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// find the rule
	var rule models.Rule
	if err := h.DB.Where("object_id = ?", rulingRequest.RuleID).First(&rule).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Rule not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Rule not found"})
		}
		log.Errorf("Failed to find rule: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find rule"})
	}

	// Check if the codebase version exists
	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Where("object_id = ?", rulingRequest.CodebaseVersionID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Codebase version not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Codebase version not found"})
		}
		log.Errorf("Failed to find codebase version: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find codebase version"})
	}

	// get the report section if provided
	var reportSection models.ReportSection
	if rulingRequest.ReportSectionID != "" {
		if err := h.DB.Where("object_id = ?", rulingRequest.ReportSectionID).First(&reportSection).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				log.Errorf("Report section not found: %v", err)
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Report section not found"})
			}
			log.Errorf("Failed to find report section: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find report section"})
		}
	}

	objectId, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	ruling := models.Ruling{
		ObjectID:          objectId,
		OrganizationID:    org.ID,
		Decision:          rulingRequest.Decision,
		Reasoning:         rulingRequest.Reasoning,
		Status:            rulingRequest.Status,
		CodebaseVersionID: codebaseVersion.ID,
		RuleID:            rule.ID,
		Rule:              rule, // Assuming Rule is preloaded
		ReportSectionID:   reportSection.ID,
	}

	if err := h.DB.Create(&ruling).Error; err != nil {
		log.Errorf("Failed to create ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create ruling"})
	}

	response := RulingResponse{
		ObjectID:       ruling.ObjectID,
		OrganizationID: org.ObjectID,
		Decision:       ruling.Decision,
		Reasoning:      ruling.Reasoning,
		Status:         ruling.Status,
		RuleID:         rule.ObjectID, // Assuming Rule is preloaded
		Rule:           BuildRuleResponse(rule),
	}

	return c.Status(fiber.StatusCreated).JSON(response)
}

// GetRuling retrieves a ruling by its ID
// @Summary Get a ruling by ID
// @Description Get a ruling by ID
// @Tags ruling
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param ruling_id path string true "Ruling ID"
// @Success 200 {object} RulingResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/ruling/{ruling_id} [get]
// @Security Bearer
func (h *RulingHandler) GetRuling(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	rulingId := c.Params("ruling_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var ruling models.Ruling
	if err := h.DB.Preload("Rule").Where("object_id = ? AND organization_id = ?", rulingId, org.ID).First(&ruling).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Ruling not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Ruling not found"})
		}
		log.Errorf("Failed to find ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find ruling"})
	}

	var questions []models.Question
	if err := h.DB.Where("ruling_id = ?", ruling.ID).Find(&questions).Error; err != nil {
		log.Errorf("Failed to find questions for ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find questions for ruling"})
	}
	var questionResponses []QuestionResponse
	for _, question := range questions {
		var foundProperties []models.FoundProperty
		if err := h.DB.Where("question_id = ?", question.ID).Find(&foundProperties).Error; err != nil {
			log.Errorf("Failed to find found properties for question: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find found properties for question"})
		}
		questionResponse := BuildQuestionResponse(org, question, foundProperties)
		questionResponses = append(questionResponses, questionResponse)
	}

	rulingResponse := RulingResponse{
		ObjectID:       ruling.ObjectID,
		OrganizationID: org.ObjectID,
		Decision:       ruling.Decision,
		Reasoning:      ruling.Reasoning,
		Severity:       ruling.Level, // Assuming Severity is used for Level
		Quesions:       questionResponses,
		Status:         ruling.Status,
		RuleID:         ruling.Rule.ObjectID, // Assuming Rule is preloaded
		Rule:           BuildRuleResponse(ruling.Rule),
	}

	return c.JSON(rulingResponse)
}

// UpdateRuling updates a ruling by its ID
// @Summary Update a ruling by ID
// @Description Update a ruling by ID
// @Tags ruling
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param ruling_id path string true "Ruling ID"
// @Param ruling body RulingRequest true "Ruling Request"
// @Success 200 {object} RulingResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/ruling/{ruling_id} [put]
// @Security Bearer
func (h *RulingHandler) UpdateRuling(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	rulingId := c.Params("ruling_id")

	var rulingRequest RulingRequest
	if err := c.BodyParser(&rulingRequest); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Check if the ruling exists
	var ruling models.Ruling
	if err := h.DB.Preload("Rule").Where("object_id = ? AND organization_id = ?", rulingId, org.ID).First(&ruling).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Ruling not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Ruling not found"})
		}
		log.Errorf("Failed to find ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find ruling"})
	}

	if rulingRequest.Decision != "" {
		ruling.Decision = rulingRequest.Decision
	}
	if rulingRequest.Reasoning != "" {
		ruling.Reasoning = rulingRequest.Reasoning
	}
	if rulingRequest.Status != "" {
		ruling.Status = rulingRequest.Status
	}

	if err := h.DB.Save(&ruling).Error; err != nil {
		log.Errorf("Failed to update ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update ruling"})
	}
	rulingResponse := RulingResponse{
		ObjectID:       ruling.ObjectID,
		OrganizationID: org.ObjectID,
		Decision:       ruling.Decision,
		Reasoning:      ruling.Reasoning,
		Severity:       ruling.Level, // Assuming Severity is used for Level
		Status:         ruling.Status,
		RuleID:         ruling.Rule.ObjectID, // Assuming Rule is preloaded
	}

	return c.JSON(rulingResponse)
}

// DeleteRuling deletes a ruling by its ID
// @Summary Delete a ruling by ID
// @Description Delete a ruling by ID
// @Tags ruling
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param ruling_id path string true "Ruling ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/ruling/{ruling_id} [delete]
// @Security Bearer
func (h *RulingHandler) DeleteRuling(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	rulingId := c.Params("ruling_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Check if the ruling exists
	var ruling models.Ruling
	if err := h.DB.Where("object_id = ? AND organization_id = ?", rulingId, org.ID).First(&ruling).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Ruling not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Ruling not found"})
		}
		log.Errorf("Failed to find ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find ruling"})
	}

	if err := h.DB.Delete(&ruling).Error; err != nil {
		log.Errorf("Failed to delete ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete ruling"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
