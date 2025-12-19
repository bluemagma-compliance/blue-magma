package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type RPCHandler struct {
	DB          *gorm.DB
	RedisClient *redis.Client
}

func NewRPCHandler(db *gorm.DB, redisClient *redis.Client) *RPCHandler {
	return &RPCHandler{DB: db, RedisClient: redisClient}
}

type AskCodebaseVersionRequest struct {
	CodebaseVersionID string `json:"codebase_version_id"`
	Question          string `json:"question"`
}

type ReportGenerationRequest struct {
	TemplateID        string `json:"template_id"`
	OrganizationID    string `json:"organization_id"`
	CodebaseVersionID string `json:"codebase_version_id"`
	ReportName        string `json:"report_name,omitempty"`
	ReportDescription string `json:"report_description,omitempty"`
}

type ReportGenerationResponse struct {
	ReportID string                 `json:"report_id"`
	Status   string                 `json:"status"`
	Message  string                 `json:"message"`
	Progress map[string]interface{} `json:"progress"`
}

type GenerateDocsRequest struct {
	TemplateID string `json:"template_id"`
	ProjectID  string `json:"project_id"`
}

type GenerateDocsResponse struct {
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type ProgressResponse struct {
	TotalRules        int     `json:"total_rules"`
	CompletedRules    int     `json:"completed_rules"`
	TotalSections     int     `json:"total_sections"`
	CompletedSections int     `json:"completed_sections"`
	CurrentPhase      string  `json:"current_phase"`
	CompletionPercent float64 `json:"completion_percentage"`
	Status            string  `json:"status"`
}

type CacheStatsResponse struct {
	TotalProperties int                    `json:"total_properties"`
	TotalRulings    int                    `json:"total_rulings"`
	CachedSummaries int                    `json:"cached_summaries"`
	Status          string                 `json:"status"`
	Progress        map[string]interface{} `json:"progress"`
}

type CodeScanReportRequest struct {
	RepoUrl           string `json:"repo_url"`
	BranchName        string `json:"branch_name"`
	CommitHash        string `json:"commit_hash"`
	CodebaseVersionID string `json:"codebase_version_id,omitempty"`
}

type CodeScanReportResponse struct {
	CodebaseID        string `json:"codebase_id"`
	CodebaseVersionID string `json:"codebase_version_id"`
}

type GetLastHashRequest struct {
	RepoUrl    string `json:"repo_url"`
	BranchName string `json:"branch_name"`
}

type GetLastHashResponse struct {
	LastCommitHash string `json:"last_commit_hash"`
}

// RPC endpoint to get the last commit hash for a given repo and branch
// @Summary: Get last commit hash for a repo and branch
// @Description Get last commit hash for a repo and branch
// @Tags rpc
// @Accept json
// @Produce json
// @Param request body GetLastHashRequest true "Get Last Hash Request"
// @Param org_id path string true "Organization ID"
// @Success 200 {object} GetLastHashResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/get-last-commit-hash/ [post]
func (h *RPCHandler) GetLastCommitHash(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var request GetLastHashRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}
	// Validate the request
	if request.RepoUrl == "" || request.BranchName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing required fields"})
	}
	// check if the codebase exists using service_name (which contains the repo name)
	var codebase models.Codebase
	if err := h.DB.Preload("APIKey").Where("service_name = ? AND organization_id = ?", request.RepoUrl, org.ID).First(&codebase).Error; err != nil {
		// fail if the codebase doesn't exist
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Codebase not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find codebase"})
	}
	// check if the key provided matches the codebase api key
	APIKey := c.Get("Authorization")
	if APIKey != "APIKey "+codebase.APIKey.Key {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid API key"})
	}

	// find the codebase version
	var codebaseVersion models.CodebaseVersion
	objectID := codebase.ObjectID + "_" + request.BranchName
	if err := h.DB.Where("object_id = ?", objectID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Codebase version not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find codebase version"})
	}

	// return the last commit hash
	lastHashResponse := GetLastHashResponse{
		LastCommitHash: codebaseVersion.CommitHash,
	}
	return c.Status(200).JSON(lastHashResponse)
}

