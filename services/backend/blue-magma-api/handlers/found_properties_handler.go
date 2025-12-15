package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type FoundPropertiesHandler struct {
	db *gorm.DB
}

func NewFoundPropertiesHandler(db *gorm.DB) *FoundPropertiesHandler {
	return &FoundPropertiesHandler{
		db: db,
	}
}

type FoundPropertyRequest struct {
	PropertyName  string `json:"property_name"`
	PropertyType  string `json:"property_type"`
	Value         string `json:"value"`
	Key           string `json:"key"` // The key of the found property
	IsIssue       bool   `json:"is_issue"`
	QuestionID    string `json:"question_id"`              // ID of the question this found property is associated with
	IssueSeverity string `json:"issue_severity,omitempty"` // Severity of the issue (e.g., "critical", "high", "medium", "low")
}

type ManyFoundPropertiesRequest struct {
	FoundProperties []FoundPropertyRequest `json:"found_properties"`
	QuestionID      string                 `json:"question_id"` // ID of the question this found property is associated with
}

type FoundPropertyResponse struct {
	ObjectID       string `json:"object_id"`
	OrganizationID string `json:"organization_id"` // ID of the organization this found property
	QuestionID     string `json:"question_id"`     // ID of the question this found property is associated with
	Value          string `json:"value"`           // The value of the found property
	Key            string `json:"key"`             // The key of the found property
	PropertyType   string `json:"property_type"`   // Type of the property (e.g., "string", "integer", "boolean")
	IsIssue        bool   `json:"is_issue"`        // Indicates if the found property is an issue
	IssueSeverity  string `json:"issue_severity"`  // Severity of the issue (e.g., "critical", "high", "medium", "low")
}

// CreateFoundProperty creates a new found property for a given organization
// @Summary Create a new found property
// @Description Create a new found property for a given organization
// @Tags FoundProperties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param found_property body FoundPropertyRequest true "Found Property"
// @Success 201 {object} FoundPropertyResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/found-property [post]
// @Security Bearer
func (h *FoundPropertiesHandler) CreateFoundProperty(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	org := models.Organization{}
	if err := h.db.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		log.Errorf("Organization not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	var request FoundPropertyRequest
	if err := c.BodyParser(&request); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	if request.QuestionID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Question ID is required")
	}

	var question models.Question
	if err := h.db.Where("object_id = ? AND organization_id = ?", request.QuestionID, org.ID).First(&question).Error; err != nil {
		log.Errorf("Question not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Question not found")
	}

	objectId, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate object ID: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to generate object ID")
	}

	foundProperty := models.FoundProperty{
		ObjectID:       objectId,
		OrganizationID: org.ID,
		QuestionID:     question.ID,
		Value:          request.Value,
		Key:            request.Key,
		PropertyType:   request.PropertyType,
		IsIssue:        request.IsIssue,
		IssueSeverity:  request.IssueSeverity,
	}

	if err := h.db.Create(&foundProperty).Error; err != nil {
		log.Errorf("Failed to create found property: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create found property")
	}

	response := FoundPropertyResponse{
		ObjectID:       foundProperty.ObjectID,
		OrganizationID: org.ObjectID,
		QuestionID:     question.ObjectID,
		Value:          foundProperty.Value,
		Key:            foundProperty.Key,
		PropertyType:   foundProperty.PropertyType,
		IsIssue:        foundProperty.IsIssue,
		IssueSeverity:  foundProperty.IssueSeverity,
	}

	return c.Status(fiber.StatusCreated).JSON(response)
}

// CreateManyFoundProperties creates multiple found properties for a given organization
// @Summary Create multiple found properties
// @Description Create multiple found properties for a given organization
// @Tags FoundProperties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param found_properties body ManyFoundPropertiesRequest true "Found Properties"
// @Success 201 {array} FoundPropertyResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/found-property/many [post]
// @Security Bearer
func (h *FoundPropertiesHandler) CreateManyFoundProperties(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	org := models.Organization{}
	if err := h.db.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		log.Errorf("Organization not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	var request ManyFoundPropertiesRequest
	if err := c.BodyParser(&request); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	if request.QuestionID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Question ID is required")
	}

	var question models.Question
	if err := h.db.Where("object_id = ? AND organization_id = ?", request.QuestionID, org.ID).First(&question).Error; err != nil {
		log.Errorf("Question not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Question not found")
	}

	var foundProperties []models.FoundProperty
	for _, prop := range request.FoundProperties {
		objectId, err := crypto.GenerateUUID()
		if err != nil {
			log.Errorf("Failed to generate object ID: %v", err)
			return fiber.NewError(fiber.StatusInternalServerError, "Failed to generate object ID")
		}
		foundProperty := models.FoundProperty{
			ObjectID:       objectId,
			OrganizationID: org.ID,
			QuestionID:     question.ID,
			Value:          prop.Value,
			Key:            prop.Key,
			PropertyType:   prop.PropertyType,
			IsIssue:        prop.IsIssue,
			IssueSeverity:  prop.IssueSeverity,
		}
		foundProperties = append(foundProperties, foundProperty)
	}

	if err := h.db.Create(&foundProperties).Error; err != nil {
		log.Errorf("Failed to create found properties: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to create found properties")
	}

	var responses []FoundPropertyResponse
	for _, fp := range foundProperties {
		responses = append(responses, FoundPropertyResponse{
			ObjectID:       fp.ObjectID,
			OrganizationID: org.ObjectID,
			QuestionID:     question.ObjectID,
			Value:          fp.Value,
			Key:            fp.Key,
			PropertyType:   fp.PropertyType,
			IsIssue:        fp.IsIssue,
			IssueSeverity:  fp.IssueSeverity,
		})
	}
	return c.Status(fiber.StatusCreated).JSON(responses)
}

