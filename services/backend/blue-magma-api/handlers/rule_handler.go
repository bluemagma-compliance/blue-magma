package handlers

import (
	"encoding/json"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/log"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type RuleHandler struct {
	DB *gorm.DB
}

func NewRuleHandler(db *gorm.DB) *RuleHandler {
	return &RuleHandler{DB: db}
}

type RuleResponse struct {
	ObjectID       string `json:"object_id"`
	Rule           string `json:"rule"`
	Name           string `json:"name"`
	PolicyName     string `json:"policy_name"`
	PolicyVersion  string `json:"policy_version"`
	Scope          string `json:"scope"`
	EvidenceSchema string `json:"evidence_schema"`
	Tags           string `json:"tags"`
	Source         string `json:"source"`
	Description    string `json:"description"`
	Public         bool   `json:"public"`
	Severity       string `json:"severity"` // e.g., "critical", "high", "medium", "low"
	Section        string `json:"section"`  // Optional section for categorization
}

type RuleRequest struct {
	Name           string `json:"name"`
	PolicyName     string `json:"policy_name"`
	PolicyVersion  string `json:"policy_version"`
	Rule           string `json:"rule"`
	Scope          string `json:"scope"`
	EvidenceSchema string `json:"evidence_schema"`
	Tags           string `json:"tags"`
	Source         string `json:"source"`
	Description    string `json:"description"`
	Public         bool   `json:"public"`
	Severity       string `json:"severity"` // e.g., "critical", "high", "medium", "low"
	Section        string `json:"section"`  // Optional section for categorization
}

// CreateRule creates a new rule
// @Summary Create a new rule
// @Description Create a new rule
// @Tags rules
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param rule body RuleRequest true "Rule data"
// @Success 201 {object} RuleResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rule [post]
// @Security Bearer
func (h *RuleHandler) CreateRule(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var ruleRequest RuleRequest

	if err := c.BodyParser(&ruleRequest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request",
		})
	}

	// Ensure evidence schema is a valid JSON object
	var tmp interface{}
	if err := json.Unmarshal([]byte(ruleRequest.EvidenceSchema), &tmp); err != nil {
		log.Debug("Failed to parse evidence schema: ", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid evidence schema",
		})
	}

	if _, ok := tmp.(map[string]interface{}); !ok {
		log.Debug("Evidence schema is not a JSON object")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Evidence schema must be a JSON object",
		})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid organization ID",
		})
	}

	// Then assign it to your GORM-compatible datatypes.JSON
	evidenceSchema := datatypes.JSON([]byte(ruleRequest.EvidenceSchema))

	RuleObjectID, err := crypto.GenerateUUID()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate rule ID",
		})
	}

	rule := models.Rule{
		ObjectID:       RuleObjectID,
		Name:           ruleRequest.Name,
		PolicyName:     ruleRequest.PolicyName,
		PolicyVersion:  ruleRequest.PolicyVersion,
		Rule:           ruleRequest.Rule,
		Scope:          ruleRequest.Scope,
		EvidenceSchema: evidenceSchema,
		Tags:           ruleRequest.Tags,
		Source:         ruleRequest.Source,
		Description:    ruleRequest.Description,
		OrganizationID: org.ID,
		Organization:   org,
		Public:         ruleRequest.Public,
		Level:          ruleRequest.Severity,
		Section:        ruleRequest.Section,
	}

	if err := h.DB.Create(&rule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create rule",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(RuleResponse{
		ObjectID:       rule.ObjectID,
		Rule:           rule.Rule,
		Name:           rule.Name,
		PolicyName:     rule.PolicyName,
		PolicyVersion:  rule.PolicyVersion,
		EvidenceSchema: string(rule.EvidenceSchema),
		Scope:          rule.Scope,
		Tags:           rule.Tags,
		Source:         rule.Source,
		Description:    rule.Description,
		Public:         rule.Public,
		Severity:       rule.Level,
		Section:        rule.Section,
	})
}

// GetRule gets a rule at the given rule_id
// @Summary Get a rule
// @Description Get a rule by ID
// @Tags rules
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param rule_id path string true "Rule ID"
// @Success 200 {object} RuleResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rule/{rule_id} [get]
// @Security Bearer
func (h *RuleHandler) GetRule(c *fiber.Ctx) error {
	ruleID := c.Params("rule_id")
	orgId := c.Params("org_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid organization ID",
		})
	}

	public_ord := models.Organization{}
	if err := h.DB.Where("object_id = 'public'").First(&public_ord).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get public organization",
		})
	}

	var rule models.Rule
	if err := h.DB.Where("(object_id = ? AND organization_id = ?) OR (object_id = ? AND organization_id = ?)", ruleID, org.ID, ruleID, public_ord.ID).First(&rule).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Rule not found",
		})
	}

	return c.JSON(RuleResponse{
		ObjectID:       rule.ObjectID,
		Rule:           rule.Rule,
		Scope:          rule.Scope,
		Name:           rule.Name,
		PolicyName:     rule.PolicyName,
		PolicyVersion:  rule.PolicyVersion,
		EvidenceSchema: string(rule.EvidenceSchema),
		Tags:           rule.Tags,
		Source:         rule.Source,
		Description:    rule.Description,
		Public:         rule.Public,
		Severity:       rule.Level,
		Section:        rule.Section,
	})
}