// RPC endpoint to initiate a code scan report, user must provide the orgID, codebase id, branch name, commit hash
// @Summary: Initiate a code scan report
// @Description Initiate a code scan report
// @Tags rpc
// @Accept json
// @Produce json
// @Param request body CodeScanReportRequest true "Code Scan Data"
// @Param org_id path string true "Organization ID"
// @Success 200 {object} CodeScanReportResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/initiate-code-scan-report/ [post]
// @Security Bearer
func (h *RPCHandler) InitiateCodeScanReport(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var reportRequest CodeScanReportRequest
	if err := c.BodyParser(&reportRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Validate the request
	if reportRequest.BranchName == "" || reportRequest.CommitHash == "" || orgId == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing required fields"})
	}

	// check if the codebase exists using service_name (which contains the repo name)
	var codebase models.Codebase
	if err := h.DB.Preload("APIKey").Where("service_name = ? AND organization_id = ?", reportRequest.RepoUrl, org.ID).First(&codebase).Error; err != nil {
		// fail if the codebase doesn't exist
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Codebase not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find codebase"})
	}

	// check if th ekey provided matches the codebase api key
	APIKey := c.Get("Authorization")
	if APIKey != "APIKey "+codebase.APIKey.Key {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid API key"})
	}

	// check if the codebase version exists
	var codebaseVersion models.CodebaseVersion
	objectID := codebase.ObjectID + "_" + reportRequest.BranchName
	if err := h.DB.Where("object_id = ?", objectID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// create a new codebase version if it doesn't exist

			codebaseVersion = models.CodebaseVersion{
				ObjectID:       objectID,
				OrganizationID: org.ID,
				BranchName:     reportRequest.BranchName,
				CommitHash:     reportRequest.CommitHash,
				CodebaseID:     codebase.ID,
				IngestStatus:   "pending",
			}
			if err := h.DB.Create(&codebaseVersion).Error; err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create codebase version"})
			}
		} else {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to find codebase version"})
		}
	}

	// update the commit hash
	if codebaseVersion.CommitHash != reportRequest.CommitHash {
		codebaseVersion.CommitHash = reportRequest.CommitHash
		if err := h.DB.Save(&codebaseVersion).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update codebase version"})
		}
	}

	reportResponse := CodeScanReportResponse{
		CodebaseID:        codebase.ObjectID,
		CodebaseVersionID: codebaseVersion.ObjectID,
	}
	return c.Status(200).JSON(reportResponse)
}

// Generate a comprehensive report using the new comprehensive report generation API
// @Summary: Create a comprehensive report from a template
// @Description Create a comprehensive report from a template using intelligent caching and evidence sharing
// @Tags rpc
// @Accept json
// @Produce json
// @Param request body ReportGenerationRequest true "Report Generation Request"
// @Param org_id path string true "Organization ID"
// @Success 202 {object} ReportGenerationResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/generate-report/ [post]
// @Security Bearer
func (h *RPCHandler) GenerateReport(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var reportRequest ReportGenerationRequest
	if err := c.BodyParser(&reportRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Validate required fields
	if reportRequest.CodebaseVersionID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "codebase_version_id is required"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Validate template exists
	var template models.ReportTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", reportRequest.TemplateID, org.ID).First(&template).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Report template not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find report template"})
	}

	// Validate codebase version exists and belongs to organization
	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Joins("JOIN codebases ON codebase_versions.codebase_id = codebases.id").
		Where("codebase_versions.object_id = ? AND codebases.organization_id = ?",
			reportRequest.CodebaseVersionID, org.ID).
		First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Codebase version not found or not accessible"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to validate codebase version"})
	}

	// Prepare the comprehensive report generation request
	comprehensiveRequest := map[string]interface{}{
		"template_id":         reportRequest.TemplateID,
		"organization_id":     org.ObjectID,
		"codebase_version_id": reportRequest.CodebaseVersionID,
	}

	// Add optional fields if provided
	if reportRequest.ReportName != "" {
		comprehensiveRequest["report_name"] = reportRequest.ReportName
	}
	if reportRequest.ReportDescription != "" {
		comprehensiveRequest["report_description"] = reportRequest.ReportDescription
	}

	// Convert to JSON
	requestBody, err := json.Marshal(comprehensiveRequest)
	if err != nil {
		log.Printf("Failed to marshal comprehensive request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to prepare request"})
	}

	// Call the comprehensive report generation API
	resp, err := http.Post("http://the-council:8000/generate-comprehensive-report", "application/json", bytes.NewBuffer(requestBody))
	if err != nil {
		log.Printf("Failed to call comprehensive report API: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to initiate report generation"})
	}
	defer resp.Body.Close()

	// Read the response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read comprehensive API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read response"})
	}

	// Handle non-success status codes
	if resp.StatusCode != http.StatusAccepted {
		log.Printf("Comprehensive API returned status %d: %s", resp.StatusCode, string(responseBody))
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "Report generation failed", "details": string(responseBody)})
	}

	// Parse the response
	var comprehensiveResponse ReportGenerationResponse
	if err := json.Unmarshal(responseBody, &comprehensiveResponse); err != nil {
		log.Printf("Failed to parse comprehensive API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse response"})
	}

	log.Printf("Comprehensive report generation initiated for report ID: %s", comprehensiveResponse.ReportID)

	return c.Status(fiber.StatusAccepted).JSON(comprehensiveResponse)
}