// GetFoundProperty retrieves a found property by its ID for a given organization
// @Summary Get a found property by ID
// @Description Retrieve a found property by its ID for a given organization
// @Tags FoundProperties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param found_property_id path string true "Found Property ID"
// @Success 200 {object} FoundPropertyResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/found-property/{found_property_id} [get]
// @Security Bearer
func (h *FoundPropertiesHandler) GetFoundProperty(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	org := models.Organization{}
	if err := h.db.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		log.Errorf("Organization not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	foundPropertyID := c.Params("found_property_id")
	if foundPropertyID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Found Property ID is required")
	}
	var foundProperty models.FoundProperty
	if err := h.db.Where("object_id = ? AND organization_id = ?", foundPropertyID, org.ID).Preload("Question").First(&foundProperty).Error; err != nil {
		log.Errorf("Found Property not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Found Property not found")
	}
	response := FoundPropertyResponse{
		ObjectID:       foundProperty.ObjectID,
		OrganizationID: org.ObjectID,
		QuestionID:     foundProperty.Question.ObjectID,
		Value:          foundProperty.Value,
		Key:            foundProperty.Key,
		PropertyType:   foundProperty.PropertyType,
		IsIssue:        foundProperty.IsIssue,
		IssueSeverity:  foundProperty.IssueSeverity,
	}
	return c.JSON(response)
}

// DeleteFoundProperty deletes a found property by its ID for a given organization
// @Summary Delete a found property by ID
// @Description Delete a found property by its ID for a given organization
// @Tags FoundProperties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param found_property_id path string true "Found Property ID"
// @Success 204
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/found-property/{found_property_id} [delete]
// @Security Bearer
func (h *FoundPropertiesHandler) DeleteFoundProperty(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	org := models.Organization{}
	if err := h.db.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		log.Errorf("Organization not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	foundPropertyID := c.Params("found_property_id")
	if foundPropertyID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Found Property ID is required")
	}
	var foundProperty models.FoundProperty
	if err := h.db.Where("object_id = ? AND organization_id = ?", foundPropertyID, org.ID).First(&foundProperty).Error; err != nil {
		log.Errorf("Found Property not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Found Property not found")
	}
	if err := h.db.Delete(&foundProperty).Error; err != nil {
		log.Errorf("Failed to delete found property: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to delete found property")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// UpdateFoundProperty updates an existing found property for a given organization
// @Summary Update an existing found property
// @Description Update an existing found property for a given organization
// @Tags FoundProperties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param found_property_id path string true "Found Property ID"
// @Param found_property body FoundPropertyRequest true "Found Property"
// @Success 200 {object} FoundPropertyResponse
// @Failure 400 {object} fiber.Error
// @Failure 404 {object} fiber.Error
// @Failure 500 {object} fiber.Error
// @Router /api/v1/org/{org_id}/found-property/{found_property_id} [put]
// @Security Bearer
func (h *FoundPropertiesHandler) UpdateFoundProperty(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	if orgID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Organization ID is required")
	}

	org := models.Organization{}
	if err := h.db.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		log.Errorf("Organization not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	foundPropertyID := c.Params("found_property_id")
	if foundPropertyID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "Found Property ID is required")
	}
	var foundProperty models.FoundProperty
	if err := h.db.Where("object_id = ? AND organization_id = ?", foundPropertyID, org.ID).First(&foundProperty).Error; err != nil {
		log.Errorf("Found Property not found: %v", err)
		return fiber.NewError(fiber.StatusNotFound, "Found Property not found")
	}
	var request FoundPropertyRequest
	if err := c.BodyParser(&request); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	if request.Value != "" {
		foundProperty.Value = request.Value
	}
	if request.Key != "" {
		foundProperty.Key = request.Key
	}
	if request.PropertyType != "" {
		foundProperty.PropertyType = request.PropertyType
	}
	// For booleans, update only if the request is explicitly set (true or false)
	foundProperty.IsIssue = request.IsIssue

	if err := h.db.Save(&foundProperty).Error; err != nil {
		log.Errorf("Failed to update found property: %v", err)
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to update found property")
	}
	response := FoundPropertyResponse{
		ObjectID:       foundProperty.ObjectID,
		OrganizationID: org.ObjectID,
		QuestionID:     foundProperty.Question.ObjectID,
		Value:          foundProperty.Value,
		Key:            foundProperty.Key,
		PropertyType:   foundProperty.PropertyType,
		IsIssue:        foundProperty.IsIssue,
		IssueSeverity:  foundProperty.IssueSeverity,
	}
	return c.JSON(response)
}
