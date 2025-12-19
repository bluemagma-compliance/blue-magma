package handlers

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/datatypes"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAuditReportTestDB() (*gorm.DB, models.Organization, models.Project, models.Auditor) {
	db, _ := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	db.AutoMigrate(&models.Organization{}, &models.Project{}, &models.Auditor{}, &models.AuditReport{})

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

	auditor := models.Auditor{
		ObjectID:       "auditor-1",
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		Name:           "Test Auditor",
		Instructions:   datatypes.JSON(json.RawMessage(`{"requirements": []}`)),
	}
	db.Create(&auditor)

	return db, org, project, auditor
}

func TestGetAuditReports_EmptyList(t *testing.T) {
	db, org, project, auditor := setupAuditReportTestDB()
	app := fiber.New()
	handler := NewAuditReportHandler(db)

	app.Get("/api/v1/org/:org_id/project/:project_id/auditor/:auditor_id/report", handler.GetAuditReports)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor/"+auditor.ObjectID+"/report", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response struct {
		Items  []AuditReportResponse `json:"items"`
		Total  int64                 `json:"total"`
		Pages  int                   `json:"pages"`
		Limit  int                   `json:"limit"`
		Offset int                   `json:"offset"`
	}
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.NotNil(t, response.Items)
	assert.Equal(t, 0, len(response.Items))
	assert.Equal(t, int64(0), response.Total)
	assert.Equal(t, 0, response.Pages)
	assert.Equal(t, 50, response.Limit)
	assert.Equal(t, 0, response.Offset)
}

func TestGetAuditReports_Pagination(t *testing.T) {
	db, org, project, auditor := setupAuditReportTestDB()
	app := fiber.New()
	handler := NewAuditReportHandler(db)

	// Create multiple reports
	for i := 0; i < 3; i++ {
		results := datatypes.JSON(json.RawMessage(`{"requirements": []}`))
		report := models.AuditReport{
			ObjectID:       fmt.Sprintf("report-%d", i+1),
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			AuditorID:      auditor.ID,
			Status:         "passed",
			Score:          95,
			Results:        results,
			ExecutedAt:     time.Now(),
			ExecutedBy:     "manual",
			Duration:       10,
		}
		db.Create(&report)
	}

	app.Get("/api/v1/org/:org_id/project/:project_id/auditor/:auditor_id/report", handler.GetAuditReports)

	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/auditor/"+auditor.ObjectID+"/report?limit=2&offset=1", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response struct {
		Items  []AuditReportResponse `json:"items"`
		Total  int64                 `json:"total"`
		Pages  int                   `json:"pages"`
		Limit  int                   `json:"limit"`
		Offset int                   `json:"offset"`
	}
	err := json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, int64(3), response.Total)
	assert.Equal(t, 2, response.Pages)
	assert.Equal(t, 2, response.Limit)
	assert.Equal(t, 1, response.Offset)
	assert.Equal(t, 2, len(response.Items))
}
