package handlers

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type EvidenceRequestHandler struct {
	DB *gorm.DB
}

func NewEvidenceRequestHandler(db *gorm.DB) *EvidenceRequestHandler {
	return &EvidenceRequestHandler{DB: db}
}

type EvidenceRequestRequest struct {
	DocumentID         uint            `json:"document_id"`
	Title              string          `json:"title"`
	Description        string          `json:"description"`
	RequiredType       string          `json:"required_type"` // "text", "config", "artifact", "collection", "any"
	SuggestedSources   json.RawMessage `json:"suggested_sources"`
	AcceptanceCriteria string          `json:"acceptance_criteria"`
	AssignedTo         string          `json:"assigned_to"`
	Priority           string          `json:"priority"` // "low", "medium", "high", "critical"
	DueDate            *time.Time      `json:"due_date"`
	CreatedBy          string          `json:"created_by"`
		// Optional integer relevance score (e.g. 0-100) for this evidence request
		// within the context of its control/document.
		RelevanceScore int `json:"relevance_score"`
}

type EvidenceRequestResponse struct {
	ObjectID           string          `json:"object_id"`
	ProjectID          uint            `json:"project_id"`
	DocumentID         uint            `json:"document_id"`
	Title              string          `json:"title"`
	Description        string          `json:"description"`
	RequiredType       string          `json:"required_type"`
	SuggestedSources   json.RawMessage `json:"suggested_sources"`
	AcceptanceCriteria string          `json:"acceptance_criteria"`
	AssignedTo         string          `json:"assigned_to"`
	Priority           string          `json:"priority"`
	DueDate            *time.Time      `json:"due_date"`
	Status             string          `json:"status"`
	FulfilledAt        *time.Time      `json:"fulfilled_at"`
	FulfilledByUser    string          `json:"fulfilled_by_user"`
		RejectionReason    string          `json:"rejection_reason"`
		CreatedBy          string          `json:"created_by"`
		RelevanceScore     int             `json:"relevance_score"`
}

func buildEvidenceRequestResponse(req models.EvidenceRequest, project models.Project) EvidenceRequestResponse {
	return EvidenceRequestResponse{
		ObjectID:           req.ObjectID,
		ProjectID:          project.ID,
		DocumentID:         req.DocumentID,
		Title:              req.Title,
		Description:        req.Description,
		RequiredType:       req.RequiredType,
		SuggestedSources:   json.RawMessage(req.SuggestedSources),
		AcceptanceCriteria: req.AcceptanceCriteria,
		AssignedTo:         req.AssignedTo,
		Priority:           req.Priority,
		DueDate:            req.DueDate,
		Status:             req.Status,
		FulfilledAt:        req.FulfilledAt,
		FulfilledByUser:    req.FulfilledByUser,
		RejectionReason:    req.RejectionReason,
		CreatedBy:          req.CreatedBy,
		RelevanceScore:     req.RelevanceScore,
	}
}

// GetEvidenceRequests returns evidence requests for a project. When an
// optional `q` query parameter is provided, results are filtered by a
// case-insensitive substring match on title (if non-empty) and truncated to
// the top 5 results. When `q` is not present, all evidence requests are
// returned as before.
func (h *EvidenceRequestHandler) GetEvidenceRequests(c *fiber.Ctx) error {
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

	// Get evidence requests for this project, optionally filtered by title.
	// When `q` is present (including empty), we truncate the results to the
	// top 5. When `q` is absent, we return all requests.
	var requests []models.EvidenceRequest
	db := h.DB.Where("project_id = ? AND organization_id = ?", project.ID, org.ID)
	hasQ := c.Context().QueryArgs().Has("q")
	q := strings.TrimSpace(c.Query("q"))
	if hasQ && q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		db = db.Where("LOWER(title) LIKE ?", pattern)
	}
	query := db
	if hasQ {
		query = query.Limit(5)
	}
	if err := query.Find(&requests).Error; err != nil {
		log.Errorf("Failed to get evidence requests: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence requests"})
	}

	response := make([]EvidenceRequestResponse, 0)
	for _, req := range requests {
		response = append(response, buildEvidenceRequestResponse(req, project))
	}

	return c.JSON(fiber.Map{
		"evidence_requests": response,
	})
}

// GetEvidenceRequest returns a single evidence request
func (h *EvidenceRequestHandler) GetEvidenceRequest(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	requestID := c.Params("request_id")

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

	// Get evidence request
	var request models.EvidenceRequest
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", requestID, project.ID, org.ID).
		First(&request).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence request not found"})
		}
		log.Errorf("Failed to get evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence request"})
	}

	return c.JSON(buildEvidenceRequestResponse(request, project))
}

// GetDocumentEvidenceRequests returns all evidence requests for a specific document
func (h *EvidenceRequestHandler) GetDocumentEvidenceRequests(c *fiber.Ctx) error {
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

	// Get evidence requests for this document
	var requests []models.EvidenceRequest
	if err := h.DB.Where("document_id = ? AND organization_id = ?", document.ID, org.ID).
		Find(&requests).Error; err != nil {
		log.Errorf("Failed to get evidence requests: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence requests"})
	}

	response := make([]EvidenceRequestResponse, 0)
	for _, req := range requests {
		response = append(response, buildEvidenceRequestResponse(req, project))
	}

	return c.JSON(fiber.Map{
		"evidence_requests": response,
	})
}

