package handlers

import (
	"fmt"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/utils"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type CodebaseHandler struct {
	DB *gorm.DB
}

func NewCodebaseHandler(db *gorm.DB) *CodebaseHandler {
	return &CodebaseHandler{DB: db}
}

type CodebaseRequest struct {
	CodebaseName        string `json:"codebase_name"`
	CodebaseRepoURL     string `json:"codebase_repo_url"`
	CodebaseDescription string `json:"codebase_description"`
	CodebaseType        string `json:"codebase_type"` // Optional field for codebase type

	// GitHub integration fields
	SourceType string `json:"source_type,omitempty"` // "manual"|"github"
}

type serviceVersionResponse struct {
	ObjectID   string `json:"object_id"`
	BranchName string `json:"branch_name"`
	CommitHash string `json:"commit_hash"`
	Summary    string `json:"summary"` // Optional field for summary
}

type CodebaseResponse struct {
	ObjectID            string                   `json:"object_id"`
	CodebaseName        string                   `json:"codebase_name"`
	CodebaseRepoURL     string                   `json:"codebase_repo_url"`
	CodebaseDescription string                   `json:"codebase_description"`
	Versions            []serviceVersionResponse `json:"versions"`
	ApiKey              string                   `json:"api_key,omitempty"`
	OrganizationID      string                   `json:"organization_id,omitempty"`
	CodebaseType        string                   `json:"codebase_type"` // Optional field for codebase type
	SourceType          string                   `json:"source_type"`   // github or manual
}

// CreateCodebase creates a new codebase
// @Summary Create a new codebase
// @Description Create a new codebase
// @Tags codebase
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param codebase body CodebaseRequest true "Service data"
// @Success 201 {object} CodebaseResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase [post]
// @Security Bearer
func (h *CodebaseHandler) CreateCodebase(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var serviceRequest CodebaseRequest
	if err := c.BodyParser(&serviceRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// check that the type exists an is in teh codebase category
	var codebaseType models.SubjectType
	if err := h.DB.Where("object_id = ? AND category = ?", serviceRequest.CodebaseType, "codebase").First(&codebaseType).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid codebase type"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check codebase type"})
	}

	objectId, err := crypto.GenerateUUID()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// generate a new API key
	apiKeyString, err := generateAPIKey(32)
	if err != nil {
		log.Errorf("Failed to generate API key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate API key"})
	}

	ApiObjectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate object ID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate object ID"})
	}

	// Extract repository name from URL first to use in API key name
	repoName := utils.ExtractRepoNameFromURL(serviceRequest.CodebaseRepoURL)
	if repoName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid repository URL - could not extract repository name"})
	}

	// Create an API key for the service to use when ingesting new versions
	apiKey := models.APIKey{
		ObjectID:       ApiObjectID,
		Name:           repoName + " API Key",
		OrganizationID: org.ID,
		Enabled:        true,
		Key:            apiKeyString,
	}
	if err := h.DB.Create(&apiKey).Error; err != nil {
		log.Errorf("Failed to create API key: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create API key"})
	}

	service := models.Codebase{
		ObjectID:           objectId,
		OrganizationID:     org.ID,
		ServiceName:        repoName, // Use extracted repo name, ignore provided name
		ServiceRepoURL:     serviceRequest.CodebaseRepoURL,
		ServiceDescription: serviceRequest.CodebaseDescription,
		APIKeyID:           apiKey.ID,
		APIKey:             apiKey,
		SubjectTypeID:      codebaseType.ID,
		SourceType:         "manual",
	}

	if err := h.DB.Create(&service).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create service"})
	}

	// get all versions that have that service ID
	versions := []models.CodebaseVersion{}
	if err := h.DB.Where("codebase_id = ?", service.ID).Find(&versions).Error; err != nil {
		log.Errorf("Failed to retrieve versions: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve versions"})
	}
	var versionResponses []serviceVersionResponse
	for _, version := range versions {
		versionResponses = append(versionResponses, serviceVersionResponse{
			ObjectID:   version.ObjectID,
			BranchName: version.BranchName,
			CommitHash: version.CommitHash,
		})
	}

	response := CodebaseResponse{
		ObjectID:            service.ObjectID,
		CodebaseName:        service.ServiceName,
		CodebaseRepoURL:     service.ServiceRepoURL,
		CodebaseDescription: service.ServiceDescription,
		Versions:            versionResponses,
		ApiKey:              "APIKey " + apiKeyString,
		OrganizationID:      orgId,
		CodebaseType:        serviceRequest.CodebaseType,
	}

	return c.Status(201).JSON(response)
}