// Get report generation progress
// @Summary: Get report generation progress
// @Description Monitor the real-time progress of report generation
// @Tags rpc
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report ID"
// @Success 200 {object} ProgressResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/report-progress/{report_id} [get]
// @Security Bearer
func (h *RPCHandler) GetReportProgress(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	reportId := c.Params("report_id")

	if orgId == "" || reportId == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Organization ID and Report ID are required"})
	}

	// Verify organization exists
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Call the progress API
	url := fmt.Sprintf("http://the-council:8000/report-progress/%s", reportId)
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("Failed to call progress API: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get progress"})
	}
	defer resp.Body.Close()

	// Read the response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read progress API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read response"})
	}

	// Handle non-success status codes
	if resp.StatusCode != http.StatusOK {
		log.Printf("Progress API returned status %d: %s", resp.StatusCode, string(responseBody))
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "Failed to get progress", "details": string(responseBody)})
	}

	// Parse and return the response
	var progressResponse ProgressResponse
	if err := json.Unmarshal(responseBody, &progressResponse); err != nil {
		log.Printf("Failed to parse progress API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse response"})
	}

	return c.Status(200).JSON(progressResponse)
}

// Get cache statistics for a report
// @Summary: Get cache statistics for a report
// @Description View caching performance and statistics for a report
// @Tags rpc
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report ID"
// @Success 200 {object} CacheStatsResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/cache-stats/{report_id} [get]
// @Security Bearer
func (h *RPCHandler) GetCacheStats(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	reportId := c.Params("report_id")

	if orgId == "" || reportId == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Organization ID and Report ID are required"})
	}

	// Verify organization exists
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Call the cache stats API
	url := fmt.Sprintf("http://the-council:8000/cache-stats/%s", reportId)
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("Failed to call cache stats API: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get cache stats"})
	}
	defer resp.Body.Close()

	// Read the response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read cache stats API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read response"})
	}

	// Handle non-success status codes
	if resp.StatusCode != http.StatusOK {
		log.Printf("Cache stats API returned status %d: %s", resp.StatusCode, string(responseBody))
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "Failed to get cache stats", "details": string(responseBody)})
	}

	// Parse and return the response
	var cacheStatsResponse CacheStatsResponse
	if err := json.Unmarshal(responseBody, &cacheStatsResponse); err != nil {
		log.Printf("Failed to parse cache stats API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse response"})
	}

	return c.Status(200).JSON(cacheStatsResponse)
}

// Cancel report generation
// @Summary: Cancel report generation
// @Description Cancel an active report generation process
// @Tags rpc
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param report_id path string true "Report ID"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/cancel-report/{report_id} [post]
// @Security Bearer
func (h *RPCHandler) CancelReport(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	reportId := c.Params("report_id")

	if orgId == "" || reportId == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Organization ID and Report ID are required"})
	}

	// Verify organization exists
	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Call the cancel report API
	url := fmt.Sprintf("http://the-council:8000/cancel-report/%s", reportId)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		log.Printf("Failed to create cancel request: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create cancel request"})
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to call cancel report API: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to cancel report"})
	}
	defer resp.Body.Close()

	// Read the response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read cancel API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read response"})
	}

	// Handle non-success status codes
	if resp.StatusCode != http.StatusOK {
		log.Printf("Cancel API returned status %d: %s", resp.StatusCode, string(responseBody))
		return c.Status(resp.StatusCode).JSON(fiber.Map{"error": "Failed to cancel report", "details": string(responseBody)})
	}

	// Parse and return the response
	var cancelResponse map[string]interface{}
	if err := json.Unmarshal(responseBody, &cancelResponse); err != nil {
		log.Printf("Failed to parse cancel API response: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to parse response"})
	}

	return c.Status(200).JSON(cancelResponse)
}

