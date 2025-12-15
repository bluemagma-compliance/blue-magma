package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/datatypes"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAuditorTestDB() (*gorm.DB, models.Organization, models.Project) {
	db, _ := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	db.AutoMigrate(&models.Organization{}, &models.Project{}, &models.Document{}, &models.Auditor{})

	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	project := models.Project{
		ObjectID:       "test-project",
		OrganizationID: org.ID,
		Name:           "Test Project",
		Description:    "Test project description",
		Status:         "active",
	}
	db.Create(&project)

	return db, org, project
}

func TestGetDocumentAuditors_ByDocument(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	// Create a document in the project
	doc := models.Document{
		ObjectID:       "doc-1",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Title:          "Control Document",
		TemplatePageID: "control-SCF-AC-1",
	}
	db.Create(&doc)

	// Auditor that targets this document
	instForDoc := json.RawMessage(`{"requirements": [], "passing_score": 80, "targets": [{"control_id": "SCF-AC-1", "document_object_id": "doc-1"}]}`)
	auditorForDoc := models.Auditor{
		ObjectID:       "auditor-doc-1",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           "Auditor For Doc",
		Instructions:   datatypes.JSON(instForDoc),
	}
	db.Create(&auditorForDoc)

	// Auditor that targets a different document
	instOther := json.RawMessage(`{"requirements": [], "passing_score": 80, "targets": [{"control_id": "SCF-AC-2", "document_object_id": "other-doc"}]}`)
	auditorOther := models.Auditor{
		ObjectID:       "auditor-other",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           "Auditor Other",
		Instructions:   datatypes.JSON(instOther),
	}
	db.Create(&auditorOther)

	app.Get("/api/v1/org/:org_id/project/:project_id/document/:document_id/auditor", handler.GetDocumentAuditors)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/document/"+doc.ObjectID+"/auditor", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var body struct {
		Auditors []AuditorResponse `json:"auditors"`
	}
	err := json.NewDecoder(resp.Body).Decode(&body)
	assert.NoError(t, err)
	if assert.Len(t, body.Auditors, 1) {
		assert.Equal(t, "Auditor For Doc", body.Auditors[0].Name)
	}
}

func TestGetAuditors_EmptyList(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	app.Get("/api/v1/org/:org_id/project/:project_id/auditor", handler.GetAuditors)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response struct {
		Items  []AuditorResponse `json:"items"`
		Total  int64             `json:"total"`
		Pages  int               `json:"pages"`
		Limit  int               `json:"limit"`
		Offset int               `json:"offset"`
	}
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.NotNil(t, response.Items, "Items should not be nil")
	assert.Equal(t, 0, len(response.Items), "Items should be an empty array when no auditors exist")
	assert.Equal(t, int64(0), response.Total)
	assert.Equal(t, 0, response.Pages)
	assert.Equal(t, 50, response.Limit)
	assert.Equal(t, 0, response.Offset)
}

func TestGetAuditors_WithAuditors(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	// Create test auditor
	instructions := json.RawMessage(`{"requirements": [{"id": "test-1", "title": "Test Requirement"}], "passing_score": 80}`)
	auditor := models.Auditor{
		ObjectID:       "auditor-1",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           "Test Auditor",
		Description:    "Test auditor description",
		Schedule:       "0 0 * * *",
		IsActive:       true,
		Instructions:   datatypes.JSON(instructions),
	}
	db.Create(&auditor)

	app.Get("/api/v1/org/:org_id/project/:project_id/auditor", handler.GetAuditors)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response struct {
		Items  []AuditorResponse `json:"items"`
		Total  int64             `json:"total"`
		Pages  int               `json:"pages"`
		Limit  int               `json:"limit"`
		Offset int               `json:"offset"`
	}
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), response.Total)
	assert.Equal(t, 1, response.Pages)
	assert.Equal(t, 50, response.Limit)
	assert.Equal(t, 0, response.Offset)
	if assert.Equal(t, 1, len(response.Items)) {
		assert.Equal(t, "Test Auditor", response.Items[0].Name)
		assert.Equal(t, "Test auditor description", response.Items[0].Description)
		assert.Equal(t, "0 0 * * *", response.Items[0].Schedule)
		assert.True(t, response.Items[0].IsActive)
	}
}

func TestGetAuditors_PaginationLimitOffset(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	// Create multiple auditors
	for i := 0; i < 3; i++ {
		instructions := json.RawMessage(`{"requirements": [], "passing_score": 80}`)
		auditor := models.Auditor{
			ObjectID:       fmt.Sprintf("auditor-%d", i+1),
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			Name:           fmt.Sprintf("Auditor %d", i+1),
			Instructions:   datatypes.JSON(instructions),
		}
		db.Create(&auditor)
	}

	app.Get("/api/v1/org/:org_id/project/:project_id/auditor", handler.GetAuditors)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor?limit=2&offset=1", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response struct {
		Items  []AuditorResponse `json:"items"`
		Total  int64             `json:"total"`
		Pages  int               `json:"pages"`
		Limit  int               `json:"limit"`
		Offset int               `json:"offset"`
	}
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, int64(3), response.Total)
	assert.Equal(t, 2, response.Pages)
	assert.Equal(t, 2, response.Limit)
	assert.Equal(t, 1, response.Offset)
	assert.Equal(t, 2, len(response.Items))
}

