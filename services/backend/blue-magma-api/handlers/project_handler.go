package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ProjectHandler struct {
	DB *gorm.DB
}

func NewProjectHandler(db *gorm.DB) *ProjectHandler {
	return &ProjectHandler{DB: db}
}

type ProjectRequest struct {
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	Status          string  `json:"status"`
	ComplianceScore float64 `json:"compliance_score"`
	TemplateID      string  `json:"template_id"` // Optional: ID of project template to instantiate from
}

type ProjectResponse struct {
	ObjectID        string  `json:"object_id"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	Status          string  `json:"status"`
	ComplianceScore float64 `json:"compliance_score"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

func BuildProjectResponse(project models.Project) ProjectResponse {
	return ProjectResponse{
		ObjectID:        project.ObjectID,
		Name:            project.Name,
		Description:     project.Description,
		Status:          project.Status,
		ComplianceScore: project.ComplianceScore,
		CreatedAt:       project.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:       project.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

// SCFConfigV1 represents the config document used to bootstrap a project from SCF
// data. Description is optional; if omitted, the backend derives a description
// from the selected filters (coverage/core), timeline, and priority flags.
type SCFConfigV1 struct {
	Version              string             `json:"version"`
	GeneratedAt          string             `json:"generated_at"`
	Source               string             `json:"source"`
	ProjectName          string             `json:"project_name"`
	OrganizationID       string             `json:"organization_id"`
	Description          string             `json:"description"`
	Controls             []SCFConfigControl `json:"controls"`
	Timeline             SCFConfigTimeline  `json:"timeline"`
	AssessmentObjectives SCFConfigAOSection `json:"assessment_objectives"`
	EvidenceRequests     SCFConfigERSection `json:"evidence_requests"`
}

type SCFConfigControl struct {
	ObjectID               string          `json:"object_id"`
	Title                  string          `json:"title"`
	Domain                 string          `json:"domain"`
	Cadence                string          `json:"cadence"`
	Weight                 float64         `json:"weight"`
	Coverage               map[string]bool `json:"coverage"`
	Core                   map[string]bool `json:"core"`
	Selected               bool            `json:"selected"`
	Priority               bool            `json:"priority"`
	ControlDescription     string          `json:"control_description"`
	RiskIDs                []string        `json:"risk_ids"`
	ThreatIDs              []string        `json:"threat_ids"`
	AssessmentObjectiveIDs []string        `json:"assessment_objective_ids"`
	EvidenceRequestIDs     []string        `json:"evidence_request_ids"`
}

type SCFConfigTimelineWindow struct {
	Goal       string `json:"goal"`
	StartMonth int    `json:"start_month"`
	EndMonth   int    `json:"end_month"`
}

type SCFConfigTimeline struct {
	Windows             []SCFConfigTimelineWindow `json:"windows"`
	MaxMonths           int                       `json:"max_months"`
	TotalUniqueControls int                       `json:"total_unique_controls"`
}

type SCFConfigAOItem struct {
	ObjectID        string `json:"object_id"`
	ControlMappings string `json:"control_mappings"`
	Statement       string `json:"statement"`
	Origin          string `json:"origin"`
	IsSCFBaseline   bool   `json:"is_scf_baseline"`
}

type SCFConfigAOSection struct {
	Items          []SCFConfigAOItem   `json:"items"`
	ControlsByAOID map[string][]string `json:"controls_by_ao_id"`
}

type SCFConfigERItem struct {
	ObjectID    string `json:"object_id"`
	AreaOfFocus string `json:"area_of_focus"`
	Artifact    string `json:"artifact"`
	Description string `json:"description"`
}

type SCFConfigERSection struct {
	Items                []SCFConfigERItem   `json:"items"`
	ControlsByEvidenceID map[string][]string `json:"controls_by_evidence_id"`
}

// scfCoverageKeys returns a sorted slice of framework keys where the coverage
// map value is true. This is used to persist the set of frameworks covered by
// a control onto the control document itself.
func scfCoverageKeys(m map[string]bool) []string {
	if len(m) == 0 {
		return []string{}
	}
	keys := make([]string, 0, len(m))
	for k, v := range m {
		if v {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	return keys
}

// GetProjects returns all projects for an organization
// @Summary Get all projects
// @Description Get all projects for a specific organization
// @Tags Project
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {array} ProjectResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project [get]
// @Security Bearer
func (h *ProjectHandler) GetProjects(c *fiber.Ctx) error {
	orgID := c.Params("org_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var projects []models.Project
	if err := h.DB.Where("organization_id = ?", org.ID).Find(&projects).Error; err != nil {
		log.Errorf("Failed to get projects: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get projects"})
	}

	// Initialize response as empty array to avoid returning null when no projects exist
	response := make([]ProjectResponse, 0)
	for _, project := range projects {
		response = append(response, BuildProjectResponse(project))
	}

	return c.JSON(response)
}

// GetProject returns a single project by ID
// @Summary Get a project
// @Description Get a specific project by ID
// @Tags Project
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Success 200 {object} ProjectResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id} [get]
// @Security Bearer
func (h *ProjectHandler) GetProject(c *fiber.Ctx) error {
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
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	return c.JSON(BuildProjectResponse(project))
}

// CreateProject creates a new project
// @Summary Create a new project
// @Description Create a new project for a specific organization
// @Tags Project
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project body ProjectRequest true "Project data"
// @Success 201 {object} ProjectResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project [post]
// @Security Bearer
func (h *ProjectHandler) CreateProject(c *fiber.Ctx) error {
	orgID := c.Params("org_id")

	var projectRequest ProjectRequest
	if err := c.BodyParser(&projectRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Validate required fields
	if projectRequest.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Set default status if not provided
	status := projectRequest.Status
	if status == "" {
		status = "on-hold"
	}

	project := models.Project{
		ObjectID:        objectID,
		OrganizationID:  org.ID,
		Name:            projectRequest.Name,
		Description:     projectRequest.Description,
		Status:          status,
		ComplianceScore: projectRequest.ComplianceScore,
	}

	// Start transaction for atomic creation
	tx := h.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Create(&project).Error; err != nil {
		tx.Rollback()
		log.Errorf("Failed to create project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create project"})
	}

	// If template_id is provided, instantiate from template
	var docTemplateResponse *fiber.Map
	var policyTemplatesResponse []fiber.Map

	if projectRequest.TemplateID != "" {
		// Fetch project template
		var projectTemplate models.ProjectTemplate
		if err := tx.Where("object_id = ? AND organization_id = ? AND is_active = ?", projectRequest.TemplateID, 1, true).First(&projectTemplate).Error; err != nil {
			tx.Rollback()
			if err == gorm.ErrRecordNotFound {
				return c.Status(404).JSON(fiber.Map{"error": "Project template not found"})
			}
			log.Errorf("Failed to fetch project template: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch project template"})
		}

		// Parse template data
		var templateData struct {
			DocumentationTemplate *struct {
				Pages []DocumentPage `json:"pages"`
			} `json:"documentation_template"`
			PolicyTemplates []struct {
				Title       string `json:"title"`
				Description string `json:"description"`
				Content     string `json:"content"`
				Category    string `json:"category"`
			} `json:"policy_templates"`
			Auditors []struct {
				Name         string          `json:"name"`
				Description  string          `json:"description"`
				Schedule     string          `json:"schedule"`
				IsActive     bool            `json:"is_active"`
				Instructions json.RawMessage `json:"instructions"`
			} `json:"auditors"`
		}

		if err := json.Unmarshal(projectTemplate.TemplateData, &templateData); err != nil {
			tx.Rollback()
			log.Errorf("Failed to parse template data: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to parse template data"})
		}

		// Create documentation template if provided
		if templateData.DocumentationTemplate != nil {
			// Wrap pages in the expected structure
			pagesPayload := struct {
				Pages []DocumentPage `json:"pages"`
			}{
				Pages: templateData.DocumentationTemplate.Pages,
			}

			pagesJSON, err := json.Marshal(pagesPayload)
			if err != nil {
				tx.Rollback()
				log.Errorf("Failed to marshal documentation pages: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation template"})
			}

			docTemplateObjectID, err := crypto.GenerateUUID()
			if err != nil {
				tx.Rollback()
				log.Errorf("Failed to generate UUID for documentation template: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
			}

			docTemplate := models.DocumentationTemplate{
				ObjectID:       docTemplateObjectID,
				OrganizationID: org.ID,
				ProjectID:      project.ID,
				Template:       datatypes.JSON(pagesJSON),
			}

			if err := tx.Create(&docTemplate).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create documentation template: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation template"})
			}

			docTemplateResponse = &fiber.Map{
				"object_id":  docTemplate.ObjectID,
				"project_id": project.ObjectID,
			}
		}

		// Create policy templates if provided
		if len(templateData.PolicyTemplates) > 0 {
			for _, policyData := range templateData.PolicyTemplates {
				policyObjectID, err := crypto.GenerateUUID()
				if err != nil {
					tx.Rollback()
					log.Errorf("Failed to generate UUID for policy template: %v", err)
					return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
				}

				policyTemplate := models.PolicyTemplate{
					ObjectID:       policyObjectID,
					OrganizationID: org.ID,
					ProjectID:      project.ID,
					Title:          policyData.Title,
					Description:    policyData.Description,
					Content:        policyData.Content,
					Category:       policyData.Category,
				}

				if err := tx.Create(&policyTemplate).Error; err != nil {
					tx.Rollback()
					log.Errorf("Failed to create policy template: %v", err)
					return c.Status(500).JSON(fiber.Map{"error": "Failed to create policy template"})
				}

				policyTemplatesResponse = append(policyTemplatesResponse, fiber.Map{
					"object_id": policyTemplate.ObjectID,
					"title":     policyTemplate.Title,
					"category":  policyTemplate.Category,
				})
			}
		}

		// Create auditors if provided
		if len(templateData.Auditors) > 0 {
			for _, auditorData := range templateData.Auditors {
				auditorObjectID, err := crypto.GenerateUUID()
				if err != nil {
					tx.Rollback()
					log.Errorf("Failed to generate UUID for auditor: %v", err)
					return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
				}

				auditor := models.Auditor{
					ObjectID:       auditorObjectID,
					OrganizationID: org.ID,
					ProjectID:      project.ID,
					Name:           auditorData.Name,
					Description:    auditorData.Description,
					Schedule:       auditorData.Schedule,
					IsActive:       auditorData.IsActive,
					Instructions:   datatypes.JSON(auditorData.Instructions),
				}

				if err := tx.Create(&auditor).Error; err != nil {
					tx.Rollback()
					log.Errorf("Failed to create auditor: %v", err)
					return c.Status(500).JSON(fiber.Map{"error": "Failed to create auditor"})
				}

				log.Infof("Created auditor '%s' for project '%s'", auditor.Name, project.Name)
			}
		}

		// If this is a SOC2 template, set project to active and create default documentation
		if projectTemplate.ObjectID == "template-soc2-001" {
			// Update project status to active
			project.Status = "active"
			if err := tx.Save(&project).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to update project status: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to update project status"})
			}

			// Create default SOC2 documentation
			if err := h.createDefaultSOC2Documentation(tx, org.ID, project.ID); err != nil {
				tx.Rollback()
				log.Errorf("Failed to create default SOC2 documentation: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create default documentation"})
			}

			log.Infof("Created default SOC2 documentation for project '%s'", project.Name)
		}
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		log.Errorf("Failed to commit transaction: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create project"})
	}

	// Build response
	response := fiber.Map{
		"project": BuildProjectResponse(project),
	}

	if docTemplateResponse != nil {
		response["documentation_template"] = docTemplateResponse
	}

	if len(policyTemplatesResponse) > 0 {
		response["policy_templates"] = policyTemplatesResponse
	}

	return c.Status(201).JSON(response)
}

