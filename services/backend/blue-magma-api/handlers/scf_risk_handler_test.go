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

func setupSCFRiskTestEnv(t *testing.T) (*gorm.DB, *SCFRiskHandler, *fiber.App) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.SCFRisk{}); err != nil {
		t.Fatalf("failed to migrate SCFRisk: %v", err)
	}

	handler := NewSCFRiskHandler(db)
	app := fiber.New()

	app.Get("/api/v1/public/frameworks/scf/risks", handler.List)
	app.Get("/api/v1/public/frameworks/scf/risks/:risk_id", handler.GetByID)

	return db, handler, app
}

func TestSCFRiskListAndFilters(t *testing.T) {
	db, _, app := setupSCFRiskTestEnv(t)

	// Seed a few risks
	risks := []models.SCFRisk{
		{ObjectID: "R-AC-1", Grouping: "Access Control", Title: "Inability to maintain accountability", Description: "desc1", NISTFunction: "Protect", Materiality: "Unknown"},
		{ObjectID: "R-AC-2", Grouping: "Access Control", Title: "Improper assignment of privileged functions", Description: "desc2", NISTFunction: "Protect", Materiality: ">= 5% of pre-tax income"},
		{ObjectID: "R-AM-1", Grouping: "Asset Management", Title: "Lost, damaged or stolen assets", Description: "desc3", NISTFunction: "Protect", Materiality: "Unknown"},
	}
	for _, r := range risks {
		assert.NoError(t, db.Create(&r).Error)
	}

	// Basic list with pagination
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/risks?limit=2&offset=0", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var listResp struct {
		Items  []SCFRiskView `json:"items"`
		Total  int64         `json:"total"`
		Pages  int           `json:"pages"`
		Limit  int           `json:"limit"`
		Offset int           `json:"offset"`
	}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 2)
	assert.EqualValues(t, 3, listResp.Total)
	assert.Equal(t, 2, listResp.Limit)
	assert.Equal(t, 0, listResp.Offset)

	// Filter by grouping
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/risks?grouping=Asset%20Management", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFRiskView `json:"items"`
		Total  int64         `json:"total"`
		Pages  int           `json:"pages"`
		Limit  int           `json:"limit"`
		Offset int           `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "R-AM-1", listResp.Items[0].ObjectID)

	// Filter by search query
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/risks?q=privileged", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	listResp = struct {
		Items  []SCFRiskView `json:"items"`
		Total  int64         `json:"total"`
		Pages  int           `json:"pages"`
		Limit  int           `json:"limit"`
		Offset int           `json:"offset"`
	}{}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&listResp))
	assert.Len(t, listResp.Items, 1)
	assert.Equal(t, "R-AC-2", listResp.Items[0].ObjectID)
}

func TestSCFRiskGetByID(t *testing.T) {
	db, _, app := setupSCFRiskTestEnv(t)

	risk := models.SCFRisk{
		ObjectID:     "R-AC-1",
		Grouping:     "Access Control",
		Title:        "Inability to maintain accountability",
		Description:  "desc1",
		NISTFunction: "Protect",
		Materiality:  "Unknown",
	}
	assert.NoError(t, db.Create(&risk).Error)

	// Existing risk
	req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/risks/R-AC-1", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var view SCFRiskView
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&view))
	assert.Equal(t, "R-AC-1", view.ObjectID)
	assert.Equal(t, "Access Control", view.Grouping)

	// Non-existent risk
	req, _ = http.NewRequest("GET", "/api/v1/public/frameworks/scf/risks/DOES-NOT-EXIST", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