func TestGetAuditor_Success(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	// Create test auditor
	instructions := json.RawMessage(`{"requirements": [{"id": "test-1", "title": "Test Requirement"}], "passing_score": 80}`)
	auditor := models.Auditor{
		ObjectID:       "auditor-1",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           "Test Auditor",
		Description:    "Test auditor description",
		Schedule:       "0 0 * * *",
		IsActive:       true,
		Instructions:   datatypes.JSON(instructions),
	}
	db.Create(&auditor)

	app.Get("/api/v1/org/:org_id/project/:project_id/auditor/:auditor_id", handler.GetAuditor)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor/"+auditor.ObjectID, nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response AuditorResponse
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, "Test Auditor", response.Name)
	assert.Equal(t, project.ObjectID, response.ProjectID)
}

func TestGetAuditor_NotFound(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	app.Get("/api/v1/org/:org_id/project/:project_id/auditor/:auditor_id", handler.GetAuditor)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor/nonexistent", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

func TestCreateAuditor_Success(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	app.Post("/api/v1/org/:org_id/project/:project_id/auditor", handler.CreateAuditor)

	instructions := json.RawMessage(`{"requirements": [{"id": "test-1", "title": "Test Requirement"}], "passing_score": 80}`)
	requestBody := AuditorRequest{
		Name:         "New Auditor",
		Description:  "New auditor description",
		Schedule:     "0 0 * * *",
		Instructions: instructions,
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	var response AuditorResponse
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, "New Auditor", response.Name)
	assert.Equal(t, "New auditor description", response.Description)
	assert.NotEmpty(t, response.ObjectID)
}

func TestCreateAuditor_MissingName(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	app.Post("/api/v1/org/:org_id/project/:project_id/auditor", handler.CreateAuditor)

	instructions := json.RawMessage(`{"requirements": []}`)
	requestBody := AuditorRequest{
		Description:  "Missing name",
		Instructions: instructions,
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

func TestCreateAuditor_MissingInstructions(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	app.Post("/api/v1/org/:org_id/project/:project_id/auditor", handler.CreateAuditor)

	requestBody := AuditorRequest{
		Name:        "Test Auditor",
		Description: "Missing instructions",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
}

func TestUpdateAuditor_Success(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	// Create initial auditor
	instructions := json.RawMessage(`{"requirements": [{"id": "test-1", "title": "Test Requirement"}], "passing_score": 80}`)
	auditor := models.Auditor{
		ObjectID:       "auditor-1",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           "Original Name",
		Description:    "Original Description",
		Schedule:       "0 0 * * *",
		IsActive:       true,
		Instructions:   datatypes.JSON(instructions),
	}
	db.Create(&auditor)

	app.Put("/api/v1/org/:org_id/project/:project_id/auditor/:auditor_id", handler.UpdateAuditor)

	updatedInstructions := json.RawMessage(`{"requirements": [{"id": "test-2", "title": "Updated Requirement"}], "passing_score": 90}`)
	requestBody := AuditorRequest{
		Name:         "Updated Name",
		Description:  "Updated Description",
		Schedule:     "0 0 1 * *",
		Instructions: updatedInstructions,
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("PUT", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor/"+auditor.ObjectID, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response AuditorResponse
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", response.Name)
	assert.Equal(t, "Updated Description", response.Description)
	assert.Equal(t, "0 0 1 * *", response.Schedule)
}

func TestDeleteAuditor_Success(t *testing.T) {
	db, org, project := setupAuditorTestDB()
	app := fiber.New()
	handler := NewAuditorHandler(db)

	// Create auditor to delete
	instructions := json.RawMessage(`{"requirements": []}`)
	auditor := models.Auditor{
		ObjectID:       "auditor-1",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           "To Delete",
		Instructions:   datatypes.JSON(instructions),
	}
	db.Create(&auditor)

	app.Delete("/api/v1/org/:org_id/project/:project_id/auditor/:auditor_id", handler.DeleteAuditor)

	req := httptest.NewRequest("DELETE", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor/"+auditor.ObjectID, nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNoContent, resp.StatusCode)

	// Verify deletion
	var deletedAuditor models.Auditor
	err := db.Where("object_id = ?", auditor.ObjectID).First(&deletedAuditor).Error
	assert.Error(t, err)
	assert.Equal(t, gorm.ErrRecordNotFound, err)
}
