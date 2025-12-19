package handlers

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/proxy"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type ConfluenceIntegrationHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
}

func NewConfluenceIntegrationHandler(db *gorm.DB, redisClient *redis.Client) (*ConfluenceIntegrationHandler, error) {
	return &ConfluenceIntegrationHandler{
		DB:          db,
		RedisClient: redisClient,
	}, nil
}

// GetConfluenceIntegration retrieves the Confluence integration status for an organization
// @Summary Get Confluence integration
// @Description Retrieves the Confluence integration status for an organization
// @Tags confluence
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/integrations/confluence/{organization_id} [get]
func (h *ConfluenceIntegrationHandler) GetConfluenceIntegration(c *fiber.Ctx) error {
	orgID := c.Params("organization_id")
	confluenceURL := os.Getenv("CONFLUENCE_INTEGRATION_SERVICE_URL")

	proxyURL := fmt.Sprintf("%s/integrations/confluence/%s", strings.TrimRight(confluenceURL, "/"), orgID)

	// Add org_id as query parameter
	u, err := url.Parse(proxyURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Invalid proxy URL"})
	}
	q := u.Query()
	q.Add("org_id", orgID)
	u.RawQuery = q.Encode()
	proxyURL = u.String()

	log.Infof("Proxying GET Confluence integration request to %s", proxyURL)

	utils.AddInternalApiKey(c.Request())
	if err := proxy.Do(c, proxyURL); err != nil {
		log.Errorf("Failed to proxy GET Confluence integration request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to get Confluence integration"})
	}
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}

// DeleteConfluenceIntegration deletes the Confluence integration for an organization
// @Summary Delete Confluence integration
// @Description Deletes the Confluence integration for an organization
// @Tags confluence
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param organization_id path string true "Organization ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/integrations/confluence/{organization_id} [delete]
func (h *ConfluenceIntegrationHandler) DeleteConfluenceIntegration(c *fiber.Ctx) error {
	orgID := c.Params("organization_id")
	confluenceURL := os.Getenv("CONFLUENCE_INTEGRATION_SERVICE_URL")

	proxyURL := fmt.Sprintf("%s/integrations/confluence/%s", strings.TrimRight(confluenceURL, "/"), orgID)

	// Add org_id as query parameter
	u, err := url.Parse(proxyURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Invalid proxy URL"})
	}
	q := u.Query()
	q.Add("org_id", orgID)
	u.RawQuery = q.Encode()
	proxyURL = u.String()

	log.Infof("Proxying DELETE Confluence integration request to %s", proxyURL)

	utils.AddInternalApiKey(c.Request())
	if err := proxy.Do(c, proxyURL); err != nil {
		log.Errorf("Failed to proxy DELETE Confluence integration request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete Confluence integration"})
	}
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}

// IngestConfluenceContent ingests Confluence content for an organization
// @Summary Ingest Confluence content
// @Description Ingests Confluence content for an organization
// @Tags confluence
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param organization_id path string true "Organization ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/integrations/confluence/{organization_id}/ingest [post]
func (h *ConfluenceIntegrationHandler) IngestConfluenceContent(c *fiber.Ctx) error {
	orgID := c.Params("organization_id")
	confluenceURL := os.Getenv("CONFLUENCE_INTEGRATION_SERVICE_URL")

	proxyURL := fmt.Sprintf("%s/integrations/confluence/%s/ingest", strings.TrimRight(confluenceURL, "/"), orgID)

	// Add org_id as query parameter
	u, err := url.Parse(proxyURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Invalid proxy URL"})
	}
	q := u.Query()
	q.Add("org_id", orgID)
	u.RawQuery = q.Encode()
	proxyURL = u.String()

	log.Infof("Proxying POST Confluence ingest request to %s", proxyURL)

	utils.AddInternalApiKey(c.Request())
	if err := proxy.Do(c, proxyURL); err != nil {
		log.Errorf("Failed to proxy POST Confluence ingest request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to ingest Confluence content"})
	}
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}

// ConfluenceCallback handles Confluence OAuth callback exchange from frontend
// @Summary Exchange Atlassian OAuth code
// @Description Exchanges Atlassian OAuth authorization code for tokens (called by frontend after OAuth redirect)
// @Tags confluence
// @Accept json
// @Produce json
// @Success 200 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/integrations/confluence/callback [post]
func (h *ConfluenceIntegrationHandler) ConfluenceCallback(c *fiber.Ctx) error {
	confluenceURL := os.Getenv("CONFLUENCE_INTEGRATION_SERVICE_URL")
	proxyURL := fmt.Sprintf("%s/integrations/confluence/callback", strings.TrimRight(confluenceURL, "/"))

	log.Infof("Proxying Confluence callback request to %s", proxyURL)

	utils.AddInternalApiKey(c.Request())

	if err := proxy.Do(c, proxyURL); err != nil {
		log.Errorf("Failed to proxy Confluence callback request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to process Confluence callback"})
	}

	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}

// Proxy handles generic proxy requests to Confluence integration service
// @Summary Proxy Confluence requests
// @Description Proxies requests to Confluence integration service
// @Tags confluence
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/integrations/confluence/proxy/* [get]
func (h *ConfluenceIntegrationHandler) Proxy(c *fiber.Ctx) error {
	confluenceURL := os.Getenv("CONFLUENCE_INTEGRATION_SERVICE_URL")
	orgID := c.Params("org_id")

	// Construct the proxied URL
	proxyURL := fmt.Sprintf("%s/integrations/confluence/proxy/%s", strings.TrimRight(confluenceURL, "/"), c.Params("*"))

	// Add org_id explicitly to proxyURL
	u, err := url.Parse(proxyURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Invalid proxy URL"})
	}
	q := u.Query()
	q.Add("org_id", orgID)
	u.RawQuery = q.Encode()
	proxyURL = u.String()

	log.Infof("Proxying Confluence request to: %s", proxyURL)

	utils.AddInternalApiKey(c.Request())
	if err := proxy.Do(c, proxyURL); err != nil {
		log.Errorf("Failed to proxy Confluence request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to proxy Confluence request"})
	}
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}
