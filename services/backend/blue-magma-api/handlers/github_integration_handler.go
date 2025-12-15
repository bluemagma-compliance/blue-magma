package handlers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/bluemagma-compliance/blue-magma-api/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/proxy"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type GitHubIntegrationHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
	GitHubSvc   *services.GitHubService
}

func NewGitHubIntegrationHandler(db *gorm.DB, redisClient *redis.Client) (*GitHubIntegrationHandler, error) {
	githubSvc, err := services.NewGitHubService()
	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub service: %w", err)
	}

	return &GitHubIntegrationHandler{
		DB:          db,
		RedisClient: redisClient,
		GitHubSvc:   githubSvc,
	}, nil
}

type InstallSessionRequest struct {
	ReturnURL string `json:"return_url"`
}

// StartInstallation creates a new installation session
// @Summary Start GitHub App installation
// @Description Creates a session for GitHub App installation
// @Tags github
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param request body InstallSessionRequest true "Installation request"
// @Success 200 {object} InstallSessionResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/integrations/github/install/session [post]
func (h *GitHubIntegrationHandler) StartInstallation(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	var req InstallSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	ms_url := os.Getenv("GITHUB_INTEGRATION_URL")
	proxyUrl := fmt.Sprintf("%s/api/v1/orgs/%s/installations", strings.TrimRight(ms_url, "/"), orgID)
	log.Info("Proxying installation request to ", proxyUrl)
	utils.AddInternalApiKey(c.Request())
	if err := proxy.Do(c, proxyUrl); err != nil {
		log.Errorf("Failed to proxy installation request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to start installation"})
	}
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}

// CompleteInstallation handles the GitHub App installation callback
// @Summary Complete GitHub App installation
// @Description Handles the callback from GitHub after app installation
// @Tags github
// @Accept json
// @Produce json
// @Param installation_id query int true "Installation ID"
// @Param state query string true "State parameter"
// @Param setup_action query string false "Setup action"
// @Success 302 "Redirect to frontend"
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/integrations/github/setup [get]
func (h *GitHubIntegrationHandler) CompleteInstallation(c *fiber.Ctx) error {
	installationIDStr := c.Query("installation_id")
	state := c.Query("state")
	ms_url := os.Getenv("GITHUB_INTEGRATION_URL")
	installationID, err := strconv.ParseInt(installationIDStr, 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid installation_id"})
	}
	log.Printf("Completing installation for ID: %d, state: %s", installationID, state)
	proxyUrl := fmt.Sprintf("%s/api/v1/installations/%d/complete?state=%s",
		strings.TrimRight(ms_url, "/"), installationID, state)
	utils.AddInternalApiKey(c.Request())
	if err := proxy.Do(c, proxyUrl); err != nil {
		log.Errorf("Failed to proxy complete installation request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to complete installation"})
	}
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}

func (h *GitHubIntegrationHandler) Proxy(c *fiber.Ctx) error {
	ms_url := os.Getenv("GITHUB_INTEGRATION_URL")
	orgID := c.Params("org_id")

	// Construct the proxied URL
	proxyURL := fmt.Sprintf("%s/api/v1/proxied/%s", strings.TrimRight(ms_url, "/"), c.Params("*"))

	// Add org_id explicitly to proxyURL
	u, err := url.Parse(proxyURL)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Invalid proxy URL"})
	}
	q := u.Query()
	q.Add("org_id", orgID)
	u.RawQuery = q.Encode()
	proxyURL = u.String()

	fmt.Printf("Proxying request to: %s\n", proxyURL)

	utils.AddInternalApiKey(c.Request())
	if err := proxy.Do(c, proxyURL); err != nil {
		log.Errorf("Failed to proxy request: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to proxy request"})
	}
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}

type Repository struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

func ListGithubRepositories(orgId string) (repos []Repository) {
	ms_url := os.Getenv("GITHUB_INTEGRATION_URL")
	requestUrl := fmt.Sprintf("%s/api/v1/orgs/%s/repositories", strings.TrimRight(ms_url, "/"), orgId)
	data, err := utils.FetchInternal(requestUrl)
	if err != nil {
		log.Errorf("Failed to fetch repositories for org_id %s: %v", orgId, err)
		return
	}

	err = json.Unmarshal(data, &repos)
	if err != nil {
		log.Errorf("Failed to parse repositories for org_id %s: %v", orgId, err)
		return
	}

	log.Infof("Successfully fetched repositories for org_id %s: %s", orgId, string(data))
	return repos
}