// GetCodebases retrieves all codebases for a given organization
// @Summary Get all codebases
// @Description Get all codebases for an organization
// @Tags codebase
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {array} CodebaseResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase [get]
// @Security Bearer
func (h *CodebaseHandler) GetCodebases(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var codebases []models.Codebase
	if err := h.DB.
		Where("organization_id = ?", org.ID).
		Preload("SubjectType").
		Preload("APIKey").
		Find(&codebases).Error; err != nil {
		log.Errorf("Failed to retrieve services: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve services"})

	}

	serviceResponses := make([]CodebaseResponse, 0)
	for _, service := range codebases {

		// get all versions that have that service ID
		versions := []models.CodebaseVersion{}
		if err := h.DB.Where("codebase_id = ?", service.ID).Find(&versions).Error; err != nil {
			log.Errorf("Failed to retrieve versions: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve versions"})
		}
		var versionResponses []serviceVersionResponse
		for _, version := range versions {
			versionResponses = append(versionResponses, serviceVersionResponse{
				ObjectID:   version.ObjectID,
				BranchName: version.BranchName,
				CommitHash: version.CommitHash,
				Summary:    version.Summary, // Assuming CodebaseVersion has a Summary field
			})
		}

		serviceResponses = append(serviceResponses, CodebaseResponse{
			ObjectID:            service.ObjectID,
			CodebaseName:        service.ServiceName,
			CodebaseRepoURL:     service.ServiceRepoURL,
			CodebaseDescription: service.ServiceDescription,
			Versions:            versionResponses,
			CodebaseType:        service.SubjectType.ObjectID, // Assuming SubjectType has ObjectID field
			SourceType:          "manual",
			ApiKey:              "APIKey " + service.APIKey.Key, // Assuming APIKey has Key field
		})
	}

	repos := ListGithubRepositories(orgId)
	for _, repo := range repos {
		serviceResponses = append(serviceResponses, GithubRepoToCodebaseResponse(repo))
	}

	return c.JSON(serviceResponses)
}

func GithubRepoToCodebaseResponse(repo Repository) CodebaseResponse {
	return CodebaseResponse{
		ObjectID:            fmt.Sprintf("%d", repo.ID),
		CodebaseName:        repo.Name,
		CodebaseRepoURL:     repo.URL,
		CodebaseDescription: repo.Description,
		Versions:            []serviceVersionResponse{},
		SourceType:          "github",
	}
}

// GetCodebase retrieves a codebase by its ID
// @Summary Get a codebase by ID
// @Description Get a codebase by ID
// @Tags codebase
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param service_id path string true "Codebase ID"
// @Param type query string true "Codebase type"
// @Success 200 {object} CodebaseResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase/{service_id} [get]
// @Security Bearer
func (h *CodebaseHandler) GetCodebase(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	serviceId := c.Params("service_id")
	codebaseType := c.Query("type")

	switch codebaseType {
	case "github":
		repos := ListGithubRepositories(orgId)
		for _, repo := range repos {
			if fmt.Sprintf("%d", repo.ID) == serviceId {
				return c.JSON(GithubRepoToCodebaseResponse(repo))
			}
		}
		return c.Status(404).JSON(fiber.Map{"error": "Repository not found"})
	case "manual":
		var org models.Organization
		if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
		}

		var service models.Codebase
		if err := h.DB.Where("object_id = ? AND organization_id = ?", serviceId, org.ID).Preload("SubjectType").Preload("APIKey").First(&service).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return c.Status(404).JSON(fiber.Map{"error": "Service not found"})
			}
			return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve service"})
		}

		// get all versions that have that service ID
		versions := []models.CodebaseVersion{}
		if err := h.DB.Where("codebase_id = ?", service.ID).Find(&versions).Error; err != nil {
			log.Errorf("Failed to retrieve versions: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve versions"})
		}
		var versionResponses []serviceVersionResponse
		for _, version := range versions {
			versionResponses = append(versionResponses, serviceVersionResponse{
				ObjectID:   version.ObjectID,
				BranchName: version.BranchName,
				CommitHash: version.CommitHash,
				Summary:    version.Summary, // Assuming CodebaseVersion has a Summary field
			})
		}

		response := CodebaseResponse{
			ObjectID:            service.ObjectID,
			CodebaseName:        service.ServiceName,
			CodebaseRepoURL:     service.ServiceRepoURL,
			CodebaseDescription: service.ServiceDescription,
			Versions:            versionResponses,
			CodebaseType:        service.SubjectType.ObjectID, // Assuming SubjectType has ObjectID field
			SourceType:          "manual",
			ApiKey:              "APIKey " + service.APIKey.Key, // Assuming APIKey has Key field
		}

		return c.JSON(response)
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid codebase type"})
	}
}

