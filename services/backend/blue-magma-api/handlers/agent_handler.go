package handlers

import (
	"encoding/json"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AgentHandler struct {
	DB *gorm.DB
}

func NewAgentHandler(db *gorm.DB) *AgentHandler {
	return &AgentHandler{DB: db}
}

type AgentRequest struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	DataSources  []string `json:"data_sources"`
	Instructions string   `json:"instructions"`
	OutputFormat string   `json:"output_format"`
	Schedule     string   `json:"schedule"`
	IsActive     *bool    `json:"is_active"`
}

type AgentResponse struct {
	ObjectID     string   `json:"object_id"`
	ProjectID    string   `json:"project_id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	DataSources  []string `json:"data_sources"`
	Instructions string   `json:"instructions"`
	OutputFormat string   `json:"output_format"`
	Schedule     string   `json:"schedule"`
	IsActive     bool     `json:"is_active"`
	LastRunAt    *string  `json:"last_run_at"`
	NextRunAt    *string  `json:"next_run_at"`
	RunCount     int      `json:"run_count"`
	LastStatus   string   `json:"last_status"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
}

func buildAgentResponse(agent models.Agent, project models.Project) AgentResponse {
	// Parse data sources from JSON
	var dataSources []string
	if agent.DataSources != nil {
		json.Unmarshal(agent.DataSources, &dataSources)
	}
	if dataSources == nil {
		dataSources = []string{}
	}

	response := AgentResponse{
		ObjectID:     agent.ObjectID,
		ProjectID:    project.ObjectID,
		Name:         agent.Name,
		Description:  agent.Description,
		DataSources:  dataSources,
		Instructions: agent.Instructions,
		OutputFormat: agent.OutputFormat,
		Schedule:     agent.Schedule,
		IsActive:     agent.IsActive,
		RunCount:     agent.RunCount,
		LastStatus:   agent.LastStatus,
		CreatedAt:    agent.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:    agent.UpdatedAt.Format("2006-01-02 15:04:05"),
	}

	if agent.LastRunAt != nil {
		lastRunAt := agent.LastRunAt.Format("2006-01-02 15:04:05")
		response.LastRunAt = &lastRunAt
	}

	if agent.NextRunAt != nil {
		nextRunAt := agent.NextRunAt.Format("2006-01-02 15:04:05")
		response.NextRunAt = &nextRunAt
	}

	return response
}

// GetAgents returns all agents for a project
// @Summary Get all agents
// @Description Get all agents for a specific project
// @Tags Agent
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Success 200 {array} AgentResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/agent [get]
// @Security Bearer
func (h *AgentHandler) GetAgents(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	var agents []models.Agent
	if err := h.DB.Where("project_id = ?", project.ID).Find(&agents).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch agents"})
	}

	responses := make([]AgentResponse, len(agents))
	for i, agent := range agents {
		responses[i] = buildAgentResponse(agent, project)
	}

	return c.JSON(responses)
}

// GetAgent returns a single agent by ID
// @Summary Get agent
// @Description Get a specific agent by ID
// @Tags Agent
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param agent_id path string true "Agent ID"
// @Success 200 {object} AgentResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/agent/{agent_id} [get]
// @Security Bearer
func (h *AgentHandler) GetAgent(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	agentID := c.Params("agent_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	var agent models.Agent
	if err := h.DB.Where("object_id = ? AND project_id = ?", agentID, project.ID).First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch agent"})
	}

	return c.JSON(buildAgentResponse(agent, project))
}

// CreateAgent creates a new agent
// @Summary Create agent
// @Description Create a new agent for a project
// @Tags Agent
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param agent body AgentRequest true "Agent data"
// @Success 201 {object} AgentResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/agent [post]
// @Security Bearer
func (h *AgentHandler) CreateAgent(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")

	var req AgentRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	// Convert data sources to JSON
	dataSourcesJSON, err := json.Marshal(req.DataSources)
	if err != nil {
		log.Errorf("Failed to marshal data sources: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to process data sources"})
	}

	// Set default for IsActive if not provided
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	agent := models.Agent{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           req.Name,
		Description:    req.Description,
		DataSources:    datatypes.JSON(dataSourcesJSON),
		Instructions:   req.Instructions,
		OutputFormat:   req.OutputFormat,
		Schedule:       req.Schedule,
		IsActive:       isActive,
		RunCount:       0,
		LastStatus:     "",
	}

	if err := h.DB.Create(&agent).Error; err != nil {
		log.Errorf("Failed to create agent: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create agent"})
	}

	return c.Status(201).JSON(buildAgentResponse(agent, project))
}

// UpdateAgent updates an existing agent
// @Summary Update agent
// @Description Update an existing agent
// @Tags Agent
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param agent_id path string true "Agent ID"
// @Param agent body AgentRequest true "Agent data"
// @Success 200 {object} AgentResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/agent/{agent_id} [put]
// @Security Bearer
func (h *AgentHandler) UpdateAgent(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	agentID := c.Params("agent_id")

	var req AgentRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	var agent models.Agent
	if err := h.DB.Where("object_id = ? AND project_id = ?", agentID, project.ID).First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch agent"})
	}

	// Update fields
	if req.Name != "" {
		agent.Name = req.Name
	}
	agent.Description = req.Description
	agent.Instructions = req.Instructions
	agent.OutputFormat = req.OutputFormat
	agent.Schedule = req.Schedule

	if req.IsActive != nil {
		agent.IsActive = *req.IsActive
	}

	// Convert data sources to JSON
	if req.DataSources != nil {
		dataSourcesJSON, err := json.Marshal(req.DataSources)
		if err != nil {
			log.Errorf("Failed to marshal data sources: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to process data sources"})
		}
		agent.DataSources = datatypes.JSON(dataSourcesJSON)
	}

	if err := h.DB.Save(&agent).Error; err != nil {
		log.Errorf("Failed to update agent: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update agent"})
	}

	return c.JSON(buildAgentResponse(agent, project))
}

// DeleteAgent deletes an agent
// @Summary Delete agent
// @Description Delete an agent
// @Tags Agent
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param agent_id path string true "Agent ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id}/agent/{agent_id} [delete]
// @Security Bearer
func (h *AgentHandler) DeleteAgent(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")
	agentID := c.Params("agent_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find project"})
	}

	var agent models.Agent
	if err := h.DB.Where("object_id = ? AND project_id = ?", agentID, project.ID).First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch agent"})
	}

	if err := h.DB.Delete(&agent).Error; err != nil {
		log.Errorf("Failed to delete agent: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete agent"})
	}

	return c.SendStatus(204)
}
