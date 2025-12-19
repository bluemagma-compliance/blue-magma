package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectTestDB() (*gorm.DB, models.Organization) {
	db, _ := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	db.AutoMigrate(
		&models.Organization{},
		&models.Project{},
		&models.DocumentationTemplate{},
		&models.Document{},
		&models.DocumentRelation{},
		&models.Collection{},
		&models.Evidence{},
		&models.EvidenceRequest{},
		&models.Auditor{},
		&models.SCFRisk{},
		&models.SCFThreat{},
	)

	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	return db, org
}

// TestBuildSCFControlMarkdown_DoesNotIncludeDeprecatedSections ensures that the
// markdown generated for SCF control documents no longer includes the
// deprecated sections we previously rendered into the content.
func TestBuildSCFControlMarkdown_DoesNotIncludeDeprecatedSections(t *testing.T) {
	cfg := SCFConfigV1{
		ProjectName: "SCF Test Project",
	}

	control := SCFConfigControl{
		ObjectID:           "SCF-AC-1",
		Title:              "Access control baseline",
		Domain:             "Access Control",
		Cadence:            "ongoing",
		Weight:             1.0,
		Coverage:           map[string]bool{"SOC2": true},
		Core:               map[string]bool{"SOC2": true},
		ControlDescription: "Baseline access control requirements.",
	}

	aos := []SCFConfigAOItem{
		{
			ObjectID:  "AO-1",
			Statement: "Assess access control baseline.",
		},
	}

	ers := []SCFConfigERItem{
		{
			ObjectID: "EV-1",
			Artifact: "Access control matrix",
		},
	}

	markdown := buildSCFControlMarkdown(cfg, control, aos, ers)

	assert.NotEmpty(t, markdown)
	assert.NotContains(t, markdown, "## Assessment objectives")
	assert.NotContains(t, markdown, "## Evidence to collect")
	assert.NotContains(t, markdown, "## Implementation notes")
}

