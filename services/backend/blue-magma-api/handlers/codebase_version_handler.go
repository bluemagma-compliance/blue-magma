package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type CodebaseVersionHandler struct {
	DB *gorm.DB
}

func NewCodebaseVersionHandler(db *gorm.DB) *CodebaseVersionHandler {
	return &CodebaseVersionHandler{DB: db}
}

type CodebaseVersionRequest struct {
	CodebaseID string `json:"codebase_id"`
	BranchName string `json:"branch_name"`
	CommitHash string `json:"commit_hash"`
	Status     string `json:"status,omitempty"`
	Summary    string `json:"summary,omitempty"`
}

// CreateCodebaseVersion creates a new codebase version in the database
// @Summary: Create a new codebase version
// @Description Create a new codebase version
// @Tags codebase_version
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param codebaseVersion body CodebaseVersionRequest true "CodebaseVersion data"
// @Success 201 {object} models.CodebaseVersion
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase_version [post]
// @Security Bearer
func (h *CodebaseVersionHandler) CreateCodebaseVersion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var serviceVersionRequest CodebaseVersionRequest
	if err := c.BodyParser(&serviceVersionRequest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// find the codebase by ID
	var codebase models.Codebase
	if err := h.DB.Where("object_id = ?", serviceVersionRequest.CodebaseID).First(&codebase).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Service not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find service"})
	}

	objectId := serviceVersionRequest.CodebaseID + "_" + serviceVersionRequest.BranchName

	// make sure there are no other service versions with the same commit hash + branch name + service id
	var existingServiceVersion models.CodebaseVersion
	if err := h.DB.Where("branch_name = ? AND commit_hash = ? AND codebase_id = ?", serviceVersionRequest.BranchName, serviceVersionRequest.CommitHash, serviceVersionRequest.CodebaseID).First(&existingServiceVersion).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Service version with the same branch name and commit hash already exists"})
	}

	serviceVersion := models.CodebaseVersion{
		ObjectID:       objectId,
		OrganizationID: org.ID,
		BranchName:     serviceVersionRequest.BranchName,
		CommitHash:     serviceVersionRequest.CommitHash,
		CodebaseID:     codebase.ID,
		Summary:        serviceVersionRequest.Summary,
		// Codebase:       codebase,
	}
	if err := h.DB.Create(&serviceVersion).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create service version"})
	}
	return c.Status(fiber.StatusCreated).JSON(serviceVersion)
}

// GetCodebaseVersion retrieves a codebase version by ID
// @Summary: Get a codebase version by ID
// @Description Get a codebase version by ID
// @Tags codebase_version
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param codebase_version_id path string true "Codebase Version ID"
// @Success 200 {object} models.CodebaseVersion
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase_version/{codebase_version_id} [get]
// @Security Bearer
func (h *CodebaseVersionHandler) GetCodebaseVersion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	id := c.Params("service_version_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Where("object_id = ? AND organization_id = ?", id, org.ID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Codebase version not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find codebase version"})
	}
	return c.JSON(codebaseVersion)
}

// DeleteCodebaseVersion deletes a codebase version by ID
// @Summary: Delete a codebase version by ID
// @Description Delete a codebase version by ID
// @Tags codebase_version
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param codebase_version_id path string true "Codebase Version ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase_version/{codebase_version_id} [delete]
// @Security Bearer
func (h *CodebaseVersionHandler) DeleteCodebaseVersion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	id := c.Params("service_version_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Where("object_id = ? AND organization_id = ?", id, org.ID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Service version not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find service version"})
	}

	if err := h.DB.Unscoped().Delete(&codebaseVersion).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete service version"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// Update a codebase version by ID
// @Summary: Update a codebase version by ID
// @Description Update a codebase version by ID
// @Tags codebase_version
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param codebase_version_id path string true "Codebase Version ID"
// @Param codebaseVersion body CodebaseVersionRequest true "CodebaseVersion data"
// @Success 200 {object} models.CodebaseVersion
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase_version/{codebase_version_id} [put]
// @Security Bearer
func (h *CodebaseVersionHandler) UpdateCodebaseVersion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	id := c.Params("service_version_id")

	var serviceVersionRequest CodebaseVersionRequest
	if err := c.BodyParser(&serviceVersionRequest); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Where("object_id = ? AND organization_id = ?", id, org.ID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Service version not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find service version"})
	}

	if serviceVersionRequest.BranchName != "" {
		codebaseVersion.BranchName = serviceVersionRequest.BranchName
	}
	if serviceVersionRequest.CommitHash != "" {
		codebaseVersion.CommitHash = serviceVersionRequest.CommitHash
	}
	if serviceVersionRequest.Status != "" {
		codebaseVersion.IngestStatus = serviceVersionRequest.Status
	}
	if serviceVersionRequest.Summary != "" {
		codebaseVersion.Summary = serviceVersionRequest.Summary
	}
	if err := h.DB.Save(&codebaseVersion).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update service version"})
	}
	return c.JSON(codebaseVersion)
}


// GetCodebaseVersion retrieves a codebase version by ID and its associated rulings and actionable items
// @Summary: Get a codebase version by ID
// @Description Get a codebase version by ID
// @Tags codebase_version
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param codebase_version_id path string true "Codebase Version ID"
// @Success 200 {object} models.CodebaseVersion
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase_version/{codebase_version_id}/actionable_items [get]
// @Security Bearer
func (h *CodebaseVersionHandler) GetCodebaseVersionActionableItems(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	id := c.Params("codebase_version_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Preload("Rulings.ActionableItems").Where("object_id = ? AND organization_id = ?", id, org.ID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Codebase version not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find codebase version", "details": err.Error(), "orgId": orgId, "id": id})
	}

	return c.JSON(codebaseVersion)
}