// CreateProjectFromSCFConfig creates a new project and scaffolds documentation, evidence requests,
// and auditors from an SCF configuration document. This endpoint is intended to be scoped to
// organization admins via routing middleware.
// @Summary Create a new project from SCF config
// @Description Create a new project for a specific organization using an SCF configuration document
// @Tags Project
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param config body SCFConfigV1 true "SCF configuration document"
// @Success 201 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/from-scf-config [post]
// @Security Bearer
func (h *ProjectHandler) CreateProjectFromSCFConfig(c *fiber.Ctx) error {
	orgObjectID := c.Params("org_id")

	var cfg SCFConfigV1
	if err := c.BodyParser(&cfg); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if cfg.Version != "scf_config.v1" {
		return c.Status(400).JSON(fiber.Map{"error": "Unsupported config version"})
	}
	if strings.TrimSpace(cfg.ProjectName) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "project_name is required"})
	}
	if len(cfg.Controls) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "controls are required"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgObjectID).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Organization not found"})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// If organization_id is provided in the config, ensure it matches the path organization
	if cfg.OrganizationID != "" && cfg.OrganizationID != org.ObjectID {
		return c.Status(400).JSON(fiber.Map{"error": "organization_id in config does not match path"})
	}

	// Filter to selected controls only
	selectedControls := make([]SCFConfigControl, 0, len(cfg.Controls))
	for _, ctrl := range cfg.Controls {
		if ctrl.Selected {
			selectedControls = append(selectedControls, ctrl)
		}
	}
	if len(selectedControls) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No selected controls in config"})
	}

	projectObjectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID for project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Prefer an explicit description from the config; if none is provided,
	// derive a human-friendly summary from the selected filters (coverage/core),
	// timeline, and priority flags instead of the raw SCF config metadata that
	// was previously used here.
	description := strings.TrimSpace(cfg.Description)
	if description == "" {
		description = buildSCFProjectDescription(cfg, selectedControls)
	}

	project := models.Project{
		ObjectID:        projectObjectID,
		OrganizationID:  org.ID,
		Name:            cfg.ProjectName,
		Description:     description,
		Status:          "active",
		ComplianceScore: 0,
	}

	// Precompute AO and evidence request lookups
	aoByID := make(map[string]SCFConfigAOItem, len(cfg.AssessmentObjectives.Items))
	for _, ao := range cfg.AssessmentObjectives.Items {
		if ao.ObjectID == "" {
			continue
		}
		aoByID[ao.ObjectID] = ao
	}

	erByID := make(map[string]SCFConfigERItem, len(cfg.EvidenceRequests.Items))
	for _, er := range cfg.EvidenceRequests.Items {
		if er.ObjectID == "" {
			continue
		}
		erByID[er.ObjectID] = er
	}

	// Map control -> evidence IDs (SCF IDs) for later auditor context
	controlEvidenceIDs := make(map[string][]string, len(selectedControls))
	domainControls := make(map[string][]SCFConfigControl)
	var domainNames []string
	for _, ctrl := range selectedControls {
		domain := strings.TrimSpace(ctrl.Domain)
		if domain == "" {
			domain = "Uncategorized"
		}
		if _, ok := domainControls[domain]; !ok {
			domainNames = append(domainNames, domain)
		}
		domainControls[domain] = append(domainControls[domain], ctrl)
		if len(ctrl.EvidenceRequestIDs) > 0 {
			controlEvidenceIDs[ctrl.ObjectID] = append(controlEvidenceIDs[ctrl.ObjectID], ctrl.EvidenceRequestIDs...)
		}
	}
	sort.Strings(domainNames)

	// Start transaction for atomic creation
	tx := h.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Create(&project).Error; err != nil {
		tx.Rollback()
		log.Errorf("Failed to create project from SCF config: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create project"})
	}

	// Build document hierarchy as the source of truth: Controls Overview -> Domain -> Control
	// NOTE: We still persist a DocumentationTemplate for backwards compatibility, but
	// frontends should rely on the /document/tree and /document/:id/full endpoints
	// which are driven entirely by the Document model and its ParentID/Order fields.

	// Root "Controls Overview" document
	rootDocObjectID, err := crypto.GenerateUUID()
	if err != nil {
		tx.Rollback()
		log.Errorf("Failed to generate UUID for root document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	rootMarkdown := buildSCFOverviewContent(cfg, selectedControls)
	rootDocument := models.Document{
		ObjectID:       rootDocObjectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		TemplatePageID: "controls-overview",
		Title:          "Controls Overview",
		Content:        rootMarkdown,
		Status:         "draft",
		Version:        1,
		Order:          0,
	}

	if err := tx.Create(&rootDocument).Error; err != nil {
		tx.Rollback()
		log.Errorf("Failed to create root documentation from SCF config: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation"})
	}

	// Legacy documentation template root (kept for backward compatibility; do not use on frontend)
	rootPage := DocumentPage{
		ID:      "controls-overview",
		Title:   "Controls Overview",
		Content: rootMarkdown,
		Order:   0,
	}

	// Map control object_id -> created document for later evidence request, auditor,
	// and relation mapping.
	controlDocuments := make(map[string]models.Document, len(selectedControls))

	// Maps from risk/threat ObjectID -> created risk/threat document so we can
	// later create relations between controls and risks/threats.
	riskDocuments := make(map[string]models.Document)
	threatDocuments := make(map[string]models.Document)

	// Count all documents created for stats (root + domains + controls + risks + threats)
	documentsCount := 1
	pageOrder := 1
	for _, domain := range domainNames {
		domainSlug := slugify(domain)

		// Create domain document under the root
		domainDocObjectID, err := crypto.GenerateUUID()
		if err != nil {
			tx.Rollback()
			log.Errorf("Failed to generate UUID for domain document: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
		}

		parentID := rootDocument.ID
		domainDocument := models.Document{
			ObjectID:       domainDocObjectID,
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			TemplatePageID: fmt.Sprintf("domain-%s", domainSlug),
			Title:          domain,
			Content:        fmt.Sprintf("Controls in the %s domain.", domain),
			ParentID:       &parentID,
			Status:         "draft",
			Version:        1,
			Order:          pageOrder,
		}

		if err := tx.Create(&domainDocument).Error; err != nil {
			tx.Rollback()
			log.Errorf("Failed to create domain documentation from SCF config: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation"})
		}
		documentsCount++

		// Legacy documentation template domain node (for backwards compatibility)
		domainPage := DocumentPage{
			ID:      fmt.Sprintf("domain-%s", domainSlug),
			Title:   domain,
			Content: fmt.Sprintf("Controls in the %s domain.", domain),
			Order:   pageOrder,
		}
		pageOrder++

		controls := domainControls[domain]
		// Deterministic ordering within a domain
		sort.Slice(controls, func(i, j int) bool {
			return controls[i].ObjectID < controls[j].ObjectID
		})

		controlOrder := 1
		for _, ctrl := range controls {
			// Collect AO and evidence request details for markdown generation
			var aosForControl []SCFConfigAOItem
			for _, aoID := range ctrl.AssessmentObjectiveIDs {
				if ao, ok := aoByID[aoID]; ok {
					aosForControl = append(aosForControl, ao)
				}
			}

			var ersForControl []SCFConfigERItem
			for _, evID := range ctrl.EvidenceRequestIDs {
				if er, ok := erByID[evID]; ok {
					ersForControl = append(ersForControl, er)
				}
			}

			controlPageID := fmt.Sprintf("control-%s", ctrl.ObjectID)
			controlTitle := fmt.Sprintf("%s - %s", ctrl.ObjectID, ctrl.Title)
			controlPage := DocumentPage{
				ID:      controlPageID,
				Title:   controlTitle,
				Content: "",
				Order:   controlOrder,
			}
			domainPage.Children = append(domainPage.Children, controlPage)

			// Create document instance for this control under the domain document
			docObjectID, err := crypto.GenerateUUID()
			if err != nil {
				tx.Rollback()
				log.Errorf("Failed to generate UUID for document: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
			}

			markdown := buildSCFControlMarkdown(cfg, ctrl, aosForControl, ersForControl)

			parentID := domainDocument.ID
			frameworkKeys := scfCoverageKeys(ctrl.Coverage)
			var frameworkJSON datatypes.JSON
			if len(frameworkKeys) > 0 {
				if b, err := json.Marshal(frameworkKeys); err != nil {
					// If marshalling fails, we still create the document but log the error.
					log.Errorf("Failed to marshal SCF framework keys for control %s: %v", ctrl.ObjectID, err)
				} else {
					frameworkJSON = datatypes.JSON(b)
				}
			}
			controlID := ctrl.ObjectID
			document := models.Document{
				ObjectID:         docObjectID,
				OrganizationID:   org.ID,
				ProjectID:        project.ID,
				TemplatePageID:   controlPageID,
				Title:            controlTitle,
				Content:          markdown,
				ParentID:         &parentID,
				Status:           "in_progress", // SCF control pages start in progress by default
				Version:          1,
				Order:            controlOrder,
				SCFControlID:     &controlID,
				SCFFrameworkKeys: frameworkJSON,
				// By default, SCF control pages start with a neutral relevance score.
				RelevanceScore: 0,
			}

			if err := tx.Create(&document).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create documentation from SCF config: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation"})
			}

			controlDocuments[ctrl.ObjectID] = document
			documentsCount++
			controlOrder++
		}

		rootPage.Children = append(rootPage.Children, domainPage)
	}

	// --- Risks and Threats document sections (derived from selected controls) ---

	// Collect distinct risk and threat IDs from selected controls.
	seenRiskIDs := make(map[string]struct{})
	seenThreatIDs := make(map[string]struct{})
	for _, ctrl := range selectedControls {
		for _, rid := range ctrl.RiskIDs {
			if rid == "" {
				continue
			}
			seenRiskIDs[rid] = struct{}{}
		}
		for _, tid := range ctrl.ThreatIDs {
			if tid == "" {
				continue
			}
			seenThreatIDs[tid] = struct{}{}
		}
	}

	// Risks overview and individual risk pages. The overview itself should be a
	// top-level sibling of the Controls Overview document (not a child of it),
	// so it has no ParentID. Individual risk pages remain children of the risks
	// overview document.
	if len(seenRiskIDs) > 0 {
		risksOverviewObjectID, err := crypto.GenerateUUID()
		if err != nil {
			tx.Rollback()
			log.Errorf("Failed to generate UUID for risks overview document: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
		}

		risksOverviewDocument := models.Document{
			ObjectID:       risksOverviewObjectID,
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			TemplatePageID: "risks-overview",
			Title:          "Risks",
			Content:        "Risks relevant to this project derived from selected SCF controls.",
			Status:         "draft",
			Version:        1,
			Order:          pageOrder,
		}

		if err := tx.Create(&risksOverviewDocument).Error; err != nil {
			tx.Rollback()
			log.Errorf("Failed to create risks overview document: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation"})
		}
		documentsCount++

		risksOverviewPage := DocumentPage{
			ID:      "risks-overview",
			Title:   "Risks",
			Content: risksOverviewDocument.Content,
			Order:   pageOrder,
		}
		pageOrder++

		// Load all SCF risks we need in one query.
		riskIDs := make([]string, 0, len(seenRiskIDs))
		for rid := range seenRiskIDs {
			riskIDs = append(riskIDs, rid)
		}
		var scfRisks []models.SCFRisk
		if len(riskIDs) > 0 {
			if err := tx.Where("object_id IN ?", riskIDs).Find(&scfRisks).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to load SCF risks: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create risk documentation"})
			}
		}

		// Index for quick lookup by ObjectID
		riskByID := make(map[string]models.SCFRisk, len(scfRisks))
		for _, r := range scfRisks {
			riskByID[r.ObjectID] = r
		}

		riskOrder := 1
		for rid := range seenRiskIDs {
			scfRisk, ok := riskByID[rid]
			if !ok {
				// If we don't have catalog data, skip creating a document for this ID.
				continue
			}

			riskDocObjectID, err := crypto.GenerateUUID()
			if err != nil {
				tx.Rollback()
				log.Errorf("Failed to generate UUID for risk document: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
			}

			title := fmt.Sprintf("%s - %s", scfRisk.ObjectID, scfRisk.Title)
			content := scfRisk.Description
			parentID := risksOverviewDocument.ID
			riskDocument := models.Document{
				ObjectID:       riskDocObjectID,
				OrganizationID: org.ID,
				ProjectID:      project.ID,
				TemplatePageID: fmt.Sprintf("risk-%s", scfRisk.ObjectID),
				Title:          title,
				Content:        content,
				ParentID:       &parentID,
				Status:         "draft",
				Version:        1,
				Order:          riskOrder,
			}

			if err := tx.Create(&riskDocument).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create risk document: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation"})
			}
			documentsCount++
			riskDocuments[scfRisk.ObjectID] = riskDocument

			risksOverviewPage.Children = append(risksOverviewPage.Children, DocumentPage{
				ID:      fmt.Sprintf("risk-%s", scfRisk.ObjectID),
				Title:   title,
				Content: content,
				Order:   riskOrder,
			})
			riskOrder++
		}

		rootPage.Children = append(rootPage.Children, risksOverviewPage)
	}

	// Threats overview and individual threat pages. The threats overview is
	// also a top-level sibling of the Controls Overview document.
	if len(seenThreatIDs) > 0 {
		threatsOverviewObjectID, err := crypto.GenerateUUID()
		if err != nil {
			tx.Rollback()
			log.Errorf("Failed to generate UUID for threats overview document: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
		}

		threatsOverviewDocument := models.Document{
			ObjectID:       threatsOverviewObjectID,
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			TemplatePageID: "threats-overview",
			Title:          "Threats",
			Content:        "Threats relevant to this project derived from selected SCF controls.",
			Status:         "draft",
			Version:        1,
			Order:          pageOrder,
		}

		if err := tx.Create(&threatsOverviewDocument).Error; err != nil {
			tx.Rollback()
			log.Errorf("Failed to create threats overview document: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation"})
		}
		documentsCount++

		threatsOverviewPage := DocumentPage{
			ID:      "threats-overview",
			Title:   "Threats",
			Content: threatsOverviewDocument.Content,
			Order:   pageOrder,
		}
		pageOrder++

		threatIDs := make([]string, 0, len(seenThreatIDs))
		for tid := range seenThreatIDs {
			threatIDs = append(threatIDs, tid)
		}
		var scfThreats []models.SCFThreat
		if len(threatIDs) > 0 {
			if err := tx.Where("object_id IN ?", threatIDs).Find(&scfThreats).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to load SCF threats: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create threat documentation"})
			}
		}

		threatByID := make(map[string]models.SCFThreat, len(scfThreats))
		for _, th := range scfThreats {
			threatByID[th.ObjectID] = th
		}

		threatOrder := 1
		for tid := range seenThreatIDs {
			th, ok := threatByID[tid]
			if !ok {
				continue
			}

			threatDocObjectID, err := crypto.GenerateUUID()
			if err != nil {
				tx.Rollback()
				log.Errorf("Failed to generate UUID for threat document: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
			}

			title := fmt.Sprintf("%s - %s", th.ObjectID, th.Title)
			content := th.Description
			parentID := threatsOverviewDocument.ID
			threatDocument := models.Document{
				ObjectID:       threatDocObjectID,
				OrganizationID: org.ID,
				ProjectID:      project.ID,
				TemplatePageID: fmt.Sprintf("threat-%s", th.ObjectID),
				Title:          title,
				Content:        content,
				ParentID:       &parentID,
				Status:         "draft",
				Version:        1,
				Order:          threatOrder,
			}

			if err := tx.Create(&threatDocument).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create threat document: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation"})
			}
			documentsCount++
			threatDocuments[th.ObjectID] = threatDocument

			threatsOverviewPage.Children = append(threatsOverviewPage.Children, DocumentPage{
				ID:      fmt.Sprintf("threat-%s", th.ObjectID),
				Title:   title,
				Content: content,
				Order:   threatOrder,
			})
			threatOrder++
		}

		rootPage.Children = append(rootPage.Children, threatsOverviewPage)
	}

	// Persist documentation template (legacy; kept so existing consumers are not broken)
	pagesPayload := struct {
		Pages []DocumentPage `json:"pages"`
	}{
		Pages: []DocumentPage{rootPage},
	}

	pagesJSON, err := json.Marshal(pagesPayload)
	if err != nil {
		tx.Rollback()
		log.Errorf("Failed to marshal documentation template: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation template"})
	}

	docTemplateObjectID, err := crypto.GenerateUUID()
	if err != nil {
		tx.Rollback()
		log.Errorf("Failed to generate UUID for documentation template: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	docTemplate := models.DocumentationTemplate{
		ObjectID:       docTemplateObjectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Template:       datatypes.JSON(pagesJSON),
	}

	if err := tx.Create(&docTemplate).Error; err != nil {
		tx.Rollback()
		log.Errorf("Failed to create documentation template from SCF config: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create documentation template"})
	}

	// --- Create document relations between controls and risks/threats ---
	for _, ctrl := range selectedControls {
		controlDoc, ok := controlDocuments[ctrl.ObjectID]
		if !ok {
			continue
		}

		for _, rid := range ctrl.RiskIDs {
			riskDoc, ok := riskDocuments[rid]
			if !ok {
				continue
			}

			// risk -> control
			rel1 := models.DocumentRelation{
				OrganizationID:    org.ID,
				ProjectID:         project.ID,
				DocumentID:        riskDoc.ID,
				RelatedDocumentID: controlDoc.ID,
				RelationType:      "risk_to_control",
			}
			if err := tx.Create(&rel1).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create risk_to_control relation: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create document relations"})
			}

			// control -> risk
			rel2 := models.DocumentRelation{
				OrganizationID:    org.ID,
				ProjectID:         project.ID,
				DocumentID:        controlDoc.ID,
				RelatedDocumentID: riskDoc.ID,
				RelationType:      "control_to_risk",
			}
			if err := tx.Create(&rel2).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create control_to_risk relation: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create document relations"})
			}
		}

		for _, tid := range ctrl.ThreatIDs {
			threatDoc, ok := threatDocuments[tid]
			if !ok {
				continue
			}

			// threat -> control
			rel1 := models.DocumentRelation{
				OrganizationID:    org.ID,
				ProjectID:         project.ID,
				DocumentID:        threatDoc.ID,
				RelatedDocumentID: controlDoc.ID,
				RelationType:      "threat_to_control",
			}
			if err := tx.Create(&rel1).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create threat_to_control relation: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create document relations"})
			}

			// control -> threat
			rel2 := models.DocumentRelation{
				OrganizationID:    org.ID,
				ProjectID:         project.ID,
				DocumentID:        controlDoc.ID,
				RelatedDocumentID: threatDoc.ID,
				RelationType:      "control_to_threat",
			}
			if err := tx.Create(&rel2).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create control_to_threat relation: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create document relations"})
			}
		}
	}

	// Create evidence requests for each control based on the config
	var evidenceRequestsCount int
	for _, ctrl := range selectedControls {
		document, ok := controlDocuments[ctrl.ObjectID]
		if !ok {
			continue
		}

		for _, evID := range ctrl.EvidenceRequestIDs {
			er, ok := erByID[evID]
			if !ok {
				continue
			}

			reqObjectID, err := crypto.GenerateUUID()
			if err != nil {
				tx.Rollback()
				log.Errorf("Failed to generate UUID for evidence request: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
			}

			suggestedSources := []map[string]interface{}{
				{
					"type":          "scf",
					"evidence_id":   er.ObjectID,
					"area_of_focus": er.AreaOfFocus,
					"artifact":      er.Artifact,
					"control_ids":   []string{ctrl.ObjectID},
				},
			}

			suggestedSourcesJSON, err := json.Marshal(suggestedSources)
			if err != nil {
				tx.Rollback()
				log.Errorf("Failed to marshal suggested sources: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create evidence request"})
			}

			priority := "medium"
			if ctrl.Priority {
				priority = "high"
			}

			evidenceRequest := models.EvidenceRequest{
				ObjectID:           reqObjectID,
				OrganizationID:     org.ID,
				ProjectID:          project.ID,
				DocumentID:         document.ID,
				Title:              fmt.Sprintf("%s - %s", er.ObjectID, er.Artifact),
				Description:        er.Description,
				RequiredType:       "any",
				SuggestedSources:   datatypes.JSON(suggestedSourcesJSON),
				AcceptanceCriteria: fmt.Sprintf("Evidence must demonstrate that control %s is implemented and maintained using artifact '%s'.", ctrl.ObjectID, er.Artifact),
				AssignedTo:         "",
				Priority:           priority,
				DueDate:            nil,
				Status:             "pending",
				CreatedBy:          "system:scf_config",
			}

			if err := tx.Create(&evidenceRequest).Error; err != nil {
				tx.Rollback()
				log.Errorf("Failed to create evidence request from SCF config: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to create evidence request"})
			}

			evidenceRequestsCount++
		}
	}

	// Create auditors per control document (only for controls with assessment objectives).
	// Each auditor is tightly scoped to a single control page so the frontend can
	// reliably associate auditors with documents via instructions.targets[].document_object_id.
	var auditorsCount int
	for _, ctrl := range selectedControls {
		// Only create auditors for controls that have at least one assessment objective.
		if len(ctrl.AssessmentObjectiveIDs) == 0 {
			continue
		}

		// Look up the control document created earlier; if for some reason it doesn't
		// exist, skip rather than partially wiring an auditor.
		document, ok := controlDocuments[ctrl.ObjectID]
		if !ok {
			continue
		}

		// Resolve the assessment objectives that actually exist in the config.
		var aosForControl []SCFConfigAOItem
		var aoIDs []string
		for _, aoID := range ctrl.AssessmentObjectiveIDs {
			if ao, ok := aoByID[aoID]; ok {
				aosForControl = append(aosForControl, ao)
				aoIDs = append(aoIDs, ao.ObjectID)
			}
		}
		if len(aosForControl) == 0 {
			// All referenced AOs were missing from the config; do not create an auditor.
			continue
		}

		// Collect evidence IDs scoped to this control (for context in the requirements).
		var evidenceIDs []string
		if ids, ok := controlEvidenceIDs[ctrl.ObjectID]; ok {
			for _, eID := range ids {
				evidenceIDs = append(evidenceIDs, eID)
			}
		}
		uniqueEvidenceIDs := uniqueStrings(evidenceIDs)

		context := fmt.Sprintf(
			"Control: %s\nSCF evidence IDs: %s",
			ctrl.ObjectID,
			strings.Join(uniqueEvidenceIDs, ", "),
		)

		// Build one requirement per assessment objective tied to this control.
		var requirements []interface{}
		for _, ao := range aosForControl {
			req := struct {
				ID              string   `json:"id"`
				Title           string   `json:"title"`
				Description     string   `json:"description"`
				Context         string   `json:"context"`
				SuccessCriteria []string `json:"success_criteria"`
				FailureCriteria []string `json:"failure_criteria"`
				Weight          int      `json:"weight"`
			}{
				ID:          fmt.Sprintf("req-%s", ao.ObjectID),
				Title:       ao.Statement,
				Description: fmt.Sprintf("Assessment objective %s: %s", ao.ObjectID, ao.Statement),
				Context:     context,
				SuccessCriteria: []string{
					"Controls are implemented as described and operating effectively.",
					"Evidence provided is complete, relevant, and recent.",
				},
				FailureCriteria: []string{
					"Key controls are missing or not fully implemented.",
					"Evidence is missing, outdated, or does not cover the scope.",
				},
				Weight: 100,
			}
			requirements = append(requirements, req)
		}
		if len(requirements) == 0 {
			continue
		}

		// Each control-level auditor targets exactly one document page so the
		// frontend can reliably fetch auditors "alongside" a control page.
		targets := []map[string]string{
			{
				"control_id":         ctrl.ObjectID,
				"document_object_id": document.ObjectID,
			},
		}

		instructions := struct {
			Requirements           []interface{}       `json:"requirements"`
			PassingScore           int                 `json:"passing_score"`
			EvaluationInstructions string              `json:"evaluation_instructions"`
			Targets                []map[string]string `json:"targets,omitempty"`
		}{
			Requirements:           requirements,
			PassingScore:           80,
			EvaluationInstructions: "Review this control and its associated evidence to determine if the assessment objectives are met.",
			Targets:                targets,
		}

		instructionsJSON, err := json.Marshal(instructions)
		if err != nil {
			tx.Rollback()
			log.Errorf("Failed to marshal auditor instructions: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create auditor"})
		}

		auditorObjectID, err := crypto.GenerateUUID()
		if err != nil {
			tx.Rollback()
			log.Errorf("Failed to generate UUID for auditor: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
		}

		auditorName := fmt.Sprintf("%s - %s", ctrl.ObjectID, truncateString(ctrl.Title, 60))
		auditorDescription := fmt.Sprintf("AI auditor for control %s covering assessment objectives %s", ctrl.ObjectID, strings.Join(aoIDs, ", "))

		auditor := models.Auditor{
			ObjectID:       auditorObjectID,
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			Name:           auditorName,
			Description:    auditorDescription,
			Schedule:       "",
			IsActive:       true,
			Instructions:   datatypes.JSON(instructionsJSON),
		}

		if err := tx.Create(&auditor).Error; err != nil {
			tx.Rollback()
			log.Errorf("Failed to create auditor from SCF config: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create auditor"})
		}

		auditorsCount++
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		log.Errorf("Failed to commit transaction for SCF config project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create project"})
	}

	// Build response with basic stats so clients can quickly understand what was created
	stats := fiber.Map{
		"controls":          len(selectedControls),
		"documents":         documentsCount,
		"evidence_requests": evidenceRequestsCount,
		"auditors":          auditorsCount,
	}

	response := fiber.Map{
		"project": BuildProjectResponse(project),
		"stats":   stats,
	}

	return c.Status(201).JSON(response)
}