func TestCreateProjectFromSCFConfig_Success(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Post("/api/v1/org/:org_id/project/from-scf-config", handler.CreateProjectFromSCFConfig)

	// Seed minimal SCF risk and threat catalog entries referenced by the config
	if err := db.Create(&models.SCFRisk{ObjectID: "R-1", Title: "Test risk", Description: "Test risk description"}).Error; err != nil {
		t.Fatalf("failed to seed SCFRisk: %v", err)
	}
	if err := db.Create(&models.SCFThreat{ObjectID: "T-1", Title: "Test threat", Description: "Test threat description"}).Error; err != nil {
		t.Fatalf("failed to seed SCFThreat: %v", err)
	}

	cfg := SCFConfigV1{
		Version:        "scf_config.v1",
		GeneratedAt:    "2025-12-03T12:34:56.789Z",
		Source:         "test",
		ProjectName:    "SCF Test Project",
		OrganizationID: org.ObjectID,
		Controls: []SCFConfigControl{
			{
				ObjectID:               "SCF-AC-1",
				Title:                  "Access control baseline",
				Domain:                 "Access Control",
				Cadence:                "ongoing",
				Weight:                 1.0,
				Coverage:               map[string]bool{"SOC2": true},
				Core:                   map[string]bool{"SOC2": true},
				Selected:               true,
				Priority:               true,
				ControlDescription:     "Baseline access control requirements.",
				RiskIDs:                []string{"R-1"},
				ThreatIDs:              []string{"T-1"},
				AssessmentObjectiveIDs: []string{"AO-1"},
				EvidenceRequestIDs:     []string{"EV-1"},
			},
		},
		Timeline: SCFConfigTimeline{
			Windows: []SCFConfigTimelineWindow{
				{Goal: "Initial rollout", StartMonth: 1, EndMonth: 3},
			},
			MaxMonths:           6,
			TotalUniqueControls: 1,
		},
		AssessmentObjectives: SCFConfigAOSection{
			Items: []SCFConfigAOItem{
				{
					ObjectID:        "AO-1",
					ControlMappings: "SCF-AC-1",
					Statement:       "Assess access control baseline.",
					Origin:          "test",
					IsSCFBaseline:   true,
				},
			},
			ControlsByAOID: map[string][]string{
				"AO-1": {"SCF-AC-1"},
			},
		},
		EvidenceRequests: SCFConfigERSection{
			Items: []SCFConfigERItem{
				{
					ObjectID:    "EV-1",
					AreaOfFocus: "Access control",
					Artifact:    "Access control matrix",
					Description: "Matrix mapping users/groups to systems and permissions.",
				},
			},
			ControlsByEvidenceID: map[string][]string{
				"EV-1": {"SCF-AC-1"},
			},
		},
	}

	body, _ := json.Marshal(cfg)
	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project/from-scf-config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	var outer struct {
		Project ProjectResponse `json:"project"`
		Stats   struct {
			Controls         int `json:"controls"`
			Documents        int `json:"documents"`
			EvidenceRequests int `json:"evidence_requests"`
			Auditors         int `json:"auditors"`
		} `json:"stats"`
	}
	json.NewDecoder(resp.Body).Decode(&outer)

	assert.Equal(t, "SCF Test Project", outer.Project.Name)
	// Description should be derived from the selected filters (coverage/core),
	// timeline, and priority flags when none is explicitly provided.
	assert.Contains(t, outer.Project.Description, "SCF project with 1 selected control")
	assert.Contains(t, outer.Project.Description, "covering SOC2")
	assert.Contains(t, outer.Project.Description, "core: SOC2")
	assert.Contains(t, outer.Project.Description, "over 6 months")
	assert.Contains(t, outer.Project.Description, "all marked as priority")
	assert.Equal(t, 1, outer.Stats.Controls)
	// We expect seven documents: root overview, one domain page, one control page,
	// risks and threats overview pages, and one risk and one threat page from the
	// seeded SCF catalog.
	assert.Equal(t, 7, outer.Stats.Documents)
	assert.Equal(t, 1, outer.Stats.EvidenceRequests)
	assert.Equal(t, 1, outer.Stats.Auditors)

	// Verify related records exist in the database
	var project models.Project
	err := db.Where("object_id = ?", outer.Project.ObjectID).First(&project).Error
	assert.NoError(t, err)

	var docTemplates []models.DocumentationTemplate
	db.Where("project_id = ?", project.ID).Find(&docTemplates)
	assert.Len(t, docTemplates, 1)

	var documents []models.Document
	db.Where("project_id = ?", project.ID).Find(&documents)
	assert.Len(t, documents, 7)

	// Ensure we have expected root-level documents (Controls Overview, Risks,
	// and Threats) wired via ParentID = nil.
	var rootDocs []models.Document
	for _, d := range documents {
		if d.ParentID == nil {
			rootDocs = append(rootDocs, d)
		}
	}
	assert.Len(t, rootDocs, 3)
	rootTitles := map[string]bool{}
	for _, d := range rootDocs {
		rootTitles[d.Title] = true
	}
	assert.True(t, rootTitles["Controls Overview"])
	assert.True(t, rootTitles["Risks"])
	assert.True(t, rootTitles["Threats"])

	// Ensure risks and threats overview documents exist
	var risksOverview, threatsOverview *models.Document
	for i := range documents {
		if documents[i].TemplatePageID == "risks-overview" {
			risksOverview = &documents[i]
		}
		if documents[i].TemplatePageID == "threats-overview" {
			threatsOverview = &documents[i]
		}
	}
	if assert.NotNil(t, risksOverview) {
		assert.Equal(t, "Risks", risksOverview.Title)
	}
	if assert.NotNil(t, threatsOverview) {
		assert.Equal(t, "Threats", threatsOverview.Title)
	}

	var evidenceRequests []models.EvidenceRequest
	db.Where("project_id = ?", project.ID).Find(&evidenceRequests)
	assert.Len(t, evidenceRequests, 1)

	var auditors []models.Auditor
	db.Where("project_id = ?", project.ID).Find(&auditors)
	assert.Len(t, auditors, 1)

	// Auditor instructions should include targets mapping to the control document
	var instructions struct {
		Targets []struct {
			ControlID        string `json:"control_id"`
			DocumentObjectID string `json:"document_object_id"`
		} `json:"targets"`
	}
	json.Unmarshal(auditors[0].Instructions, &instructions)
	assert.Len(t, instructions.Targets, 1)
	assert.Equal(t, "SCF-AC-1", instructions.Targets[0].ControlID)

	// Target document_object_id should match the control document we created, and
	// control documents created from SCF config should start in progress.
	var controlDoc *models.Document
	for i := range documents {
		if documents[i].TemplatePageID == "control-SCF-AC-1" {
			controlDoc = &documents[i]
			break
		}
	}
	if assert.NotNil(t, controlDoc) {
		assert.Equal(t, controlDoc.ObjectID, instructions.Targets[0].DocumentObjectID)
		assert.Equal(t, "in_progress", controlDoc.Status)
	}

	// Document relations should link the control to the seeded risk and threat
	var relations []models.DocumentRelation
	db.Where("project_id = ?", project.ID).Find(&relations)
	if assert.Len(t, relations, 4) {
		relationTypes := map[string]bool{}
		for _, r := range relations {
			relationTypes[r.RelationType] = true
		}
		assert.True(t, relationTypes["risk_to_control"])
		assert.True(t, relationTypes["control_to_risk"])
		assert.True(t, relationTypes["threat_to_control"])
		assert.True(t, relationTypes["control_to_threat"])
	}
}