// Generate documentation from a documentation template for a project (placeholder)
// @Summary: Initiate docs generation from a documentation template
// @Description Placeholder RPC to initiate docs generation; validates org, project, and template, then returns a job id
// @Tags rpc
// @Accept json
// @Produce json
// @Param request body GenerateDocsRequest true "Generate Docs Request"
// @Param org_id path string true "Organization ID"
// @Success 202 {object} GenerateDocsResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/generate-docs/ [post]
// @Security Bearer
func (h *RPCHandler) GenerateDocs(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var req GenerateDocsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.TemplateID == "" || req.ProjectID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "template_id and project_id are required"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// Validate project belongs to org
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", req.ProjectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	// Validate documentation template belongs to org and project
	var tmpl models.DocumentationTemplate
	if err := h.DB.Where("object_id = ? AND organization_id = ?", req.TemplateID, org.ID).First(&tmpl).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Documentation template not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find documentation template"})
	}
	if tmpl.ProjectID != project.ID {
		return c.Status(400).JSON(fiber.Map{"error": "Template does not belong to the specified project"})
	}

	// Placeholder: enqueue/trigger generation here later. For now, return a job id
	jobID, _ := crypto.GenerateUUID()
	resp := GenerateDocsResponse{JobID: jobID, Status: "accepted", Message: "Docs generation initiated"}
	return c.Status(fiber.StatusAccepted).JSON(resp)
}

// endpoint to receive a question, a codebaseVersion and use the seeker agent to ask the question
// @Summary: Ask a question to the seeker agent
// @Description Ask a question to the seeker agent
// @Tags rpc
// @Accept json
// @Produce json
// @Param request body AskCodebaseVersionRequest true "Ask Codebase Version Request"
// @Param org_id path string true "Organization ID"
// @Success 200 {object} SeekResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/ask-seeker-agent/ [post]
// @Security Bearer
func (h *RPCHandler) AskSeekerAgent(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var request AskCodebaseVersionRequest
	if err := c.BodyParser(&request); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var codebaseVersion models.CodebaseVersion
	if err := h.DB.Where("object_id = ? AND organization_id = ?", request.CodebaseVersionID, org.ID).First(&codebaseVersion).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Codebase version not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find codebase version"})
	}

	// Notify the seeker agent with the evidence
	response, err := SendSeekRequest("question must be answered", request.Question, request.CodebaseVersionID, orgId)
	if err != nil {
		log.Errorf("Failed to send request to seeker agent: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send request to seeker agent"})
	}

	return c.Status(200).JSON(response)
}

type InitChatResponse struct {
	ChatMemory string `json:"chat_memory"` // JSON string for storing chat history
}

// Initialize a chat session for the user
// @Summary: Initialize a chat session
// @Description Initialize a chat session for the user
// @Tags rpc
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param user_id path string true "User ID"
// @Success 200 {object} InitChatResponse
// @Failure 400 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/rpc/initialize-chat/{user_id} [get]
// @Security Bearer
func (h *RPCHandler) InitializeChat(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	userId := c.Params("user_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	log.Infof("Initializing chat for user %s in organization %s", userId, orgId)

	var user models.User
	if err := h.DB.Where("object_id = ? AND organization_id = ?", userId, org.ID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find user"})
	}

	response := InitChatResponse{
		ChatMemory: user.ChatMemory,
	}

	return c.Status(200).JSON(response)
}

type SeekPayload struct {
	Criteria          string `json:"criteria"`
	Questions         string `json:"questions"`
	CodebaseVersionID string `json:"codebase_version_id"`
	OrgID             string `json:"org_id"`
}

type SeekProperty struct {
	Property string `json:"property"`
	Path     string `json:"path"`
	Name     string `json:"name"`
	Type     string `json:"type"`
}

type SeekResponse struct {
	Summary string         `json:"summary"`
	Props   []SeekProperty `json:"props"`
}

func SendSeekRequest(criteria, questions, codebaseVersionID, orgID string) (*SeekResponse, error) {
	payload := SeekPayload{
		Criteria:          criteria,
		Questions:         questions,
		CodebaseVersionID: codebaseVersionID,
		OrgID:             orgID,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON: %w", err)
	}

	resp, err := http.Post("http://seeker-agent:8000/seek", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %s\nbody: %s", resp.Status, bodyBytes)
	}

	var parsed SeekResponse
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w\nbody: %s", err, bodyBytes)
	}

	return &parsed, nil
}
