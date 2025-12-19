package handlers

import (
	"encoding/json"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type EvidenceHandler struct {
	DB *gorm.DB
}

func NewEvidenceHandler(db *gorm.DB) *EvidenceHandler {
	return &EvidenceHandler{DB: db}
}

type EvidenceRequest struct {
	DocumentID    uint            `json:"document_id"`
	Name          string          `json:"name"`
	Description   string          `json:"description"`
	Type          string          `json:"type"` // "temporary", "static", "dynamic"
	SourceID      string          `json:"source_id"`
	SourceType    string          `json:"source_type"`
	SourceMethod  string          `json:"source_method"`
	SourceQuery   string          `json:"source_query"`
	DateCollected *time.Time      `json:"date_collected"`
	DateExpires   *time.Time      `json:"date_expires"`
	Context       string          `json:"context"`
	ValueType     string          `json:"value_type"` // "text", "config", "artifact", "collection"
	Value         json.RawMessage `json:"value"`
	Group         string          `json:"group"`
	Tags          json.RawMessage `json:"tags"`
	CollectionID  *uint           `json:"collection_id"` // When value_type = "collection"
}

type EvidenceResponse struct {
	ObjectID      string          `json:"object_id"`
	ProjectID     uint            `json:"project_id"`
	DocumentID    uint            `json:"document_id"`
	Name          string          `json:"name"`
	Description   string          `json:"description"`
	Type          string          `json:"type"`
	SourceID      string          `json:"source_id"`
	SourceType    string          `json:"source_type"`
	SourceMethod  string          `json:"source_method"`
	SourceQuery   string          `json:"source_query"`
	DateCollected time.Time       `json:"date_collected"`
	DateExpires   *time.Time      `json:"date_expires"`
	Context       string          `json:"context"`
	ValueType     string          `json:"value_type"`
	Value         json.RawMessage `json:"value"`
	ContentHash   string          `json:"content_hash"`
	Group         string          `json:"group"`
	Tags          json.RawMessage `json:"tags"`
	IsVerified    bool            `json:"is_verified"`
	VerifiedBy    string          `json:"verified_by"`
	VerifiedAt    *time.Time      `json:"verified_at"`
	CollectionID  *uint           `json:"collection_id"`
}

func buildEvidenceResponse(evi models.Evidence, project models.Project) EvidenceResponse {
	return EvidenceResponse{
		ObjectID:      evi.ObjectID,
		ProjectID:     project.ID,
		DocumentID:    evi.DocumentID,
		Name:          evi.Name,
		Description:   evi.Description,
		Type:          evi.Type,
		SourceID:      evi.SourceID,
		SourceType:    evi.SourceType,
		SourceMethod:  evi.SourceMethod,
		SourceQuery:   evi.SourceQuery,
		DateCollected: evi.DateCollected,
		DateExpires:   evi.DateExpires,
		Context:       evi.Context,
		ValueType:     evi.ValueType,
		Value:         json.RawMessage(evi.Value),
		ContentHash:   evi.ContentHash,
		Group:         evi.Group,
		Tags:          json.RawMessage(evi.Tags),
		IsVerified:    evi.IsVerified,
		VerifiedBy:    evi.VerifiedBy,
		VerifiedAt:    evi.VerifiedAt,
		CollectionID:  evi.CollectionID,
	}
}

// GetEvidence returns all evidence for a project
func (h *EvidenceHandler) GetEvidence(c *fiber.Ctx) error {
	projectID := c.Params("project_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get all evidence for this project
	var evidence []models.Evidence
	if err := h.DB.Where("project_id = ? AND organization_id = ?", project.ID, org.ID).
		Preload("Collection").
		Find(&evidence).Error; err != nil {
		log.Errorf("Failed to get evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence"})
	}

	response := make([]EvidenceResponse, 0)
	for _, evi := range evidence {
		response = append(response, buildEvidenceResponse(evi, project))
	}

	return c.JSON(fiber.Map{
		"evidence": response,
	})
}

// GetEvidenceByID returns a single evidence item
func (h *EvidenceHandler) GetEvidenceByID(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	evidenceID := c.Params("evidence_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get evidence
	var evidence models.Evidence
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", evidenceID, project.ID, org.ID).
		Preload("Collection").
		First(&evidence).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence not found"})
		}
		log.Errorf("Failed to get evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence"})
	}

	return c.JSON(buildEvidenceResponse(evidence, project))
}

// GetDocumentEvidence returns all evidence for a specific document
func (h *EvidenceHandler) GetDocumentEvidence(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	documentID := c.Params("document_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get document
	var document models.Document
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", documentID, project.ID, org.ID).
		First(&document).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
		}
		log.Errorf("Failed to get document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
	}

	// Get evidence for this document
	var evidence []models.Evidence
	if err := h.DB.Where("document_id = ? AND organization_id = ?", document.ID, org.ID).
		Preload("Collection").
		Find(&evidence).Error; err != nil {
		log.Errorf("Failed to get evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence"})
	}

	response := make([]EvidenceResponse, 0)
	for _, evi := range evidence {
		response = append(response, buildEvidenceResponse(evi, project))
	}

	return c.JSON(fiber.Map{
		"evidence": response,
	})
}