// TestGetDocumentFull_RelatedPagesFromSCFProject verifies that when we fetch a
// control document created from an SCF config using GetDocumentFull, the
// response includes related risk and threat pages with the expected metadata.
func TestGetDocumentFull_RelatedPagesFromSCFProject(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()

	projectHandler := NewProjectHandler(db)
	documentHandler := NewDocumentHandler(db)

	// Route for creating a project from SCF config (no auth/middleware in tests)
	app.Post("/api/v1/org/:org_id/project/from-scf-config", func(c *fiber.Ctx) error {
		// In production this is set by RestOrgCheckMiddleware; here we wire it
		// directly.
		c.Locals("organization", org)
		return projectHandler.CreateProjectFromSCFConfig(c)
	})

	// Route for fetching a full document with related pages
	app.Get("/api/v1/org/:org_id/project/:project_id/document/:document_id/full", func(c *fiber.Ctx) error {
		c.Locals("organization", org)
		return documentHandler.GetDocumentFull(c)
	})

	// Seed minimal SCF risk and threat entries used by the config
	if err := db.Create(&models.SCFRisk{ObjectID: "R-1", Title: "Test risk", Description: "Test risk description"}).Error; err != nil {
		t.Fatalf("failed to seed SCFRisk: %v", err)
	}
	if err := db.Create(&models.SCFThreat{ObjectID: "T-1", Title: "Test threat", Description: "Test threat description"}).Error; err != nil {
		t.Fatalf("failed to seed SCFThreat: %v", err)
	}

	cfg := SCFConfigV1{
		Version:        "scf_config.v1",
		GeneratedAt:    "2025-12-03T12:34:56.789Z",
		Source:         "test",
		ProjectName:    "SCF Test Project",
		OrganizationID: org.ObjectID,
		Controls: []SCFConfigControl{
			{
				ObjectID:               "SCF-AC-1",
				Title:                  "Access control baseline",
				Domain:                 "Access Control",
				Cadence:                "ongoing",
				Weight:                 1.0,
				Coverage:               map[string]bool{"SOC2": true},
				Core:                   map[string]bool{"SOC2": true},
				Selected:               true,
				Priority:               true,
				ControlDescription:     "Baseline access control requirements.",
				RiskIDs:                []string{"R-1"},
				ThreatIDs:              []string{"T-1"},
				AssessmentObjectiveIDs: []string{"AO-1"},
				EvidenceRequestIDs:     []string{"EV-1"},
			},
		},
		Timeline: SCFConfigTimeline{
			Windows: []SCFConfigTimelineWindow{
				{Goal: "Initial rollout", StartMonth: 1, EndMonth: 3},
			},
			MaxMonths:           6,
			TotalUniqueControls: 1,
		},
		AssessmentObjectives: SCFConfigAOSection{
			Items: []SCFConfigAOItem{
				{
					ObjectID:        "AO-1",
					ControlMappings: "SCF-AC-1",
					Statement:       "Assess access control baseline.",
					Origin:          "test",
					IsSCFBaseline:   true,
				},
			},
			ControlsByAOID: map[string][]string{
				"AO-1": {"SCF-AC-1"},
			},
		},
		EvidenceRequests: SCFConfigERSection{
			Items: []SCFConfigERItem{
				{
					ObjectID:    "EV-1",
					AreaOfFocus: "Access control",
					Artifact:    "Access control matrix",
					Description: "Matrix mapping users/groups to systems and permissions.",
				},
			},
			ControlsByEvidenceID: map[string][]string{
				"EV-1": {"SCF-AC-1"},
			},
		},
	}

	body, _ := json.Marshal(cfg)
	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project/from-scf-config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	var outer struct {
		Project ProjectResponse `json:"project"`
	}
	json.NewDecoder(resp.Body).Decode(&outer)

	// Find the control document we created
	var project models.Project
	if err := db.Where("object_id = ?", outer.Project.ObjectID).First(&project).Error; err != nil {
		t.Fatalf("failed to load project: %v", err)
	}

	var documents []models.Document
	db.Where("project_id = ?", project.ID).Find(&documents)

	var controlDoc *models.Document
	for i := range documents {
		if documents[i].TemplatePageID == "control-SCF-AC-1" {
			controlDoc = &documents[i]
			break
		}
	}
	if !assert.NotNil(t, controlDoc) {
		return
	}

	// Call GetDocumentFull for the control document
	getReq := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+outer.Project.ObjectID+"/document/"+controlDoc.ObjectID+"/full", nil)
	getResp, _ := app.Test(getReq)
	assert.Equal(t, fiber.StatusOK, getResp.StatusCode)

	var fullResp struct {
		Document struct {
			ObjectID       string `json:"object_id"`
			TemplatePageID string `json:"template_page_id"`
			PageKind       string `json:"page_kind"`
			IsControl      bool   `json:"is_control"`
		} `json:"document"`
		RelatedPages []struct {
			ObjectID       string `json:"object_id"`
			TemplatePageID string `json:"template_page_id"`
			PageKind       string `json:"page_kind"`
			IsControl      bool   `json:"is_control"`
			RelationType   string `json:"relation_type"`
		} `json:"related_pages"`
	}
	json.NewDecoder(getResp.Body).Decode(&fullResp)

	assert.Equal(t, controlDoc.ObjectID, fullResp.Document.ObjectID)
	assert.Equal(t, "control-SCF-AC-1", fullResp.Document.TemplatePageID)
	assert.Equal(t, "control", fullResp.Document.PageKind)
	assert.True(t, fullResp.Document.IsControl)

	// We expect the control document to have two related pages: one risk and one threat
	if assert.Len(t, fullResp.RelatedPages, 2) {
		kinds := map[string]bool{}
		relationTypes := map[string]bool{}
		for _, rp := range fullResp.RelatedPages {
			kinds[rp.PageKind] = true
			relationTypes[rp.RelationType] = true
			assert.False(t, rp.IsControl)
		}
		assert.True(t, kinds["risk"])
		assert.True(t, kinds["threat"])
		assert.True(t, relationTypes["control_to_risk"])
		assert.True(t, relationTypes["control_to_threat"])
	}
}

