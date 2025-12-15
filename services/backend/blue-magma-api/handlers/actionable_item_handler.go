package handlers

import (
	"strconv"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type ActionableItemHandler struct {
	DB *gorm.DB
}

func NewActionableItemHandler(db *gorm.DB) *ActionableItemHandler {
	return &ActionableItemHandler{DB: db}
}

// Request/Response structures
type ActionableItemRequest struct {
	RulingID     string  `json:"ruling_id" validate:"required"`
	Title        string  `json:"title" validate:"required"`
	Severity     string  `json:"severity" validate:"required,oneof=critical high medium low"`
	Priority     string  `json:"priority" validate:"required,oneof=critical high medium low"`
	ProblemType  string  `json:"problem_type" validate:"required"`
	Description  string  `json:"description"`
	ProposedFix  string  `json:"proposed_fix"`
	FilePath     string  `json:"file_path"`
	LineNumber   *int    `json:"line_number"`
	Status       string  `json:"status" validate:"oneof=open in_progress resolved dismissed"`
	AssignedTo   string  `json:"assigned_to"`
	DueDate      *string `json:"due_date"` // ISO 8601 format
}

type ActionableItemUpdateRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Severity    *string `json:"severity" validate:"omitempty,oneof=critical high medium low"`
	Priority    *string `json:"priority" validate:"omitempty,oneof=critical high medium low"`
	ProblemType *string `json:"problem_type"`
	ProposedFix *string `json:"proposed_fix"`
	FilePath    *string `json:"file_path"`
	LineNumber  *int    `json:"line_number"`
	Status      *string `json:"status" validate:"omitempty,oneof=open in_progress resolved dismissed"`
	AssignedTo  *string `json:"assigned_to"`
	DueDate     *string `json:"due_date"` // ISO 8601 format
}



// Create a new actionable item
// @Summary Create a new actionable item
// @Description Create a new actionable item for a specific organization
// @Tags ActionableItem
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param actionable_item body ActionableItemRequest true "Actionable item data"
// @Success 201 {object} ActionableItemResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/actionable-item [post]
// @Security Bearer
func (h *ActionableItemHandler) CreateActionableItem(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	var request ActionableItemRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the ruling
	var ruling models.Ruling
	if err := h.DB.First(&ruling, "object_id = ? AND organization_id = ?", request.RulingID, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Ruling not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find ruling")
	}

	objectID, _ := crypto.GenerateUUID()

	// Parse due date if provided
	var dueDate *time.Time
	if request.DueDate != nil && *request.DueDate != "" {
		if parsed, err := time.Parse(time.RFC3339, *request.DueDate); err == nil {
			dueDate = &parsed
		} else {
			return fiber.NewError(fiber.StatusBadRequest, "Invalid due_date format. Use ISO 8601 format")
		}
	}

	// Create the actionable item
	actionableItem := models.ActionableItem{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		RulingID:       ruling.ID,
		Title:          request.Title,
		Description:    request.Description,
		Severity:       request.Severity,
		Priority:       request.Priority,
		ProblemType:    request.ProblemType,
		ProposedFix:    request.ProposedFix,
		FilePath:       request.FilePath,
		LineNumber:     request.LineNumber,
		Status:         request.Status,
		AssignedTo:     request.AssignedTo,
		DueDate:        dueDate,
	}

	if err := h.DB.Create(&actionableItem).Error; err != nil {
		log.Errorf("Failed to create actionable item: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create actionable item")
	}

	// Load the ruling for response
	actionableItem.Ruling = ruling

	return c.Status(fiber.StatusCreated).JSON(BuildActionableItemResponse(org, actionableItem))
}

// Get an actionable item by its object ID
// @Summary Get an actionable item by its object ID
// @Description Retrieve an actionable item by its object ID for a specific organization
// @Tags ActionableItem
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param item_id path string true "Actionable Item Object ID"
// @Success 200 {object} ActionableItemResponse
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/actionable-item/{item_id} [get]
// @Security Bearer
func (h *ActionableItemHandler) GetActionableItem(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	itemID := c.Params("item_id")
	if orgID == "" || itemID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Item ID are required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the actionable item
	var item models.ActionableItem
	if err := h.DB.Preload("Ruling").First(&item, "object_id = ? AND organization_id = ?", itemID, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Actionable item not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find actionable item")
	}

	return c.JSON(BuildActionableItemResponse(org, item))
}

// Get all actionable items for an organization
// @Summary Get all actionable items for an organization
// @Description Retrieve all actionable items for a specific organization with optional filtering
// @Tags ActionableItem
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param status query string false "Filter by status"
// @Param severity query string false "Filter by severity"
// @Param priority query string false "Filter by priority"
// @Param assigned_to query string false "Filter by assigned user"
// @Param problem_type query string false "Filter by problem type"
// @Param limit query int false "Limit number of results" default(50)
// @Param offset query int false "Offset for pagination" default(0)
// @Success 200 {array} ActionableItemResponse
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/actionable-item [get]
// @Security Bearer
func (h *ActionableItemHandler) GetActionableItems(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Build query with filters
	query := h.DB.Preload("Ruling").Where("organization_id = ?", org.ID)

	// Apply filters
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if severity := c.Query("severity"); severity != "" {
		query = query.Where("severity = ?", severity)
	}
	if priority := c.Query("priority"); priority != "" {
		query = query.Where("priority = ?", priority)
	}
	if assignedTo := c.Query("assigned_to"); assignedTo != "" {
		query = query.Where("assigned_to = ?", assignedTo)
	}
	if problemType := c.Query("problem_type"); problemType != "" {
		query = query.Where("problem_type = ?", problemType)
	}

	// Apply pagination
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	query = query.Limit(limit).Offset(offset).Order("created_at DESC")

	// Execute query
	var items []models.ActionableItem
	if err := query.Find(&items).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find actionable items")
	}

	// Build response
	response := make([]ActionableItemResponse, 0)
	for _, item := range items {
		response = append(response, BuildActionableItemResponse(org, item))
	}

	return c.JSON(response)
}