// CreateEvidence creates a new evidence item
func (h *EvidenceHandler) CreateEvidence(c *fiber.Ctx) error {
	projectID := c.Params("project_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Parse request
	var req EvidenceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}
	if req.Type == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Type is required"})
	}
	if req.Type != "temporary" && req.Type != "static" && req.Type != "dynamic" {
		return c.Status(400).JSON(fiber.Map{"error": "Type must be 'temporary', 'static', or 'dynamic'"})
	}
	if req.ValueType == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Value type is required"})
	}
	if req.ValueType != "text" && req.ValueType != "config" && req.ValueType != "artifact" && req.ValueType != "collection" {
		return c.Status(400).JSON(fiber.Map{"error": "Value type must be 'text', 'config', 'artifact', or 'collection'"})
	}

	// Verify document exists
	var document models.Document
	if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", req.DocumentID, project.ID, org.ID).
		First(&document).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
		}
		log.Errorf("Failed to get document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
	}

	// If value_type is collection, verify collection exists
	if req.ValueType == "collection" && req.CollectionID != nil {
		var collection models.Collection
		if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *req.CollectionID, project.ID, org.ID).
			First(&collection).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return c.Status(404).JSON(fiber.Map{"error": "Collection not found"})
			}
			log.Errorf("Failed to get collection: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get collection"})
		}
	}

	// Generate object ID
	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Calculate content hash
	contentHash := calculateContentHash(req.Value)

	// Set date collected if not provided
	dateCollected := time.Now()
	if req.DateCollected != nil {
		dateCollected = *req.DateCollected
	}

	// Create evidence
	evidence := models.Evidence{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		DocumentID:     req.DocumentID,
		Name:           req.Name,
		Description:    req.Description,
		Type:           req.Type,
		SourceID:       req.SourceID,
		SourceType:     req.SourceType,
		SourceMethod:   req.SourceMethod,
		SourceQuery:    req.SourceQuery,
		DateCollected:  dateCollected,
		DateExpires:    req.DateExpires,
		Context:        req.Context,
		ValueType:      req.ValueType,
		Value:          datatypes.JSON(req.Value),
		ContentHash:    contentHash,
		Group:          req.Group,
		Tags:           datatypes.JSON(req.Tags),
		CollectionID:   req.CollectionID,
	}

	if err := h.DB.Create(&evidence).Error; err != nil {
		log.Errorf("Failed to create evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create evidence"})
	}

	return c.Status(201).JSON(buildEvidenceResponse(evidence, project))
}

// UpdateEvidence updates an existing evidence item
func (h *EvidenceHandler) UpdateEvidence(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	evidenceID := c.Params("evidence_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get evidence
	var evidence models.Evidence
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", evidenceID, project.ID, org.ID).
		First(&evidence).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence not found"})
		}
		log.Errorf("Failed to get evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence"})
	}

	// Parse request
	var req EvidenceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields
	if req.Name != "" {
		evidence.Name = req.Name
	}
	if req.Description != "" {
		evidence.Description = req.Description
	}
	if req.Type != "" {
		if req.Type != "temporary" && req.Type != "static" && req.Type != "dynamic" {
			return c.Status(400).JSON(fiber.Map{"error": "Type must be 'temporary', 'static', or 'dynamic'"})
		}
		evidence.Type = req.Type
	}
	if req.SourceID != "" {
		evidence.SourceID = req.SourceID
	}
	if req.SourceType != "" {
		evidence.SourceType = req.SourceType
	}
	if req.SourceMethod != "" {
		evidence.SourceMethod = req.SourceMethod
	}
	if req.SourceQuery != "" {
		evidence.SourceQuery = req.SourceQuery
	}
	if req.DateExpires != nil {
		evidence.DateExpires = req.DateExpires
	}
	if req.Context != "" {
		evidence.Context = req.Context
	}
	if req.Group != "" {
		evidence.Group = req.Group
	}
	if len(req.Tags) > 0 {
		evidence.Tags = datatypes.JSON(req.Tags)
	}
	if len(req.Value) > 0 {
		// Calculate new hash
		newHash := calculateContentHash(req.Value)
		if newHash != evidence.ContentHash {
			evidence.Value = datatypes.JSON(req.Value)
			evidence.ContentHash = newHash
			log.Infof("Evidence content changed, new hash: %s", newHash)
		}
	}
	if req.CollectionID != nil {
		evidence.CollectionID = req.CollectionID
	}

	if err := h.DB.Save(&evidence).Error; err != nil {
		log.Errorf("Failed to update evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update evidence"})
	}

	return c.JSON(buildEvidenceResponse(evidence, project))
}

// DeleteEvidence deletes an evidence item
func (h *EvidenceHandler) DeleteEvidence(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	evidenceID := c.Params("evidence_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get evidence
	var evidence models.Evidence
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", evidenceID, project.ID, org.ID).
		First(&evidence).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence not found"})
		}
		log.Errorf("Failed to get evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence"})
	}

	// Delete evidence
	if err := h.DB.Delete(&evidence).Error; err != nil {
		log.Errorf("Failed to delete evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete evidence"})
	}

	return c.JSON(fiber.Map{"message": "Evidence deleted successfully"})
}

// VerifyEvidence marks evidence as verified
func (h *EvidenceHandler) VerifyEvidence(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	evidenceID := c.Params("evidence_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get evidence
	var evidence models.Evidence
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", evidenceID, project.ID, org.ID).
		First(&evidence).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence not found"})
		}
		log.Errorf("Failed to get evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence"})
	}

	// Get user ID from context (assuming it's set by auth middleware)
	userID := c.Locals("user_id").(string)

	// Mark as verified
	now := time.Now()
	evidence.IsVerified = true
	evidence.VerifiedBy = userID
	evidence.VerifiedAt = &now

	if err := h.DB.Save(&evidence).Error; err != nil {
		log.Errorf("Failed to verify evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to verify evidence"})
	}

	return c.JSON(buildEvidenceResponse(evidence, project))
}
