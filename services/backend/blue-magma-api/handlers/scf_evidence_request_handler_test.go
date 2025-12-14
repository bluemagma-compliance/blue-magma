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

func setupSCFEvidenceRequestTestEnv(t *testing.T) (*gorm.DB, *SCFEvidenceRequestHandler, *fiber.App) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.SCFEvidenceRequest{}); err != nil {
		t.Fatalf("failed to migrate SCFEvidenceRequest: %v", err)
	}

	handler := NewSCFEvidenceRequestHandler(db)
	app := fiber.New()

	app.Get("/api/v1/public/frameworks/scf/evidence-requests", handler.List)
	app.Get("/api/v1/public/frameworks/scf/evidence-requests/:erl_id", handler.GetByID)

	return db, handler, app
}

func TestSCFEvidenceRequestListAndFilters(t *testing.T) {
	db, _, app := setupSCFEvidenceRequestTestEnv(t)

	items := []models.SCFEvidenceRequest{
		{ObjectID: "E-GOV-01", AreaOfFocus: "Cybersecurity & Data Protection Management", Artifact: "Charter - Cybersecurity Program", Description: "desc1", ControlMappings: "GOV-01"},
		{ObjectID: "E-GOV-02", AreaOfFocus: "Cybersecurity & Data Protection Management", Artifact: "Charter - Data Privacy Program", Description: "desc2", ControlMappings: "GOV-01\nPRI-01"},
		{ObjectID: "E-AST-01", AreaOfFocus: "Asset Management", Artifact: "Asset Inventory", Description: "desc3", ControlMappings: "AST-01"},
	}
	for _, it := range items {
		assert.NoError(t, db.Create(&it).Error)
	}

	// Basic list with pagination
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/evidence-requests?limit=2&offset=0", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var listResp struct {
		Items  []SCFEvidenceRequestView `json:"items"`
		Total  int64                    `json:"total"`
		Pages  int                      `json:"pages"`
		Limit  int                      `json:"limit"`
		Offset int                      `json:"offset"`
	}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 2)
	assert.EqualValues(t, 3, listResp.Total)
	assert.Equal(t, 2, listResp.Limit)
	assert.Equal(t, 0, listResp.Offset)

	// Filter by area_of_focus
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/evidence-requests?area_of_focus=Asset%20Management", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFEvidenceRequestView `json:"items"`
		Total  int64                    `json:"total"`
		Pages  int                      `json:"pages"`
		Limit  int                      `json:"limit"`
		Offset int                      `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "E-AST-01", listResp.Items[0].ObjectID)

	// Filter by control mapping
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/evidence-requests?control=PRI-01", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFEvidenceRequestView `json:"items"`
		Total  int64                    `json:"total"`
		Pages  int                      `json:"pages"`
		Limit  int                      `json:"limit"`
		Offset int                      `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "E-GOV-02", listResp.Items[0].ObjectID)

	// Filter by search query
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/evidence-requests?q=Inventory", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFEvidenceRequestView `json:"items"`
		Total  int64                    `json:"total"`
		Pages  int                      `json:"pages"`
		Limit  int                      `json:"limit"`
		Offset int                      `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "E-AST-01", listResp.Items[0].ObjectID)
}

func TestSCFEvidenceRequestGetByID(t *testing.T) {
	db, _, app := setupSCFEvidenceRequestTestEnv(t)

	item := models.SCFEvidenceRequest{
		ObjectID:    "E-GOV-01",
		AreaOfFocus: "Cybersecurity & Data Protection Management",
		Artifact:    "Charter - Cybersecurity Program",
		Description: "desc1",
	}
	assert.NoError(t, db.Create(&item).Error)

	// Existing
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/evidence-requests/E-GOV-01", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var view SCFEvidenceRequestView
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&view))
	assert.Equal(t, "E-GOV-01", view.ObjectID)
	assert.Equal(t, "Cybersecurity & Data Protection Management", view.AreaOfFocus)

	// Non-existent
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/evidence-requests/DOES-NOT-EXIST", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

