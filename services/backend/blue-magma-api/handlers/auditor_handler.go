package handlers

import (
	"encoding/json"
	"strconv"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AuditorHandler struct {
	DB *gorm.DB
}

func NewAuditorHandler(db *gorm.DB) *AuditorHandler {
	return &AuditorHandler{DB: db}
}

type AuditorRequest struct {
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Schedule     string          `json:"schedule"`
	Instructions json.RawMessage `json:"instructions"`
	IsActive     *bool           `json:"is_active"`
}

type AuditorResponse struct {
	ObjectID     string          `json:"object_id"`
	ProjectID    string          `json:"project_id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Schedule     string          `json:"schedule"`
	Instructions json.RawMessage `json:"instructions"`
	IsActive     bool            `json:"is_active"`
	LastRunAt    *string         `json:"last_run_at"`
	NextRunAt    *string         `json:"next_run_at"`
	RunCount     int             `json:"run_count"`
	LastStatus   string          `json:"last_status"`
	CreatedAt    string          `json:"created_at"`
	UpdatedAt    string          `json:"updated_at"`
}

// PaginatedAuditorsResponse wraps a list of auditors with pagination metadata.
type PaginatedAuditorsResponse struct {
	Items  []AuditorResponse `json:"items"`
	Total  int64             `json:"total"`
	Pages  int               `json:"pages"`
	Limit  int               `json:"limit"`
	Offset int               `json:"offset"`
}

func buildAuditorResponse(auditor models.Auditor, project models.Project) AuditorResponse {
	response := AuditorResponse{
		ObjectID:     auditor.ObjectID,
		ProjectID:    project.ObjectID,
		Name:         auditor.Name,
		Description:  auditor.Description,
		Schedule:     auditor.Schedule,
		Instructions: json.RawMessage(auditor.Instructions),
		IsActive:     auditor.IsActive,
		RunCount:     auditor.RunCount,
		LastStatus:   auditor.LastStatus,
		CreatedAt:    auditor.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:    auditor.UpdatedAt.Format("2006-01-02 15:04:05"),
	}

	if auditor.LastRunAt != nil {
		lastRunAt := auditor.LastRunAt.Format("2006-01-02 15:04:05")
		response.LastRunAt = &lastRunAt
	}

	if auditor.NextRunAt != nil {
		nextRunAt := auditor.NextRunAt.Format("2006-01-02 15:04:05")
		response.NextRunAt = &nextRunAt
	}

	return response
}

// GetAuditors returns all auditors for a project
// @Summary Get all auditors
// @Description Get all auditors for a specific project
// @Tags Auditor
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Success 200 {object} PaginatedAuditorsResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor [get]
// @Security Bearer
func (h *AuditorHandler) GetAuditors(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Base query for this project's auditors
	db := h.DB.Model(&models.Auditor{}).Where("project_id = ?", project.ID)

	// Pagination parameters
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 500 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// Count total BEFORE pagination
	var total int64
	if err := db.Count(&total).Error; err != nil {
		log.Errorf("Failed to count auditors: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get auditors"})
	}

	// Apply pagination
	var auditors []models.Auditor
	if err := db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&auditors).Error; err != nil {
		log.Errorf("Failed to get auditors: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get auditors"})
	}

	// Initialize response as empty array to avoid returning null when no auditors exist
	items := make([]AuditorResponse, 0, len(auditors))
	for _, auditor := range auditors {
		items = append(items, buildAuditorResponse(auditor, project))
	}

	pages := 0
	if limit > 0 {
		pages = int((total + int64(limit) - 1) / int64(limit))
	}

	return c.JSON(PaginatedAuditorsResponse{
		Items:  items,
		Total:  total,
		Pages:  pages,
		Limit:  limit,
		Offset: offset,
	})
}

// GetDocumentAuditors returns all auditors that target a specific document within a project.
// It inspects the auditor instructions' targets array and filters by document_object_id.
//
// @Summary Get auditors for a document
// @Description Get all auditors associated with a specific document in a project
// @Tags Auditor
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param document_id path string true "Document ID"
// @Success 200 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/document/{document_id}/auditor [get]
// @Security Bearer
func (h *AuditorHandler) GetDocumentAuditors(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	documentID := c.Params("document_id")

	// Resolve organization
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to get organization: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get organization"})
	}

	// Resolve project within org
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Resolve document within project
	var document models.Document
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", documentID, project.ID, org.ID).
		First(&document).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
		}
		log.Errorf("Failed to get document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
	}

	// Load all auditors for the project and filter by document_object_id in instructions.targets.
	var auditors []models.Auditor
	if err := h.DB.Where("project_id = ?", project.ID).Order("created_at DESC").Find(&auditors).Error; err != nil {
		log.Errorf("Failed to get auditors: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get auditors"})
	}

	// Parse instructions and select auditors that explicitly target this document.
	items := make([]AuditorResponse, 0)
	for _, auditor := range auditors {
		// Minimal struct to extract targets from the instructions JSON.
		var instructions struct {
			Targets []struct {
				ControlID        string `json:"control_id"`
				DocumentObjectID string `json:"document_object_id"`
			} `json:"targets"`
		}

		if len(auditor.Instructions) == 0 {
			continue
		}

		if err := json.Unmarshal(auditor.Instructions, &instructions); err != nil {
			log.Warnf("Failed to unmarshal auditor instructions when filtering by document: %v", err)
			continue
		}

		for _, target := range instructions.Targets {
			if target.DocumentObjectID == document.ObjectID {
				items = append(items, buildAuditorResponse(auditor, project))
				break
			}
		}
	}

	return c.JSON(fiber.Map{
		"auditors": items,
	})
}

// GetAuditor returns a single auditor by ID
// @Summary Get an auditor
// @Description Get a specific auditor by ID
// @Tags Auditor
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param auditor_id path string true "Auditor ID"
// @Success 200 {object} AuditorResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id} [get]
// @Security Bearer
func (h *AuditorHandler) GetAuditor(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	auditorID := c.Params("auditor_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	var auditor models.Auditor
	if err := h.DB.Where("object_id = ? AND project_id = ?", auditorID, project.ID).First(&auditor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Auditor not found"})
		}
		log.Errorf("Failed to get auditor: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get auditor"})
	}

	return c.JSON(buildAuditorResponse(auditor, project))
}

// CreateAuditor creates a new auditor
// @Summary Create a new auditor
// @Description Create a new auditor for a specific project
// @Tags Auditor
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param auditor body AuditorRequest true "Auditor data"
// @Success 201 {object} AuditorResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor [post]
// @Security Bearer
func (h *AuditorHandler) CreateAuditor(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")

	var auditorRequest AuditorRequest
	if err := c.BodyParser(&auditorRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Validate required fields
	if auditorRequest.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	if auditorRequest.Instructions == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Instructions are required"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	isActive := true
	if auditorRequest.IsActive != nil {
		isActive = *auditorRequest.IsActive
	}

	auditor := models.Auditor{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           auditorRequest.Name,
		Description:    auditorRequest.Description,
		Schedule:       auditorRequest.Schedule,
		Instructions:   datatypes.JSON(auditorRequest.Instructions),
		IsActive:       isActive,
	}

	if err := h.DB.Create(&auditor).Error; err != nil {
		log.Errorf("Failed to create auditor: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create auditor"})
	}

	return c.Status(201).JSON(buildAuditorResponse(auditor, project))
}

// UpdateAuditor updates an existing auditor
// @Summary Update an auditor
// @Description Update an existing auditor
// @Tags Auditor
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param auditor_id path string true "Auditor ID"
// @Param auditor body AuditorRequest true "Auditor data"
// @Success 200 {object} AuditorResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id} [put]
// @Security Bearer
func (h *AuditorHandler) UpdateAuditor(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	auditorID := c.Params("auditor_id")

	var auditorRequest AuditorRequest
	if err := c.BodyParser(&auditorRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	var auditor models.Auditor
	if err := h.DB.Where("object_id = ? AND project_id = ?", auditorID, project.ID).First(&auditor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Auditor not found"})
		}
		log.Errorf("Failed to get auditor: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get auditor"})
	}

	// Update fields
	if auditorRequest.Name != "" {
		auditor.Name = auditorRequest.Name
	}
	if auditorRequest.Description != "" {
		auditor.Description = auditorRequest.Description
	}
	auditor.Schedule = auditorRequest.Schedule
	if auditorRequest.Instructions != nil {
		auditor.Instructions = datatypes.JSON(auditorRequest.Instructions)
	}
	if auditorRequest.IsActive != nil {
		auditor.IsActive = *auditorRequest.IsActive
	}

	if err := h.DB.Save(&auditor).Error; err != nil {
		log.Errorf("Failed to update auditor: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update auditor"})
	}

	return c.JSON(buildAuditorResponse(auditor, project))
}

// DeleteAuditor deletes an auditor
// @Summary Delete an auditor
// @Description Delete an auditor by ID
// @Tags Auditor
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param auditor_id path string true "Auditor ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id} [delete]
// @Security Bearer
func (h *AuditorHandler) DeleteAuditor(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	auditorID := c.Params("auditor_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	var auditor models.Auditor
	if err := h.DB.Where("object_id = ? AND project_id = ?", auditorID, project.ID).First(&auditor).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Auditor not found"})
		}
		log.Errorf("Failed to get auditor: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get auditor"})
	}

	if err := h.DB.Delete(&auditor).Error; err != nil {
		log.Errorf("Failed to delete auditor: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete auditor"})
	}

	return c.SendStatus(204)
}
