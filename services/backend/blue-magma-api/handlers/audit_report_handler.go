package handlers

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AuditReportHandler struct {
	DB *gorm.DB
}

func NewAuditReportHandler(db *gorm.DB) *AuditReportHandler {
	return &AuditReportHandler{DB: db}
}

type AuditReportResponse struct {
	ObjectID     string          `json:"object_id"`
	ProjectID    string          `json:"project_id"`
	AuditorID    string          `json:"auditor_id"`
	AuditorName  string          `json:"auditor_name"`
	Status       string          `json:"status"`
	Score        float64         `json:"score"`
	Results      json.RawMessage `json:"results"`
	ExecutedAt   string          `json:"executed_at"`
	ExecutedBy   string          `json:"executed_by"`
	Duration     int             `json:"duration"`
	ErrorMessage string          `json:"error_message,omitempty"`
	CreatedAt    string          `json:"created_at"`
}

// PaginatedAuditReportsResponse wraps a list of audit reports with pagination metadata.
type PaginatedAuditReportsResponse struct {
	Items  []AuditReportResponse `json:"items"`
	Total  int64                 `json:"total"`
	Pages  int                   `json:"pages"`
	Limit  int                   `json:"limit"`
	Offset int                   `json:"offset"`
}

type RunAuditRequest struct {
	// Optional: Provide custom results if running manually with pre-computed data
	// If not provided, this endpoint would trigger an async audit job
	Results json.RawMessage `json:"results,omitempty"`
	Status  string          `json:"status,omitempty"`
	Score   float64         `json:"score,omitempty"`
}

func buildAuditReportResponse(report models.AuditReport, project models.Project, auditor models.Auditor) AuditReportResponse {
	return AuditReportResponse{
		ObjectID:     report.ObjectID,
		ProjectID:    project.ObjectID,
		AuditorID:    auditor.ObjectID,
		AuditorName:  auditor.Name,
		Status:       report.Status,
		Score:        report.Score,
		Results:      json.RawMessage(report.Results),
		ExecutedAt:   report.ExecutedAt.Format("2006-01-02 15:04:05"),
		ExecutedBy:   report.ExecutedBy,
		Duration:     report.Duration,
		ErrorMessage: report.ErrorMessage,
		CreatedAt:    report.CreatedAt.Format("2006-01-02 15:04:05"),
	}
}

// GetAuditReports returns all audit reports for an auditor
// @Summary Get all audit reports
// @Description Get all audit reports for a specific auditor
// @Tags AuditReport
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param auditor_id path string true "Auditor ID"
// @Success 200 {object} PaginatedAuditReportsResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id}/report [get]
// @Security Bearer
func (h *AuditReportHandler) GetAuditReports(c *fiber.Ctx) error {
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

	// Base query for this auditor's reports
	db := h.DB.Model(&models.AuditReport{}).Where("auditor_id = ?", auditor.ID)

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
		log.Errorf("Failed to count audit reports: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get audit reports"})
	}

	// Apply pagination
	var reports []models.AuditReport
	if err := db.Order("executed_at DESC").Limit(limit).Offset(offset).Find(&reports).Error; err != nil {
		log.Errorf("Failed to get audit reports: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get audit reports"})
	}

	items := make([]AuditReportResponse, 0, len(reports))
	for _, report := range reports {
		items = append(items, buildAuditReportResponse(report, project, auditor))
	}

	pages := 0
	if limit > 0 {
		pages = int((total + int64(limit) - 1) / int64(limit))
	}

	return c.JSON(PaginatedAuditReportsResponse{
		Items:  items,
		Total:  total,
		Pages:  pages,
		Limit:  limit,
		Offset: offset,
	})
}

// GetAuditReport returns a single audit report by ID
// @Summary Get an audit report
// @Description Get a specific audit report by ID
// @Tags AuditReport
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param auditor_id path string true "Auditor ID"
// @Param report_id path string true "Report ID"
// @Success 200 {object} AuditReportResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id}/report/{report_id} [get]
// @Security Bearer
func (h *AuditReportHandler) GetAuditReport(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	auditorID := c.Params("auditor_id")
	reportID := c.Params("report_id")

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

	var report models.AuditReport
	if err := h.DB.Where("object_id = ? AND auditor_id = ?", reportID, auditor.ID).First(&report).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Audit report not found"})
		}
		log.Errorf("Failed to get audit report: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get audit report"})
	}

	return c.JSON(buildAuditReportResponse(report, project, auditor))
}

// RunAudit triggers a manual audit run
// @Summary Run an audit
// @Description Trigger a manual audit run for an auditor
// @Tags AuditReport
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param auditor_id path string true "Auditor ID"
// @Param request body RunAuditRequest false "Optional audit results"
// @Success 201 {object} AuditReportResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/auditor/{auditor_id}/report/run [post]
// @Security Bearer
func (h *AuditReportHandler) RunAudit(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	auditorID := c.Params("auditor_id")

	var runRequest RunAuditRequest
	if err := c.BodyParser(&runRequest); err != nil {
		// Empty body is acceptable - will create a "running" status report
		runRequest = RunAuditRequest{}
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

	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Determine who triggered the audit
	executedBy := "manual"
	auth := c.Locals("auth")
	if auth != nil {
		authContext, ok := auth.(*middleware.AuthContext)
		if ok && authContext.User != nil {
			executedBy = authContext.User.ObjectID
		}
	}

	// Determine status
	status := "running"
	if runRequest.Status != "" {
		status = runRequest.Status
	}

	// Create results JSON
	var resultsJSON datatypes.JSON
	if runRequest.Results != nil {
		resultsJSON = datatypes.JSON(runRequest.Results)
	} else {
		// Create empty results structure
		emptyResults := map[string]interface{}{
			"requirements": []interface{}{},
			"summary":      "Audit is running...",
		}
		resultsBytes, _ := json.Marshal(emptyResults)
		resultsJSON = datatypes.JSON(resultsBytes)
	}

	now := time.Now()
	report := models.AuditReport{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		AuditorID:      auditor.ID,
		Status:         status,
		Score:          runRequest.Score,
		Results:        resultsJSON,
		ExecutedAt:     now,
		ExecutedBy:     executedBy,
		Duration:       0, // Will be updated when audit completes
	}

	if err := h.DB.Create(&report).Error; err != nil {
		log.Errorf("Failed to create audit report: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create audit report"})
	}

	// Update auditor's last run metadata
	auditor.LastRunAt = &now
	auditor.RunCount++
	auditor.LastStatus = status
	if err := h.DB.Save(&auditor).Error; err != nil {
		log.Warnf("Failed to update auditor metadata: %v", err)
		// Don't fail the request, just log the warning
	}

	return c.Status(201).JSON(buildAuditReportResponse(report, project, auditor))
}