// GetRules gets all rules for the given org_id
// @Summary Get all rules
// @Description Get all rules for an organization
// @Tags rules
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {array} RuleResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rule [get]
// @Security Bearer
func (h *RuleHandler) GetRules(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid organization ID",
		})
	}

	public_org := models.Organization{}
	if err := h.DB.Where("object_id = 'public'").First(&public_org).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get public organization",
		})
	}

	var rules []models.Rule
	if err := h.DB.Where("organization_id = ? OR organization_id = ?", org.ID, public_org.ID).Find(&rules).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get rules",
		})
	}

	ruleResponses := make([]RuleResponse, 0)
	for _, rule := range rules {
		ruleResponses = append(ruleResponses, RuleResponse{
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
		})
	}

	return c.JSON(ruleResponses)
}

// UpdateRule updates a rule at the given rule_id
// @Summary Update a rule
// @Description Update a rule by ID
// @Tags rules
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param rule_id path string true "Rule ID"
// @Param rule body RuleRequest true "Rule data"
// @Success 200 {object} RuleResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rule/{rule_id} [put]
// @Security Bearer
func (h *RuleHandler) UpdateRule(c *fiber.Ctx) error {
	ruleID := c.Params("rule_id")
	orgId := c.Params("org_id")

	var ruleRequest RuleRequest

	if err := c.BodyParser(&ruleRequest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request",
		})
	}

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid organization ID",
		})
	}

	var rule models.Rule
	if err := h.DB.Where("object_id = ? AND organization_id = ?", ruleID, org.ID).First(&rule).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Rule not found",
		})
	}

	// If there is an evidence schema, ensure it is a valid JSON object
	if ruleRequest.EvidenceSchema != "" {
		// Ensure evidence schema is a valid JSON object
		var tmp interface{}
		if err := json.Unmarshal([]byte(ruleRequest.EvidenceSchema), &tmp); err != nil {
			log.Debug("Failed to parse evidence schema: ", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid evidence schema",
			})
		}

		if _, ok := tmp.(map[string]interface{}); !ok {
			log.Debug("Evidence schema is not a JSON object")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Evidence schema must be a JSON object",
			})
		}

		rule.EvidenceSchema = datatypes.JSON([]byte(ruleRequest.EvidenceSchema))
	}

	if ruleRequest.Rule != "" {
		rule.Rule = ruleRequest.Rule
	}
	if ruleRequest.Scope != "" {
		rule.Scope = ruleRequest.Scope
	}
	if len(ruleRequest.Tags) > 0 {
		rule.Tags = ruleRequest.Tags
	}
	if ruleRequest.Source != "" {
		rule.Source = ruleRequest.Source
	}
	if ruleRequest.Description != "" {
		rule.Description = ruleRequest.Description
	}
	if ruleRequest.Public {
		rule.Public = ruleRequest.Public
	} else {
		rule.Public = false
	}
	if ruleRequest.Name != "" {
		rule.Name = ruleRequest.Name
	}
	if ruleRequest.PolicyName != "" {
		rule.PolicyName = ruleRequest.PolicyName
	}
	if ruleRequest.PolicyVersion != "" {
		rule.PolicyVersion = ruleRequest.PolicyVersion
	}
	if ruleRequest.Severity != "" {
		rule.Level = ruleRequest.Severity
	}
	if ruleRequest.Section != "" {
		rule.Section = ruleRequest.Section
	}

	if err := h.DB.Save(&rule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update rule",
		})
	}

	return c.JSON(RuleResponse{
		ObjectID:       rule.ObjectID,
		Name:           rule.Name,
		PolicyName:     rule.PolicyName,
		PolicyVersion:  rule.PolicyVersion,
		Rule:           rule.Rule,
		EvidenceSchema: string(rule.EvidenceSchema),
		Description:    rule.Description,
		Tags:           rule.Tags,
		Source:         rule.Source,
		Scope:          rule.Scope,
		Public:         rule.Public,
		Severity:       rule.Level,
		Section:        rule.Section,
	})
}

// DeleteRule deletes a rule at the given rule_id
// @Summary Delete a rule
// @Description Delete a rule by ID
// @Tags rules
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param rule_id path string true "Rule ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rule/{rule_id} [delete]
// @Security Bearer
func (h *RuleHandler) DeleteRule(c *fiber.Ctx) error {
	ruleID := c.Params("rule_id")
	orgId := c.Params("org_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid organization ID",
		})
	}

	var rule models.Rule
	if err := h.DB.Where("object_id = ? AND organization_id = ?", ruleID, org.ID).First(&rule).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Rule not found",
		})
	}

	if err := h.DB.Delete(&rule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete rule",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Rule deleted successfully",
	})
}
