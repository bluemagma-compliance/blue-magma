package handlers

import (
	"crypto/rand"
	"encoding/base64"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	log "github.com/sirupsen/logrus"
)

type APIKeyHandler struct {
	DB *gorm.DB
}

func NewAPIKeyHandler(db *gorm.DB) *APIKeyHandler {
	return &APIKeyHandler{
		DB: db,
	}
}

type APIKeyRequest struct {
	KeyName string `json:"key_name"`
	Enabled bool   `json:"enabled"`
}

func generateAPIKey(length int) (string, error) {
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}

	// Generate the base64 encoded string
	key := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bytes)

	// Ensure the key starts with an alphanumeric character
	// If it starts with a special character, replace the first character with a random alphanumeric one
	firstChar := key[0]
	if !((firstChar >= 'A' && firstChar <= 'Z') || (firstChar >= 'a' && firstChar <= 'z') || (firstChar >= '0' && firstChar <= '9')) {
		// Generate a random alphanumeric character (A-Z, a-z, 0-9)
		// Total: 26 + 26 + 10 = 62 characters
		alphanumeric := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
		randomByte := make([]byte, 1)
		_, err := rand.Read(randomByte)
		if err != nil {
			return "", err
		}
		replacementChar := alphanumeric[int(randomByte[0])%len(alphanumeric)]
		key = string(replacementChar) + key[1:]
	}

	return key, nil
}

// CreateAPIKey creates a new API key for an organization
// @Summary Create a new API key
// @Description Create a new API key for an organization
// @Tags api_key
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param api_key body handlers.APIKeyRequest true "API Key data"
// @Success 201 {object} models.APIKey
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/api_key [post]
// @Security Bearer
func (h *APIKeyHandler) CreateAPIKey(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var apiKeyRequest APIKeyRequest
	if err := c.BodyParser(&apiKeyRequest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	organization := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&organization).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// generate a new API key
	apiKeyString, err := generateAPIKey(32)
	if err != nil {
		log.Errorf("Failed to generate API key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate API key"})
	}

	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate object ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate object ID"})
	}

	apiKey := models.APIKey{
		ObjectID:       objectID,
		Name:           apiKeyRequest.KeyName,
		OrganizationID: organization.ID,
		Key:            apiKeyString,
		Organization:   organization,
		Enabled:        apiKeyRequest.Enabled,
	}
	if err := h.DB.Create(&apiKey).Error; err != nil {
		log.Errorf("Failed to create API key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create API key"})
	}
	// get the decrypted API key
	// decryptedKey, err := crypto.DecryptField(apiKey.Key)
	// if err != nil {
	// 	log.Errorf("Failed to decrypt API key: %v", err)
	// 	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to decrypt API key"})
	// }
	// apiKey.Key = decryptedKey
	return c.Status(fiber.StatusCreated).JSON(apiKey)
}

// GetAPIKey retrieves an API key by its ID
// @Summary Get an API key by ID
// @Description Get an API key by ID
// @Tags api_key
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param api_key_id path string true "API Key ID"
// @Success 200 {object} models.APIKey
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/api_key/{api_key_id} [get]
// @Security Bearer
func (h *APIKeyHandler) GetAPIKey(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	apiKeyId := c.Params("api_key_id")

	var apiKey models.APIKey
	if err := h.DB.Where("object_id = ? AND organization_id = ?", apiKeyId, orgId).First(&apiKey).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "API key not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find API key"})
	}

	return c.JSON(apiKey)
}

// UpdateAPIKey updates an API key by its ID
// @Summary Update an API key by ID
// @Description Update an API key by ID
// @Tags api_key
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param api_key_id path string true "API Key ID"
// @Param api_key body handlers.APIKeyRequest true "API Key data"
// @Success 200 {object} models.APIKey
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/api_key/{api_key_id} [put]
// @Security Bearer
func (h *APIKeyHandler) UpdateAPIKey(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	apiKeyId := c.Params("api_key_id")

	var apiKeyRequest APIKeyRequest
	if err := c.BodyParser(&apiKeyRequest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	var apiKey models.APIKey
	if err := h.DB.Where("object_id = ? AND organization_id = ?", apiKeyId, orgId).First(&apiKey).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "API key not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find API key"})
	}

	apiKey.Name = apiKeyRequest.KeyName
	apiKey.Enabled = apiKeyRequest.Enabled
	if err := h.DB.Save(&apiKey).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update API key"})
	}

	return c.JSON(apiKey)
}

// DeleteAPIKey deletes an API key by its ID
// @Summary Delete an API key by ID
// @Description Delete an API key by ID
// @Tags api_key
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param api_key_id path string true "API Key ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/api_key/{api_key_id} [delete]
// @Security Bearer
func (h *APIKeyHandler) DeleteAPIKey(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	apiKeyId := c.Params("api_key_id")

	if err := h.DB.Where("object_id = ? AND organization_id = ?", apiKeyId, orgId).Delete(&models.APIKey{}).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "API key not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete API key"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