// CreateEvidenceRequest creates a new evidence request
func (h *EvidenceRequestHandler) CreateEvidenceRequest(c *fiber.Ctx) error {
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
	var req EvidenceRequestRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if req.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Title is required"})
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

	// Generate object ID
	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Set default priority
	priority := req.Priority
	if priority == "" {
		priority = "medium"
	}

	// Create evidence request
	evidenceRequest := models.EvidenceRequest{
		ObjectID:           objectID,
		OrganizationID:     org.ID,
		ProjectID:          project.ID,
		DocumentID:         req.DocumentID,
		Title:              req.Title,
		Description:        req.Description,
		RequiredType:       req.RequiredType,
		SuggestedSources:   datatypes.JSON(req.SuggestedSources),
		AcceptanceCriteria: req.AcceptanceCriteria,
		AssignedTo:         req.AssignedTo,
		Priority:           priority,
		DueDate:            req.DueDate,
		Status:             "pending",
		CreatedBy:          req.CreatedBy,
		RelevanceScore:     req.RelevanceScore,
	}

	if err := h.DB.Create(&evidenceRequest).Error; err != nil {
		log.Errorf("Failed to create evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create evidence request"})
	}

	return c.Status(201).JSON(buildEvidenceRequestResponse(evidenceRequest, project))
}

// UpdateEvidenceRequest updates an existing evidence request
func (h *EvidenceRequestHandler) UpdateEvidenceRequest(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	requestID := c.Params("request_id")

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

	// Get evidence request
	var evidenceRequest models.EvidenceRequest
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", requestID, project.ID, org.ID).
		First(&evidenceRequest).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence request not found"})
		}
		log.Errorf("Failed to get evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence request"})
	}

	// Parse request
	var req EvidenceRequestRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields
	if req.Title != "" {
		evidenceRequest.Title = req.Title
	}
	if req.Description != "" {
		evidenceRequest.Description = req.Description
	}
	if req.RequiredType != "" {
		evidenceRequest.RequiredType = req.RequiredType
	}
	if len(req.SuggestedSources) > 0 {
		evidenceRequest.SuggestedSources = datatypes.JSON(req.SuggestedSources)
	}
	if req.AcceptanceCriteria != "" {
		evidenceRequest.AcceptanceCriteria = req.AcceptanceCriteria
	}
	if req.AssignedTo != "" {
		evidenceRequest.AssignedTo = req.AssignedTo
	}
	if req.Priority != "" {
		evidenceRequest.Priority = req.Priority
	}
	if req.DueDate != nil {
		evidenceRequest.DueDate = req.DueDate
	}
		// As with documents, we accept explicit setting of RelevanceScore,
		// including setting it back to 0. BodyParser defaults missing ints to 0,
		// so clients should always send the intended score value when updating.
		evidenceRequest.RelevanceScore = req.RelevanceScore

	if err := h.DB.Save(&evidenceRequest).Error; err != nil {
		log.Errorf("Failed to update evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update evidence request"})
	}

	return c.JSON(buildEvidenceRequestResponse(evidenceRequest, project))
}

// DeleteEvidenceRequest deletes an evidence request
func (h *EvidenceRequestHandler) DeleteEvidenceRequest(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	requestID := c.Params("request_id")

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

	// Get evidence request
	var evidenceRequest models.EvidenceRequest
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", requestID, project.ID, org.ID).
		First(&evidenceRequest).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence request not found"})
		}
		log.Errorf("Failed to get evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence request"})
	}

	// Delete evidence request
	if err := h.DB.Delete(&evidenceRequest).Error; err != nil {
		log.Errorf("Failed to delete evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete evidence request"})
	}

	return c.JSON(fiber.Map{"message": "Evidence request deleted successfully"})
}

// FulfillEvidenceRequest marks an evidence request as fulfilled
func (h *EvidenceRequestHandler) FulfillEvidenceRequest(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	requestID := c.Params("request_id")

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

	// Get evidence request
	var evidenceRequest models.EvidenceRequest
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", requestID, project.ID, org.ID).
		First(&evidenceRequest).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence request not found"})
		}
		log.Errorf("Failed to get evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence request"})
	}

	// Parse request body
	var body struct {
		UserID string `json:"user_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Mark as fulfilled
	now := time.Now()
	evidenceRequest.Status = "fulfilled"
	evidenceRequest.FulfilledAt = &now
	evidenceRequest.FulfilledByUser = body.UserID

	if err := h.DB.Save(&evidenceRequest).Error; err != nil {
		log.Errorf("Failed to fulfill evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fulfill evidence request"})
	}

	return c.JSON(buildEvidenceRequestResponse(evidenceRequest, project))
}

// RejectEvidenceRequest marks an evidence request as rejected
func (h *EvidenceRequestHandler) RejectEvidenceRequest(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	requestID := c.Params("request_id")

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

	// Get evidence request
	var evidenceRequest models.EvidenceRequest
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", requestID, project.ID, org.ID).
		First(&evidenceRequest).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Evidence request not found"})
		}
		log.Errorf("Failed to get evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence request"})
	}

	// Parse request body
	var body struct {
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Mark as rejected
	evidenceRequest.Status = "rejected"
	evidenceRequest.RejectionReason = body.Reason

	if err := h.DB.Save(&evidenceRequest).Error; err != nil {
		log.Errorf("Failed to reject evidence request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reject evidence request"})
	}

	return c.JSON(buildEvidenceRequestResponse(evidenceRequest, project))
}
