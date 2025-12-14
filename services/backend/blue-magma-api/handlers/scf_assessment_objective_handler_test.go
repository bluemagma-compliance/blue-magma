package handlers

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSCFAssessmentObjectiveTestEnv(t *testing.T) (*gorm.DB, *SCFAssessmentObjectiveHandler, *fiber.App) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.SCFAssessmentObjective{}); err != nil {
		t.Fatalf("failed to migrate SCFAssessmentObjective: %v", err)
	}

	handler := NewSCFAssessmentObjectiveHandler(db)
	app := fiber.New()

	app.Get("/api/v1/public/frameworks/scf/assessment-objectives", handler.List)
	app.Get("/api/v1/public/frameworks/scf/assessment-objectives/:ao_id", handler.GetByID)

	return db, handler, app
}

func TestSCFAssessmentObjectiveListAndFilters(t *testing.T) {
	db, _, app := setupSCFAssessmentObjectiveTestEnv(t)

	items := []models.SCFAssessmentObjective{
		{ObjectID: "AAT-01_A01", ControlMappings: "AAT-01", Statement: "AI policies defined", Origin: "SCF Created", IsSCFBaseline: true},
		{ObjectID: "AAT-01_A02", ControlMappings: "AAT-01\nPRI-01", Statement: "AI controls implemented", Origin: "SCF Created", IsSCFBaseline: true},
		{ObjectID: "GOV-01_A01", ControlMappings: "GOV-01", Statement: "Governance structure defined", Origin: "Other Origin", IsSCFBaseline: false},
	}
	for _, it := range items {
		assert.NoError(t, db.Create(&it).Error)
	}

	// Basic list with pagination
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/assessment-objectives?limit=2&offset=0", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var listResp struct {
		Items  []SCFAssessmentObjectiveView `json:"items"`
		Total  int64                        `json:"total"`
		Pages  int                          `json:"pages"`
		Limit  int                          `json:"limit"`
		Offset int                          `json:"offset"`
	}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 2)
	assert.EqualValues(t, 3, listResp.Total)
	assert.Equal(t, 2, listResp.Limit)
	assert.Equal(t, 0, listResp.Offset)

	// Filter by control mapping
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/assessment-objectives?control=PRI-01", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFAssessmentObjectiveView `json:"items"`
		Total  int64                        `json:"total"`
		Pages  int                          `json:"pages"`
		Limit  int                          `json:"limit"`
		Offset int                          `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "AAT-01_A02", listResp.Items[0].ObjectID)

	// Filter by baseline=true
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/assessment-objectives?baseline=true", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFAssessmentObjectiveView `json:"items"`
		Total  int64                        `json:"total"`
		Pages  int                          `json:"pages"`
		Limit  int                          `json:"limit"`
		Offset int                          `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 2)

	// Filter by baseline=false
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/assessment-objectives?baseline=false", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFAssessmentObjectiveView `json:"items"`
		Total  int64                        `json:"total"`
		Pages  int                          `json:"pages"`
		Limit  int                          `json:"limit"`
		Offset int                          `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "GOV-01_A01", listResp.Items[0].ObjectID)

	// Filter by search query
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/assessment-objectives?q=Governance", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFAssessmentObjectiveView `json:"items"`
		Total  int64                        `json:"total"`
		Pages  int                          `json:"pages"`
		Limit  int                          `json:"limit"`
		Offset int                          `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "GOV-01_A01", listResp.Items[0].ObjectID)
}

func TestSCFAssessmentObjectiveGetByID(t *testing.T) {
	db, _, app := setupSCFAssessmentObjectiveTestEnv(t)

	item := models.SCFAssessmentObjective{
		ObjectID:        "AAT-01_A01",
		ControlMappings: "AAT-01",
		Statement:       "AI policies defined",
		Origin:          "SCF Created",
		IsSCFBaseline:   true,
	}
	assert.NoError(t, db.Create(&item).Error)

	// Existing
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/assessment-objectives/AAT-01_A01", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var view SCFAssessmentObjectiveView
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&view))
	assert.Equal(t, "AAT-01_A01", view.ObjectID)
	assert.Equal(t, "AAT-01", view.ControlMappings)
	assert.True(t, view.IsSCFBaseline)

	// Non-existent
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/assessment-objectives/DOES-NOT-EXIST", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