// UpdateProject updates an existing project
// @Summary Update a project
// @Description Update an existing project
// @Tags Project
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Param project body ProjectRequest true "Project data"
// @Success 200 {object} ProjectResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id} [put]
// @Security Bearer
func (h *ProjectHandler) UpdateProject(c *fiber.Ctx) error {
	orgID := c.Params("org_id")
	projectID := c.Params("project_id")

	var projectRequest ProjectRequest
	if err := c.BodyParser(&projectRequest); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
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
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Update fields
	if projectRequest.Name != "" {
		project.Name = projectRequest.Name
	}
	if projectRequest.Description != "" {
		project.Description = projectRequest.Description
	}
	if projectRequest.Status != "" {
		project.Status = projectRequest.Status
	}
	// Always update compliance score (even if 0)
	project.ComplianceScore = projectRequest.ComplianceScore

	if err := h.DB.Save(&project).Error; err != nil {
		log.Errorf("Failed to update project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update project"})
	}

	return c.JSON(BuildProjectResponse(project))
}

// DeleteProject deletes a project
// @Summary Delete a project
// @Description Delete a project by ID
// @Tags Project
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param project_id path string true "Project ID"
// @Success 204
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/project/{project_id} [delete]
// @Security Bearer
func (h *ProjectHandler) DeleteProject(c *fiber.Ctx) error {
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
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	if err := h.DB.Delete(&project).Error; err != nil {
		log.Errorf("Failed to delete project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete project"})
	}

	return c.SendStatus(204)
}

