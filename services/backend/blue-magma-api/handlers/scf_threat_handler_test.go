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

func setupSCFThreatTestEnv(t *testing.T) (*gorm.DB, *SCFThreatHandler, *fiber.App) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.SCFThreat{}); err != nil {
		t.Fatalf("failed to migrate SCFThreat: %v", err)
	}

	handler := NewSCFThreatHandler(db)
	app := fiber.New()

	app.Get("/api/v1/public/frameworks/scf/threats", handler.List)
	app.Get("/api/v1/public/frameworks/scf/threats/:threat_id", handler.GetByID)

	return db, handler, app
}

func TestSCFThreatListAndFilters(t *testing.T) {
	db, _, app := setupSCFThreatTestEnv(t)

	threats := []models.SCFThreat{
		{ObjectID: "NT-1", Grouping: "Natural Threat", Title: "Drought & Water Shortage", Description: "desc1", Materiality: "Unknown"},
		{ObjectID: "NT-2", Grouping: "Natural Threat", Title: "Earthquakes", Description: "desc2", Materiality: ">= 5% of pre-tax income"},
		{ObjectID: "HT-1", Grouping: "Human Threat", Title: "Insider Threat", Description: "desc3", Materiality: "Unknown"},
	}
	for _, th := range threats {
		assert.NoError(t, db.Create(&th).Error)
	}

	// Basic list with pagination
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/threats?limit=2&offset=0", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var listResp struct {
		Items  []SCFThreatView `json:"items"`
		Total  int64           `json:"total"`
		Pages  int             `json:"pages"`
		Limit  int             `json:"limit"`
		Offset int             `json:"offset"`
	}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 2)
	assert.EqualValues(t, 3, listResp.Total)
	assert.Equal(t, 2, listResp.Limit)
	assert.Equal(t, 0, listResp.Offset)

	// Filter by grouping
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/threats?grouping=Human%20Threat", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFThreatView `json:"items"`
		Total  int64           `json:"total"`
		Pages  int             `json:"pages"`
		Limit  int             `json:"limit"`
		Offset int             `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "HT-1", listResp.Items[0].ObjectID)

	// Filter by search query
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/threats?q=Earthquakes", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFThreatView `json:"items"`
		Total  int64           `json:"total"`
		Pages  int             `json:"pages"`
		Limit  int             `json:"limit"`
		Offset int             `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "NT-2", listResp.Items[0].ObjectID)
}

func TestSCFThreatGetByID(t *testing.T) {
	db, _, app := setupSCFThreatTestEnv(t)

	th := models.SCFThreat{
		ObjectID:    "NT-1",
		Grouping:    "Natural Threat",
		Title:       "Drought & Water Shortage",
		Description: "desc1",
		Materiality: "Unknown",
	}
	assert.NoError(t, db.Create(&th).Error)

	// Existing threat
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/threats/NT-1", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var view SCFThreatView
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&view))
	assert.Equal(t, "NT-1", view.ObjectID)
	assert.Equal(t, "Natural Threat", view.Grouping)

	// Non-existent threat
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/threats/DOES-NOT-EXIST", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

