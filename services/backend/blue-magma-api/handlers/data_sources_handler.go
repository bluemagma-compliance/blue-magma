package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type DataSourcesHandler struct {
	DB *gorm.DB
}

func NewDataSourcesHandler(db *gorm.DB) *DataSourcesHandler {
	return &DataSourcesHandler{DB: db}
}

// DataSource represents a unified data source response
type DataSource struct {
	ObjectID    string `json:"object_id"`
	Type        string `json:"type"`   // "repo" | "documentation"
	Source      string `json:"source"` // "github" | "confluence" | "upload" | "bitbucket"
	Name        string `json:"name"`
	LastUpdated string `json:"last_updated"` // ISO 8601 timestamp or "N/A"
	Status      string `json:"status"`       // "active" | "inactive" | "syncing" | "N/A"
}

type DataSourcesResponse struct {
	DataSources []DataSource `json:"data_sources"`
	Total       int          `json:"total"`
}

// ConfluenceIntegrationResponse represents the response from the Confluence service
type ConfluenceIntegrationResponse struct {
	Integration *ConfluenceIntegration `json:"integration"`
	Spaces      []ConfluenceSpace      `json:"spaces"`
}

type ConfluenceIntegration struct {
	OrganizationID string     `json:"organization_id"`
	SiteURL        string     `json:"site_url"`
	CloudID        string     `json:"cloud_id"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	LastPolledAt   *time.Time `json:"last_polled_at"`
}

type ConfluenceSpace struct {
	SpaceKey     string     `json:"space_key"`
	SpaceID      string     `json:"space_id"`
	SpaceName    string     `json:"space_name"`
	SpaceType    string     `json:"space_type"`
	Description  string     `json:"description"`
	PageCount    int        `json:"page_count"`
	LastPolledAt *time.Time `json:"last_polled_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// GetDataSources aggregates all data sources for an organization
// @Summary Get all data sources
// @Description Retrieves all data sources (repos and documentation) for an organization
// @Tags data-sources
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {object} DataSourcesResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/data-sources [get]
func (h *DataSourcesHandler) GetDataSources(c *fiber.Ctx) error {
	orgID := c.Params("org_id")

	// Get organization from context (set by auth middleware)
	auth := c.Locals("auth").(*middleware.AuthContext)
	if auth == nil || auth.User == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	dataSources := []DataSource{}

	// 1. Get codebases (repos)
	var codebases []models.Codebase
	if err := h.DB.Where("organization_id = ?", org.ID).Find(&codebases).Error; err != nil {
		log.Errorf("Failed to retrieve codebases: %v", err)
	} else {
		for _, codebase := range codebases {
			// Determine source based on SourceType field
			source := "upload"
			if codebase.SourceType == "github" {
				source = "github"
			} else if codebase.SourceType == "bitbucket" {
				source = "bitbucket"
			}

			// Get the latest version to determine last updated and status
			var latestVersion models.CodebaseVersion
			lastUpdated := "N/A"
			status := "N/A"

			if err := h.DB.Where("codebase_id = ?", codebase.ID).
				Order("created_at DESC").
				First(&latestVersion).Error; err == nil {
				lastUpdated = latestVersion.UpdatedAt.Format(time.RFC3339)

				// Map ingest status to our status field
				switch latestVersion.IngestStatus {
				case "completed":
					status = "active"
				case "pending":
					status = "syncing"
				case "failed":
					status = "inactive"
				default:
					status = latestVersion.IngestStatus
				}
			}

			dataSources = append(dataSources, DataSource{
				ObjectID:    codebase.ObjectID,
				Type:        "repo",
				Source:      source,
				Name:        codebase.ServiceName,
				LastUpdated: lastUpdated,
				Status:      status,
			})
		}
	}

	// 2. Get GitHub repositories
	githubRepos := ListGithubRepositories(orgID)
	for _, repo := range githubRepos {
		dataSources = append(dataSources, DataSource{
			ObjectID:    fmt.Sprintf("github-%d", repo.ID),
			Type:        "repo",
			Source:      "github",
			Name:        repo.Name,
			LastUpdated: "N/A", // GitHub service doesn't provide last updated info yet
			Status:      "active",
		})
	}

	// 3. Get Confluence integrations by calling the Confluence service
	confluenceURL := os.Getenv("CONFLUENCE_INTEGRATION_SERVICE_URL")
	if confluenceURL != "" {
		confluenceSources, err := h.getConfluenceDataSources(orgID, confluenceURL)
		if err != nil {
			log.Warnf("Failed to retrieve Confluence data sources: %v", err)
			// Don't fail the entire request, just log the error
		} else {
			dataSources = append(dataSources, confluenceSources...)
		}
	}

	return c.JSON(DataSourcesResponse{
		DataSources: dataSources,
		Total:       len(dataSources),
	})
}

// getConfluenceDataSources fetches Confluence spaces from the Confluence service
func (h *DataSourcesHandler) getConfluenceDataSources(orgID, confluenceURL string) ([]DataSource, error) {
	// Get service token for internal API calls
	serviceToken := middleware.GetServiceToken()
	if serviceToken == "" {
		return nil, fmt.Errorf("service token not configured")
	}

	// Build the URL to call the Confluence service
	url := fmt.Sprintf("%s/integrations/confluence/%s?org_id=%s",
		strings.TrimRight(confluenceURL, "/"), orgID, orgID)

	// Create HTTP request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add internal API key for service-to-service auth
	req.Header.Set("Authorization", serviceToken)

	// Make the request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Confluence service: %w", err)
	}
	defer resp.Body.Close()

	// If no integration exists (404), return empty list
	if resp.StatusCode == http.StatusNotFound {
		return []DataSource{}, nil
	}

	// If other error, return error
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Confluence service returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse the response
	var confluenceResp ConfluenceIntegrationResponse
	if err := json.NewDecoder(resp.Body).Decode(&confluenceResp); err != nil {
		return nil, fmt.Errorf("failed to decode Confluence response: %w", err)
	}

	// Convert Confluence spaces to DataSource format
	dataSources := []DataSource{}
	for _, space := range confluenceResp.Spaces {
		lastUpdated := "N/A"
		if space.LastPolledAt != nil {
			lastUpdated = space.LastPolledAt.Format(time.RFC3339)
		} else if !space.UpdatedAt.IsZero() {
			lastUpdated = space.UpdatedAt.Format(time.RFC3339)
		}

		// Determine status based on page count and last polled
		status := "active"
		if space.PageCount == 0 {
			status = "inactive"
		}

		dataSources = append(dataSources, DataSource{
			ObjectID:    space.SpaceKey, // Use space key as object ID
			Type:        "documentation",
			Source:      "confluence",
			Name:        space.SpaceName,
			LastUpdated: lastUpdated,
			Status:      status,
		})
	}

	return dataSources, nil
}