// buildSCFOverviewContent formats a generic markdown overview for the SCF-driven project.
func buildSCFOverviewContent(cfg SCFConfigV1, controls []SCFConfigControl) string {
	totalControls := len(controls)
	domainSet := make(map[string]struct{})
	for _, c := range controls {
		domain := strings.TrimSpace(c.Domain)
		if domain == "" {
			domain = "Uncategorized"
		}
		domainSet[domain] = struct{}{}
	}

	domainNames := make([]string, 0, len(domainSet))
	for d := range domainSet {
		domainNames = append(domainNames, d)
	}
	sort.Strings(domainNames)

	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\n", cfg.ProjectName)
	b.WriteString("This project was created from an SCF configuration document.\n\n")
	fmt.Fprintf(&b, "- **Total selected controls:** %d\n", totalControls)
	if cfg.Timeline.MaxMonths > 0 {
		fmt.Fprintf(&b, "- **Planned duration:** %d months\n", cfg.Timeline.MaxMonths)
	}
	if len(domainNames) > 0 {
		b.WriteString("- **Domains covered:** ")
		b.WriteString(strings.Join(domainNames, ", "))
		b.WriteString("\n")
	}

	if len(cfg.Timeline.Windows) > 0 {
		b.WriteString("\n## Timeline windows\n\n")
		for _, w := range cfg.Timeline.Windows {
			fmt.Fprintf(&b, "- %s (months %d–%d)\n", w.Goal, w.StartMonth, w.EndMonth)
		}
	}

	return b.String()
}

