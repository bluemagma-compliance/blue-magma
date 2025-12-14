package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type CollectionHandler struct {
	DB *gorm.DB
}

func NewCollectionHandler(db *gorm.DB) *CollectionHandler {
	return &CollectionHandler{DB: db}
}

type CollectionRequest struct {
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Type           string          `json:"type"` // "process", "table", "diagram"
	AgentType      string          `json:"agent_type"`
	AgentReasoning string          `json:"agent_reasoning"`
	AgentPrompt    string          `json:"agent_prompt"`
	AgentContext   string          `json:"agent_context"`
	Content        json.RawMessage `json:"content"`
	Sources        json.RawMessage `json:"sources"`
}

type CollectionResponse struct {
	ObjectID       string          `json:"object_id"`
	ProjectID      uint            `json:"project_id"`
	Name           string          `json:"name"`
	Description    string          `json:"description"`
	Type           string          `json:"type"`
	AgentType      string          `json:"agent_type"`
	AgentReasoning string          `json:"agent_reasoning"`
	AgentPrompt    string          `json:"agent_prompt"`
	AgentContext   string          `json:"agent_context"`
	Content        json.RawMessage `json:"content"`
	ContentHash    string          `json:"content_hash"`
	Sources        json.RawMessage `json:"sources"`
}

func calculateContentHash(content json.RawMessage) string {
	// Normalize JSON to ensure consistent hashing
	var normalized interface{}
	if err := json.Unmarshal(content, &normalized); err != nil {
		return ""
	}
	canonicalJSON, err := json.Marshal(normalized)
	if err != nil {
		return ""
	}

	hash := sha256.Sum256(canonicalJSON)
	return hex.EncodeToString(hash[:])
}

func buildCollectionResponse(col models.Collection, project models.Project) CollectionResponse {
	return CollectionResponse{
		ObjectID:       col.ObjectID,
		ProjectID:      project.ID,
		Name:           col.Name,
		Description:    col.Description,
		Type:           col.Type,
		AgentType:      col.AgentType,
		AgentReasoning: col.AgentReasoning,
		AgentPrompt:    col.AgentPrompt,
		AgentContext:   col.AgentContext,
		Content:        json.RawMessage(col.Content),
		ContentHash:    col.ContentHash,
		Sources:        json.RawMessage(col.Sources),
	}
}

// GetCollections returns all collections for a project
func (h *CollectionHandler) GetCollections(c *fiber.Ctx) error {
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

	// Get all collections for this project
	var collections []models.Collection
	if err := h.DB.Where("project_id = ? AND organization_id = ?", project.ID, org.ID).
		Find(&collections).Error; err != nil {
		log.Errorf("Failed to get collections: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get collections"})
	}

	response := make([]CollectionResponse, 0)
	for _, col := range collections {
		response = append(response, buildCollectionResponse(col, project))
	}

	return c.JSON(fiber.Map{
		"collections": response,
	})
}

// GetCollection returns a single collection
func (h *CollectionHandler) GetCollection(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	collectionID := c.Params("collection_id")

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

	// Get collection
	var collection models.Collection
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", collectionID, project.ID, org.ID).
		First(&collection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Collection not found"})
		}
		log.Errorf("Failed to get collection: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get collection"})
	}

	return c.JSON(buildCollectionResponse(collection, project))
}

// CreateCollection creates a new collection
func (h *CollectionHandler) CreateCollection(c *fiber.Ctx) error {
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
	var req CollectionRequest
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
	if req.Type != "process" && req.Type != "table" && req.Type != "diagram" {
		return c.Status(400).JSON(fiber.Map{"error": "Type must be 'process', 'table', or 'diagram'"})
	}

	// Generate object ID
	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Calculate content hash
	contentHash := calculateContentHash(req.Content)

	// Create collection
	collection := models.Collection{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           req.Name,
		Description:    req.Description,
		Type:           req.Type,
		AgentType:      req.AgentType,
		AgentReasoning: req.AgentReasoning,
		AgentPrompt:    req.AgentPrompt,
		AgentContext:   req.AgentContext,
		Content:        datatypes.JSON(req.Content),
		ContentHash:    contentHash,
		Sources:        datatypes.JSON(req.Sources),
	}

	if err := h.DB.Create(&collection).Error; err != nil {
		log.Errorf("Failed to create collection: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create collection"})
	}

	return c.Status(201).JSON(buildCollectionResponse(collection, project))
}

// UpdateCollection updates an existing collection
func (h *CollectionHandler) UpdateCollection(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	collectionID := c.Params("collection_id")

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

	// Get collection
	var collection models.Collection
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", collectionID, project.ID, org.ID).
		First(&collection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Collection not found"})
		}
		log.Errorf("Failed to get collection: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get collection"})
	}

	// Parse request
	var req CollectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields
	if req.Name != "" {
		collection.Name = req.Name
	}
	if req.Description != "" {
		collection.Description = req.Description
	}
	if req.Type != "" {
		if req.Type != "process" && req.Type != "table" && req.Type != "diagram" {
			return c.Status(400).JSON(fiber.Map{"error": "Type must be 'process', 'table', or 'diagram'"})
		}
		collection.Type = req.Type
	}
	if req.AgentType != "" {
		collection.AgentType = req.AgentType
	}
	if req.AgentReasoning != "" {
		collection.AgentReasoning = req.AgentReasoning
	}
	if req.AgentPrompt != "" {
		collection.AgentPrompt = req.AgentPrompt
	}
	if req.AgentContext != "" {
		collection.AgentContext = req.AgentContext
	}
	if len(req.Content) > 0 {
		// Calculate new hash
		newHash := calculateContentHash(req.Content)
		if newHash != collection.ContentHash {
			collection.Content = datatypes.JSON(req.Content)
			collection.ContentHash = newHash
			log.Infof("Collection content changed, new hash: %s", newHash)
		}
	}
	if len(req.Sources) > 0 {
		collection.Sources = datatypes.JSON(req.Sources)
	}

	if err := h.DB.Save(&collection).Error; err != nil {
		log.Errorf("Failed to update collection: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update collection"})
	}

	return c.JSON(buildCollectionResponse(collection, project))
}

// DeleteCollection deletes a collection
func (h *CollectionHandler) DeleteCollection(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	collectionID := c.Params("collection_id")

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

	// Get collection
	var collection models.Collection
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", collectionID, project.ID, org.ID).
		First(&collection).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Collection not found"})
		}
		log.Errorf("Failed to get collection: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get collection"})
	}

	// Delete collection
	if err := h.DB.Delete(&collection).Error; err != nil {
		log.Errorf("Failed to delete collection: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete collection"})
	}

	return c.JSON(fiber.Map{"message": "Collection deleted successfully"})
}

