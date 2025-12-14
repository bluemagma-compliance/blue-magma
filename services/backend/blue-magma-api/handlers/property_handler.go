package handlers

import (
	"strconv"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/pgvector/pgvector-go"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PropertyHandler struct {
	DB *gorm.DB
}

func NewPropertyHandler(db *gorm.DB) *PropertyHandler {
	return &PropertyHandler{
		DB: db,
	}
}

type CreatePropertyRequest struct {
	CodebaseVersionID   string           `json:"codebase_version_id" validate:"required"`
	PropertyKey         string           `json:"property_key" validate:"required"`
	PropertyValue       string           `json:"property_value" validate:"required"`
	PropertyType        string           `json:"property_type" validate:"required"`
	Reasoning           string           `json:"reasoning"`
	FilePath            string           `json:"file_path"`
	PropertyValueVector *pgvector.Vector `json:"property_value_vector"` // Vector representation of the property value
	VersionHash         string           `json:"version_hash"` // Hash of the codebase version for consistency checks
}

// CreateProperty creates a new property for a codebase version
// @Summary Create a new property for a codebase version
// @Description Create a new property for a codebase version
// @Tags Properties
// @Accept json
// @Produce json
// @Param request body CreatePropertyRequest true "Create Property Request"
// @Param org_id path string true "Organization ID"
// @Success 201 {object} models.CodebaseVersionProperty
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/property/code/ [post]
// @Security Bearer
func (h *PropertyHandler) CreateProperty(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var request CreatePropertyRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	var organization models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&organization).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	// find the codebase version by ID
	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Where("object_id = ? AND organization_id = ?", request.CodebaseVersionID, organization.ID).First(&codebaseVersion).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Codebase version not found")
	}

	objectId, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	property := models.CodebaseVersionProperty{
		ObjectID:          objectId,
		OrganizationID:    organization.ID,
		CodebaseVersionID: codebaseVersion.ID,
		CodebaseVersion:   codebaseVersion,
		PropertyKey:       request.PropertyKey,
		PropertyValue:     request.PropertyValue,
		PropertyType:      request.PropertyType,
		Reasoning:         request.Reasoning,
		FilePath:          request.FilePath,
		VersionHash:       request.VersionHash,
	}

	if err := h.DB.Create(&property).Error; err != nil {
		log.Errorf("Failed to create property: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create property"})
	}
	return c.Status(fiber.StatusCreated).JSON(property)

}

// GetProperty retrieves a property by its ID
// @Summary Get a property by ID
// @Description Get a property by ID
// @Tags Properties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param property_id path string true "Property ID"
// @Success 200 {object} models.CodebaseVersionProperty
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/property/code/{property_id} [get]
// @Security Bearer
func (h *PropertyHandler) GetProperty(c *fiber.Ctx) error {

	orgId := c.Params("org_id")
	propertyId := c.Params("property_id")

	var organization models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&organization).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	var property models.CodebaseVersionProperty
	if err := h.DB.Where("object_id = ? AND organization_id = ?", propertyId, organization.ID).First(&property).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Property not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Property not found"})
		}
		log.Errorf("Failed to find property: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find property"})
	}

	return c.JSON(property)
}

// EditProperty updates a property by its ID
// @Summary Edit a property by ID
// @Description Edit a property by ID
// @Tags Properties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param property_id path string true "Property ID"
// @Param request body CreatePropertyRequest true "Edit Property Request"
// @Success 200 {object} models.CodebaseVersionProperty
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/property/code/{property_id} [put]
// @Security Bearer
func (h *PropertyHandler) EditProperty(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	propertyId := c.Params("property_id")

	var request CreatePropertyRequest
	if err := c.BodyParser(&request); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}

	var organization models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&organization).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	var property models.CodebaseVersionProperty
	if err := h.DB.Where("object_id = ? AND organization_id = ?", propertyId, organization.ID).First(&property).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Property not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Property not found"})
		}
		log.Errorf("Failed to find property: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find property"})
	}

	property.PropertyKey = request.PropertyKey
	property.PropertyValue = request.PropertyValue
	property.PropertyType = request.PropertyType
	property.Reasoning = request.Reasoning
	property.FilePath = request.FilePath
	property.VersionHash = request.VersionHash

	if err := h.DB.Save(&property).Error; err != nil {
		log.Errorf("Failed to update property: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update property"})
	}

	return c.JSON(property)
}

// GetProperties retrieves all properties for an org, optional filter by codebase version ID, path, valueVector, type or key
// @Summary Get all properties for an org
// @Description Get all properties for an org, optional filter by codebase version ID, path, valueVector, type or key
// @Tags Properties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param codebase_version_id query string false "Codebase Version ID"
// @Param path query string false "File Path"
// @Param value_vector query string false "Property Value Vector"
// @Param type query string false "Property Type"
// @Param key query string false "Property Key"
// @Success 200 {array} models.CodebaseVersionProperty
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/property/code/ [get]
// @Security Bearer
func (h *PropertyHandler) GetProperties(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var organization models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&organization).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	var properties []models.CodebaseVersionProperty
	query := h.DB.Where("organization_id = ?", organization.ID)

	// Optional filters
	if codebaseVersionID := c.Query("codebase_version_id"); codebaseVersionID != "" {
		var version models.CodebaseVersion
		if err := h.DB.Where("object_id = ? AND organization_id = ?", codebaseVersionID, organization.ID).First(&version).Error; err != nil {
			return fiber.NewError(fiber.StatusNotFound, "Codebase version not found")
		}
		query = query.Where("codebase_version_id = ?", version.ID)
	}
	if path := c.Query("path"); path != "" {
		query = query.Where("file_path LIKE ?", "%"+path+"%")
	}
	if propertyType := c.Query("type"); propertyType != "" {
		query = query.Where("property_type = ?", propertyType)
	}
	if key := c.Query("key"); key != "" {
		query = query.Where("property_key = ?", key)
	}
	if version_hash := c.Query("version_hash"); version_hash != "" {
		query = query.Where("version_hash = ?", version_hash)
	}

	if vectorStr := c.Query("value_vector"); vectorStr != "" {
		parts := strings.Split(vectorStr, ",")
		var vec []float32
		for _, p := range parts {
			f, err := strconv.ParseFloat(strings.TrimSpace(p), 32)
			if err != nil {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid vector format"})
			}
			vec = append(vec, float32(f))
		}

		// Apply similarity clause
		query = query.Clauses(clause.OrderBy{
			Expression: clause.Expr{
				SQL:  "property_value_vector <-> ?",
				Vars: []interface{}{pgvector.NewVector(vec)},
			},
		}).Limit(5) // or use a configurable limit
	}

	if err := query.Find(&properties).Error; err != nil {
		log.Errorf("Failed to retrieve properties: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve properties"})
	}

	return c.JSON(properties)
}

// DeleteProperty deletes a property by its ID
// @Summary Delete a property by ID
// @Description Delete a property by ID
// @Tags Properties
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param property_id path string true "Property ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/property/code/{property_id} [delete]
// @Security Bearer
func (h *PropertyHandler) DeleteProperty(c *fiber.Ctx) error {

	orgId := c.Params("org_id")
	propertyId := c.Params("property_id")

	var organization models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&organization).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "Organization not found")
	}

	var property models.CodebaseVersionProperty
	if err := h.DB.Where("object_id = ? AND organization_id = ?", propertyId, organization.ID).First(&property).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Property not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Property not found"})
		}
		log.Errorf("Failed to find property: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find property"})
	}

	if err := h.DB.Delete(&property).Error; err != nil {
		log.Errorf("Failed to delete property: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete property"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