func TestCreateProjectFromSCFConfig_OrgMismatch(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Post("/api/v1/org/:org_id/project/from-scf-config", handler.CreateProjectFromSCFConfig)

	cfg := SCFConfigV1{
		Version:        "scf_config.v1",
		ProjectName:    "SCF Test Project",
		OrganizationID: "other-org",
		Controls: []SCFConfigControl{
			{ObjectID: "SCF-AC-1", Title: "Control", Selected: true},
		},
	}

	body, _ := json.Marshal(cfg)
	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project/from-scf-config", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

func TestCreateProject(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Post("/api/v1/org/:org_id/project", handler.CreateProject)

	requestBody := ProjectRequest{
		Name:            "Test Project",
		Description:     "Test project description",
		Status:          "active",
		ComplianceScore: 75.5,
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	var outer struct {
		Project ProjectResponse `json:"project"`
	}
	json.NewDecoder(resp.Body).Decode(&outer)
	response := outer.Project
	assert.Equal(t, "Test Project", response.Name)
	assert.Equal(t, "Test project description", response.Description)
	assert.Equal(t, "active", response.Status)
	assert.Equal(t, 75.5, response.ComplianceScore)
	assert.NotEmpty(t, response.ObjectID)
}

func TestCreateProject_MissingName(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Post("/api/v1/org/:org_id/project", handler.CreateProject)

	requestBody := ProjectRequest{
		Description: "Test project description",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

func TestCreateProject_DefaultStatus(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Post("/api/v1/org/:org_id/project", handler.CreateProject)

	requestBody := ProjectRequest{
		Name:        "Test Project",
		Description: "Test project description",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	var outer struct {
		Project ProjectResponse `json:"project"`
	}
	json.NewDecoder(resp.Body).Decode(&outer)
	response := outer.Project
	assert.Equal(t, "on-hold", response.Status)
}

func TestGetProjects(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	// Create test projects
	project1 := models.Project{
		ObjectID:        "project-1",
		OrganizationID:  org.ID,
		Name:            "Project 1",
		Description:     "Description 1",
		Status:          "active",
		ComplianceScore: 80.0,
	}
	project2 := models.Project{
		ObjectID:        "project-2",
		OrganizationID:  org.ID,
		Name:            "Project 2",
		Description:     "Description 2",
		Status:          "completed",
		ComplianceScore: 95.0,
	}
	db.Create(&project1)
	db.Create(&project2)

	app.Get("/api/v1/org/:org_id/project", handler.GetProjects)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response []ProjectResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.Equal(t, 2, len(response))
	assert.Equal(t, "Project 1", response[0].Name)
	assert.Equal(t, "Project 2", response[1].Name)
}

func TestGetProject(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	project := models.Project{
		ObjectID:        "project-1",
		OrganizationID:  org.ID,
		Name:            "Test Project",
		Description:     "Test Description",
		Status:          "active",
		ComplianceScore: 85.5,
	}
	db.Create(&project)

	app.Get("/api/v1/org/:org_id/project/:project_id", handler.GetProject)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID, nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response ProjectResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.Equal(t, "Test Project", response.Name)
	assert.Equal(t, "Test Description", response.Description)
	assert.Equal(t, "active", response.Status)
	assert.Equal(t, 85.5, response.ComplianceScore)
}

func TestGetProject_NotFound(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Get("/api/v1/org/:org_id/project/:project_id", handler.GetProject)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/nonexistent", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

func TestUpdateProject(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	project := models.Project{
		ObjectID:        "project-1",
		OrganizationID:  org.ID,
		Name:            "Original Name",
		Description:     "Original Description",
		Status:          "active",
		ComplianceScore: 50.0,
	}
	db.Create(&project)

	app.Put("/api/v1/org/:org_id/project/:project_id", handler.UpdateProject)

	requestBody := ProjectRequest{
		Name:            "Updated Name",
		Description:     "Updated Description",
		Status:          "completed",
		ComplianceScore: 90.0,
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("PUT", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response ProjectResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.Equal(t, "Updated Name", response.Name)
	assert.Equal(t, "Updated Description", response.Description)
	assert.Equal(t, "completed", response.Status)
	assert.Equal(t, 90.0, response.ComplianceScore)
}

func TestUpdateProject_NotFound(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Put("/api/v1/org/:org_id/project/:project_id", handler.UpdateProject)

	requestBody := ProjectRequest{
		Name: "Updated Name",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("PUT", "/api/v1/org/"+org.ObjectID+"/project/nonexistent", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

func TestDeleteProject(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	project := models.Project{
		ObjectID:        "project-1",
		OrganizationID:  org.ID,
		Name:            "Test Project",
		Description:     "Test Description",
		Status:          "active",
		ComplianceScore: 75.0,
	}
	db.Create(&project)

	app.Delete("/api/v1/org/:org_id/project/:project_id", handler.DeleteProject)

	req := httptest.NewRequest("DELETE", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID, nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNoContent, resp.StatusCode)

	// Verify project is deleted
	var deletedProject models.Project
	err := db.Where("object_id = ?", project.ObjectID).First(&deletedProject).Error
	assert.Error(t, err)
	assert.Equal(t, gorm.ErrRecordNotFound, err)
}

func TestDeleteProject_NotFound(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	app.Delete("/api/v1/org/:org_id/project/:project_id", handler.DeleteProject)

	req := httptest.NewRequest("DELETE", "/api/v1/org/"+org.ObjectID+"/project/nonexistent", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

func TestGetProjects_WrongOrganization(t *testing.T) {
	db, org := setupProjectTestDB()
	app := fiber.New()
	handler := NewProjectHandler(db)

	// Create project for org
	project := models.Project{
		ObjectID:        "project-1",
		OrganizationID:  org.ID,
		Name:            "Test Project",
		Status:          "active",
		ComplianceScore: 75.0,
	}
	db.Create(&project)

	app.Get("/api/v1/org/:org_id/project", handler.GetProjects)

	// Try to access with wrong org_id
	req := httptest.NewRequest("GET", "/api/v1/org/wrong-org/project", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}