// buildSCFProjectDescription derives a short, human-friendly project description
// from the selected filters when no explicit description was provided in the SCF
// config. It summarizes the number of selected controls, coverage/core filters,
// timeline, and priority flags.
func buildSCFProjectDescription(cfg SCFConfigV1, selectedControls []SCFConfigControl) string {
	totalControls := len(selectedControls)
	if totalControls == 0 {
		return "SCF project with 0 selected controls."
	}

	coverageSet := make(map[string]struct{})
	coreSet := make(map[string]struct{})
	priorityCount := 0

	for _, control := range selectedControls {
		for framework, ok := range control.Coverage {
			if ok {
				coverageSet[framework] = struct{}{}
			}
		}
		for key, ok := range control.Core {
			if ok {
				coreSet[key] = struct{}{}
			}
		}
		if control.Priority {
			priorityCount++
		}
	}

	coverage := make([]string, 0, len(coverageSet))
	for k := range coverageSet {
		coverage = append(coverage, k)
	}
	sort.Strings(coverage)

	cores := make([]string, 0, len(coreSet))
	for k := range coreSet {
		cores = append(cores, k)
	}
	sort.Strings(cores)

	var parts []string
	if totalControls == 1 {
		parts = append(parts, "SCF project with 1 selected control")
	} else {
		parts = append(parts, fmt.Sprintf("SCF project with %d selected controls", totalControls))
	}

	if len(coverage) > 0 {
		parts = append(parts, fmt.Sprintf("covering %s", strings.Join(coverage, ", ")))
	}
	if len(cores) > 0 {
		parts = append(parts, fmt.Sprintf("core: %s", strings.Join(cores, ", ")))
	}
	if cfg.Timeline.MaxMonths > 0 {
		parts = append(parts, fmt.Sprintf("over %d months", cfg.Timeline.MaxMonths))
	}
	if priorityCount > 0 {
		if priorityCount == totalControls {
			parts = append(parts, "all marked as priority")
		} else {
			parts = append(parts, fmt.Sprintf("%d marked as priority", priorityCount))
		}
	}

	return strings.Join(parts, ", ") + "."
}