// Get actionable items by report ID
// @Summary Get actionable items by report ID
// @Description Retrieve all actionable items for a specific report
// @Tags ActionableItem
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report Object ID"
// @Success 200 {array} ActionableItemResponse
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/actionable-item/report/{report_id} [get]
// @Security Bearer
func (h *ActionableItemHandler) GetActionableItemsByReport(c *fiber.Ctx) error {
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

	// Find the report
	var report models.Report
	if err := h.DB.First(&report, "object_id = ? AND organization_id = ?", reportID, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Report not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find report")
	}

	// Find actionable items for this report
	var items []models.ActionableItem
	if err := h.DB.Preload("Ruling").
		Joins("JOIN rulings ON actionable_items.ruling_id = rulings.id").
		Joins("JOIN report_sections ON rulings.report_section_id = report_sections.id").
		Where("report_sections.report_id = ? AND actionable_items.organization_id = ?", report.ID, org.ID).
		Find(&items).Error; err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find actionable items")
	}

	// Build response
	response := make([]ActionableItemResponse, 0)
	for _, item := range items {
		response = append(response, BuildActionableItemResponse(org, item))
	}

	return c.JSON(response)
}

// Update an actionable item by its object ID
// @Summary Update an actionable item by its object ID
// @Description Update an actionable item's details for a specific organization
// @Tags ActionableItem
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param item_id path string true "Actionable Item Object ID"
// @Param actionable_item body ActionableItemUpdateRequest true "Actionable item update data"
// @Success 200 {object} ActionableItemResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/actionable-item/{item_id} [put]
// @Security Bearer
func (h *ActionableItemHandler) UpdateActionableItem(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	itemID := c.Params("item_id")
	if orgID == "" || itemID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Item ID are required")
	}

	var request ActionableItemUpdateRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the actionable item
	var item models.ActionableItem
	if err := h.DB.Preload("Ruling").First(&item, "object_id = ? AND organization_id = ?", itemID, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Actionable item not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find actionable item")
	}

	// Update fields that are provided in the request
	if request.Title != nil {
		item.Title = *request.Title
	}
	if request.Description != nil {
		item.Description = *request.Description
	}
	if request.Severity != nil {
		item.Severity = *request.Severity
	}
	if request.Priority != nil {
		item.Priority = *request.Priority
	}
	if request.ProblemType != nil {
		item.ProblemType = *request.ProblemType
	}
	if request.ProposedFix != nil {
		item.ProposedFix = *request.ProposedFix
	}
	if request.FilePath != nil {
		item.FilePath = *request.FilePath
	}
	if request.LineNumber != nil {
		item.LineNumber = request.LineNumber
	}
	if request.Status != nil {
		item.Status = *request.Status
		// If status is being set to resolved, set resolved timestamp
		if *request.Status == "resolved" && item.ResolvedAt == nil {
			now := time.Now()
			item.ResolvedAt = &now
			// TODO: Set ResolvedBy to current user when user context is available
		}
	}
	if request.AssignedTo != nil {
		item.AssignedTo = *request.AssignedTo
	}
	if request.DueDate != nil {
		if *request.DueDate == "" {
			item.DueDate = nil
		} else {
			if parsed, err := time.Parse(time.RFC3339, *request.DueDate); err == nil {
				item.DueDate = &parsed
			} else {
				return fiber.NewError(fiber.StatusBadRequest, "Invalid due_date format. Use ISO 8601 format")
			}
		}
	}

	if err := h.DB.Save(&item).Error; err != nil {
		log.Errorf("Failed to update actionable item: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update actionable item")
	}

	return c.JSON(BuildActionableItemResponse(org, item))
}

// Delete an actionable item by its object ID
// @Summary Delete an actionable item by its object ID
// @Description Delete an actionable item for a specific organization
// @Tags ActionableItem
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param item_id path string true "Actionable Item Object ID"
// @Success 204
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/actionable-item/{item_id} [delete]
// @Security Bearer
func (h *ActionableItemHandler) DeleteActionableItem(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	itemID := c.Params("item_id")
	if orgID == "" || itemID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID and Item ID are required")
	}

	// Find the organization
	var org models.Organization
	if err := h.DB.First(&org, "object_id = ?", orgID).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// Find the actionable item
	var item models.ActionableItem
	if err := h.DB.First(&item, "object_id = ? AND organization_id = ?", itemID, org.ID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return fiber.NewError(fiber.StatusNotFound, "Actionable item not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to find actionable item")
	}

	// Delete the actionable item (soft delete)
	if err := h.DB.Delete(&item).Error; err != nil {
		log.Errorf("Failed to delete actionable item: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to delete actionable item")
	}

	return c.SendStatus(fiber.StatusNoContent)
}