// UpdateCodebase updates a codebase by its ID
// @Summary Update a codebase by ID
// @Description Update a codebase by ID
// @Tags codebase
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param service_id path string true "Codebase ID"
// @Param codebase body CodebaseRequest true "Codebase data"
// @Success 200 {object} CodebaseResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase/{service_id} [put]
// @Security Bearer
func (h *CodebaseHandler) UpdateCodebase(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	serviceId := c.Params("service_id")

	var serviceRequest CodebaseRequest
	if err := c.BodyParser(&serviceRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var service models.Codebase
	if err := h.DB.Where("object_id = ? AND organization_id = ?", serviceId, org.ID).Preload("SubjectType").Preload("APIKey").First(&service).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Service not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve service"})
	}

	// Extract repository name from URL and use it as the service name
	repoName := utils.ExtractRepoNameFromURL(serviceRequest.CodebaseRepoURL)
	if repoName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid repository URL - could not extract repository name"})
	}

	service.ServiceName = repoName // Use extracted repo name, ignore provided name
	service.ServiceRepoURL = serviceRequest.CodebaseRepoURL
	service.ServiceDescription = serviceRequest.CodebaseDescription

	if err := h.DB.Save(&service).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update service"})
	}

	// get all versions that have that service ID
	versions := []models.CodebaseVersion{}
	if err := h.DB.Where("codebase_id = ?", service.ID).Find(&versions).Error; err != nil {
		log.Errorf("Failed to retrieve versions: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve versions"})
	}
	var versionResponses []serviceVersionResponse
	for _, version := range versions {
		versionResponses = append(versionResponses, serviceVersionResponse{
			ObjectID:   version.ObjectID,
			BranchName: version.BranchName,
			CommitHash: version.CommitHash,
			Summary:    version.Summary, // Assuming CodebaseVersion has a Summary field
		})
	}

	response := CodebaseResponse{
		ObjectID:            service.ObjectID,
		CodebaseName:        service.ServiceName,
		CodebaseRepoURL:     service.ServiceRepoURL,
		CodebaseDescription: service.ServiceDescription,
		Versions:            versionResponses,
		CodebaseType:        service.SubjectType.ObjectID,   // Assuming SubjectType has ObjectID field
		ApiKey:              "APIKey " + service.APIKey.Key, // Assuming APIKey has Key field
	}

	return c.JSON(response)
}

// DeleteCodebase deletes a codebase by its ID
// @Summary Delete a codebase by ID
// @Description Delete a codebase by ID
// @Tags codebase
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param service_id path string true "Codebase ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/codebase/{service_id} [delete]
// @Security Bearer
func (h *CodebaseHandler) DeleteCodebase(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	serviceId := c.Params("service_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var service models.Codebase
	if err := h.DB.Where("object_id = ? AND organization_id = ?", serviceId, org.ID).First(&service).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Service not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to retrieve service"})
	}

	if err := h.DB.Unscoped().Delete(&service).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete service"})
	}

	return c.JSON(fiber.Map{"message": "Service deleted successfully"})
}