// buildSCFControlMarkdown formats the markdown content for a single control page.
func buildSCFControlMarkdown(cfg SCFConfigV1, control SCFConfigControl, aos []SCFConfigAOItem, ers []SCFConfigERItem) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# %s - %s\n\n", control.ObjectID, control.Title)

	b.WriteString("## Control intent\n\n")
	if control.ControlDescription != "" {
		b.WriteString(control.ControlDescription)
		b.WriteString("\n\n")
	}
	fmt.Fprintf(&b, "- **Domain:** %s\n", control.Domain)
	if control.Cadence != "" {
		fmt.Fprintf(&b, "- **Cadence:** %s\n", control.Cadence)
	}
	if control.Weight != 0 {
		fmt.Fprintf(&b, "- **Weight:** %.2f\n", control.Weight)
	}
	if len(control.Coverage) > 0 {
		var frameworks []string
		for fw, ok := range control.Coverage {
			if ok {
				frameworks = append(frameworks, fw)
			}
		}
		sort.Strings(frameworks)
		if len(frameworks) > 0 {
			fmt.Fprintf(&b, "- **Framework coverage:** %s\n", strings.Join(frameworks, ", "))
		}
	}
	if len(control.Core) > 0 {
		var coreFlags []string
		for k, ok := range control.Core {
			if ok {
				coreFlags = append(coreFlags, k)
			}
		}
		sort.Strings(coreFlags)
		if len(coreFlags) > 0 {
			fmt.Fprintf(&b, "- **Core:** %s\n", strings.Join(coreFlags, ", "))
		}
	}

	// NOTE: We previously rendered "Related risks" and "Related threats" sections here
	// using control.RiskIDs and control.ThreatIDs. This was removed to reduce noise on
	// each control page; risks and threats are exposed via dedicated SCF endpoints and
	// UI surfaces instead of being duplicated in every control document.

	// NOTE: We also used to render "Assessment objectives", "Evidence to collect", and
	// "Implementation notes" sections directly into the control markdown using the
	// provided assessment objectives (aos) and evidence requests (ers), along with a
	// static implementation checklist. These sections have been removed from the
	// generated document content to keep SCF-derived control pages leaner and avoid
	// duplicating structured AO/evidence data that is surfaced via other UI surfaces.

	return b.String()
}

// slugify converts a string into a simple slug suitable for use in IDs.
func slugify(input string) string {
	s := strings.ToLower(strings.TrimSpace(input))
	s = strings.ReplaceAll(s, " ", "-")
	return s
}

// truncateString trims a string to a maximum length, adding ellipsis if needed.
func truncateString(s string, max int) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	if max <= 3 {
		return s[:max]
	}
	return s[:max-3] + "..."
}

// uniqueStrings returns a de-duplicated copy of the input slice, preserving order.
func uniqueStrings(in []string) []string {
	seen := make(map[string]struct{}, len(in))
	var out []string
	for _, v := range in {
		if v == "" {
			continue
		}
		if _, ok := seen[v]; ok {
			continue
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}
	return out
}

// createDefaultSOC2Documentation creates default documentation, evidence, and collections for SOC2 projects
func (h *ProjectHandler) createDefaultSOC2Documentation(tx *gorm.DB, orgID uint, projectID uint) error {
	// Load default SOC2 documentation data
	defaultDataPath := "default-data/default_soc2_documentation.json"
	defaultDataBytes, err := os.ReadFile(defaultDataPath)
	if err != nil {
		log.Errorf("Failed to read default SOC2 documentation file: %v", err)
		return err
	}

	var defaultData struct {
		TemplatePageID string `json:"template_page_id"`
		Documents      []struct {
			Title    string `json:"title"`
			Content  string `json:"content"`
			Status   string `json:"status"`
			Evidence []struct {
				Name          string                 `json:"name"`
				Description   string                 `json:"description"`
				Type          string                 `json:"type"`
				SourceID      string                 `json:"source_id"`
				SourceType    string                 `json:"source_type"`
				SourceMethod  string                 `json:"source_method"`
				SourceQuery   string                 `json:"source_query"`
				DateCollected string                 `json:"date_collected"`
				DateExpires   *string                `json:"date_expires"`
				Context       string                 `json:"context"`
				ValueType     string                 `json:"value_type"`
				Value         map[string]interface{} `json:"value"`
				Group         string                 `json:"group"`
				Tags          []string               `json:"tags"`
			} `json:"evidence"`
			Collections []struct {
				Name           string                   `json:"name"`
				Description    string                   `json:"description"`
				Type           string                   `json:"type"`
				AgentType      string                   `json:"agent_type"`
				AgentReasoning string                   `json:"agent_reasoning"`
				AgentPrompt    string                   `json:"agent_prompt"`
				AgentContext   string                   `json:"agent_context"`
				Content        map[string]interface{}   `json:"content"`
				Sources        []map[string]interface{} `json:"sources"`
			} `json:"collections"`
			EvidenceRequests []struct {
				Title              string   `json:"title"`
				Description        string   `json:"description"`
				RequiredType       string   `json:"required_type"`
				SuggestedSources   []string `json:"suggested_sources"`
				AcceptanceCriteria string   `json:"acceptance_criteria"`
				AssignedTo         string   `json:"assigned_to"`
				Priority           string   `json:"priority"`
				DueDate            string   `json:"due_date"`
				Status             string   `json:"status"`
				CreatedBy          string   `json:"created_by"`
			} `json:"evidence_requests"`
		} `json:"documents"`
	}

	if err := json.Unmarshal(defaultDataBytes, &defaultData); err != nil {
		log.Errorf("Failed to parse default SOC2 documentation: %v", err)
		return err
	}

	// Create documents with evidence, collections, and evidence requests
	for _, docData := range defaultData.Documents {
		// Create document
		docObjectID, err := crypto.GenerateUUID()
		if err != nil {
			return err
		}

		document := models.Document{
			ObjectID:       docObjectID,
			OrganizationID: orgID,
			ProjectID:      projectID,
			TemplatePageID: defaultData.TemplatePageID,
			Title:          docData.Title,
			Content:        docData.Content,
			Status:         docData.Status,
			Version:        1,
			Order:          1,
		}

		if err := tx.Create(&document).Error; err != nil {
			return err
		}

		// Create collections first (evidence may reference them)
		collectionMap := make(map[string]uint) // map collection name to ID
		for _, collData := range docData.Collections {
			collObjectID, err := crypto.GenerateUUID()
			if err != nil {
				return err
			}

			contentJSON, err := json.Marshal(collData.Content)
			if err != nil {
				return err
			}

			sourcesJSON, err := json.Marshal(collData.Sources)
			if err != nil {
				return err
			}

			// Calculate content hash
			contentHash := calculateCollectionHash(contentJSON)

			collection := models.Collection{
				ObjectID:       collObjectID,
				OrganizationID: orgID,
				ProjectID:      projectID,
				Name:           collData.Name,
				Description:    collData.Description,
				Type:           collData.Type,
				AgentType:      collData.AgentType,
				AgentReasoning: collData.AgentReasoning,
				AgentPrompt:    collData.AgentPrompt,
				AgentContext:   collData.AgentContext,
				Content:        datatypes.JSON(contentJSON),
				ContentHash:    contentHash,
				Sources:        datatypes.JSON(sourcesJSON),
			}

			if err := tx.Create(&collection).Error; err != nil {
				return err
			}

			collectionMap[collData.Name] = collection.ID
		}

		// Create evidence
		for _, eviData := range docData.Evidence {
			eviObjectID, err := crypto.GenerateUUID()
			if err != nil {
				return err
			}

			valueJSON, err := json.Marshal(eviData.Value)
			if err != nil {
				return err
			}

			tagsJSON, err := json.Marshal(eviData.Tags)
			if err != nil {
				return err
			}

			dateCollected, err := time.Parse(time.RFC3339, eviData.DateCollected)
			if err != nil {
				return err
			}

			var dateExpires *time.Time
			if eviData.DateExpires != nil {
				parsed, err := time.Parse(time.RFC3339, *eviData.DateExpires)
				if err == nil {
					dateExpires = &parsed
				}
			}

			// Calculate content hash
			contentHash := calculateEvidenceHash(valueJSON)

			evidence := models.Evidence{
				ObjectID:       eviObjectID,
				OrganizationID: orgID,
				ProjectID:      projectID,
				DocumentID:     document.ID,
				Name:           eviData.Name,
				Description:    eviData.Description,
				Type:           eviData.Type,
				SourceID:       eviData.SourceID,
				SourceType:     eviData.SourceType,
				SourceMethod:   eviData.SourceMethod,
				SourceQuery:    eviData.SourceQuery,
				DateCollected:  dateCollected,
				DateExpires:    dateExpires,
				Context:        eviData.Context,
				ValueType:      eviData.ValueType,
				Value:          datatypes.JSON(valueJSON),
				ContentHash:    contentHash,
				Group:          eviData.Group,
				Tags:           datatypes.JSON(tagsJSON),
			}

			// Link to collection if value_type is "collection"
			if eviData.ValueType == "collection" {
				// Find collection by name (from evidence name pattern)
				for collName, collID := range collectionMap {
					if strings.Contains(eviData.Name, collName) || strings.Contains(eviData.Description, collName) {
						evidence.CollectionID = &collID
						break
					}
				}
			}

			if err := tx.Create(&evidence).Error; err != nil {
				return err
			}
		}

		// Create evidence requests
		for _, reqData := range docData.EvidenceRequests {
			reqObjectID, err := crypto.GenerateUUID()
			if err != nil {
				return err
			}

			suggestedSourcesJSON, err := json.Marshal(reqData.SuggestedSources)
			if err != nil {
				return err
			}

			var dueDate *time.Time
			if reqData.DueDate != "" {
				parsed, err := time.Parse(time.RFC3339, reqData.DueDate)
				if err == nil {
					dueDate = &parsed
				}
			}

			evidenceRequest := models.EvidenceRequest{
				ObjectID:           reqObjectID,
				OrganizationID:     orgID,
				ProjectID:          projectID,
				DocumentID:         document.ID,
				Title:              reqData.Title,
				Description:        reqData.Description,
				RequiredType:       reqData.RequiredType,
				SuggestedSources:   datatypes.JSON(suggestedSourcesJSON),
				AcceptanceCriteria: reqData.AcceptanceCriteria,
				AssignedTo:         reqData.AssignedTo,
				Priority:           reqData.Priority,
				DueDate:            dueDate,
				Status:             reqData.Status,
				CreatedBy:          reqData.CreatedBy,
			}

			if err := tx.Create(&evidenceRequest).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

// Helper functions for hash calculation (reused from collection_handler and evidence_handler)
func calculateCollectionHash(content json.RawMessage) string {
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

func calculateEvidenceHash(value json.RawMessage) string {
	// Normalize JSON to ensure consistent hashing
	var normalized interface{}
	if err := json.Unmarshal(value, &normalized); err != nil {
		return ""
	}
	canonicalJSON, err := json.Marshal(normalized)
	if err != nil {
		return ""
	}

	hash := sha256.Sum256(canonicalJSON)
	return hex.EncodeToString(hash[:])
}
