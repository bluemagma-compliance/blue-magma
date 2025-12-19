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

func TestActionableItemHandler(t *testing.T) {
	// Setup in-memory database without foreign key constraints for simpler testing
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Organization{}, &models.ReportTemplate{}, &models.Report{},
		&models.ReportSection{}, &models.Rule{}, &models.Ruling{}, &models.ActionableItem{},
		&models.SubjectType{}, &models.Codebase{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create test report template
	template := models.ReportTemplate{
		ObjectID:       "test-template",
		OrganizationID: org.ID,
		Name:           "Test Template",
		Description:    "Test template description",
	}
	err = db.Create(&template).Error
	assert.NoError(t, err)

	// Create test report
	report := models.Report{
		ObjectID:         "test-report",
		OrganizationID:   org.ID,
		Name:             "Test Report",
		ReportTemplateID: template.ID,
	}
	err = db.Create(&report).Error
	assert.NoError(t, err)

	// Create test report section
	section := models.ReportSection{
		ObjectID:       "test-section",
		OrganizationID: org.ID,
		Name:           "Test Section",
		ReportID:       report.ID,
	}
	err = db.Create(&section).Error
	assert.NoError(t, err)

	// Create test rule
	rule := models.Rule{
		ObjectID:       "test-rule",
		OrganizationID: org.ID,
		Name:           "Test Rule",
		Description:    "Test rule description",
	}
	err = db.Create(&rule).Error
	assert.NoError(t, err)

	// Create subject type for codebase
	subjectType := models.SubjectType{
		ObjectID:    "codebase",
		Name:        "Codebase",
		Description: "Codebase type",
		Category:    "codebase",
	}
	err = db.Create(&subjectType).Error
	assert.NoError(t, err)

	// Create test codebase
	codebase := models.Codebase{
		ObjectID:           "test-codebase",
		OrganizationID:     org.ID,
		ServiceName:        "test-service",
		ServiceRepoURL:     "https://github.com/test/repo",
		ServiceDescription: "Test service",
		SubjectTypeID:      subjectType.ID,
	}
	err = db.Create(&codebase).Error
	assert.NoError(t, err)

	// Create test codebase version
	codebaseVersion := models.CodebaseVersion{
		ObjectID:       "test-codebase-version",
		OrganizationID: org.ID,
		CodebaseID:     codebase.ID,
		BranchName:     "main",
		CommitHash:     "abc123",
		IngestStatus:   "completed",
	}
	err = db.Create(&codebaseVersion).Error
	assert.NoError(t, err)

	// Create test ruling
	ruling := models.Ruling{
		ObjectID:           "test-ruling",
		OrganizationID:     org.ID,
		RuleID:             rule.ID,
		CodebaseVersionID:  codebaseVersion.ID,
		ReportSectionID:    section.ID,
		Decision:           "non-compliant",
		Reasoning:          "Test reasoning",
	}
	err = db.Create(&ruling).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewActionableItemHandler(db)

	// Define the routes
	app.Post("/api/v1/org/:org_id/actionable-item/", handler.CreateActionableItem)
	app.Get("/api/v1/org/:org_id/actionable-item/:item_id", handler.GetActionableItem)
	app.Get("/api/v1/org/:org_id/actionable-item/", handler.GetActionableItems)
	app.Put("/api/v1/org/:org_id/actionable-item/:item_id", handler.UpdateActionableItem)
	app.Delete("/api/v1/org/:org_id/actionable-item/:item_id", handler.DeleteActionableItem)

	t.Run("Create actionable item successfully", func(t *testing.T) {
		// Prepare request payload
		request := ActionableItemRequest{
			RulingID:    "test-ruling",
			Title:       "Critical Security Issue",
			Description: "SQL injection vulnerability found",
			Severity:    "critical",
			Priority:    "high",
			ProblemType: "security",
			ProposedFix: "Use parameterized queries",
			FilePath:    "/src/database/queries.go",
			LineNumber:  func() *int { i := 42; return &i }(),
			Status:      "open",
		}
		body, _ := json.Marshal(request)

		// Create test request
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/actionable-item/", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 201, resp.StatusCode)

		var response ActionableItemResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "test-ruling", response.RulingID)
		assert.Equal(t, "Critical Security Issue", response.Title)
		assert.Equal(t, "critical", response.Severity)
		assert.Equal(t, "high", response.Priority)
		assert.Equal(t, "security", response.ProblemType)
		assert.Equal(t, "Use parameterized queries", response.ProposedFix)
		assert.Equal(t, "/src/database/queries.go", response.FilePath)
		if response.LineNumber != nil {
			assert.Equal(t, 42, *response.LineNumber)
		} else {
			t.Error("LineNumber should not be nil")
		}
		assert.Equal(t, "open", response.Status)
	})

	t.Run("Get actionable item successfully", func(t *testing.T) {
		// First create an actionable item
		item := models.ActionableItem{
			ObjectID:       "test-item",
			OrganizationID: org.ID,
			RulingID:       ruling.ID,
			Title:          "Test Item",
			Description:    "Test description",
			Severity:       "medium",
			Priority:       "medium",
			ProblemType:    "compliance",
			Status:         "open",
		}
		err = db.Create(&item).Error
		assert.NoError(t, err)

		// Create test request
		req := httptest.NewRequest("GET", "/api/v1/org/test-org/actionable-item/test-item", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response ActionableItemResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "test-item", response.ObjectID)
		assert.Equal(t, "Test Item", response.Title)
		assert.Equal(t, "medium", response.Severity)
		assert.Equal(t, "compliance", response.ProblemType)
	})

	t.Run("Get actionable items with filters", func(t *testing.T) {
		// Create test request with severity filter
		req := httptest.NewRequest("GET", "/api/v1/org/test-org/actionable-item/?severity=critical", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response []ActionableItemResponse
		json.NewDecoder(resp.Body).Decode(&response)

		// Should return items with critical severity
		for _, item := range response {
			assert.Equal(t, "critical", item.Severity)
		}
	})

	t.Run("Update actionable item successfully", func(t *testing.T) {
		// Prepare update request
		newStatus := "in_progress"
		newAssignedTo := "john.doe@example.com"
		request := ActionableItemUpdateRequest{
			Status:     &newStatus,
			AssignedTo: &newAssignedTo,
		}
		body, _ := json.Marshal(request)

		// Create test request
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/actionable-item/test-item", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response ActionableItemResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "in_progress", response.Status)
		assert.Equal(t, "john.doe@example.com", response.AssignedTo)
	})

	t.Run("Delete actionable item successfully", func(t *testing.T) {
		// Create test request
		req := httptest.NewRequest("DELETE", "/api/v1/org/test-org/actionable-item/test-item", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 204, resp.StatusCode)

		// Verify item is deleted
		var count int64
		db.Model(&models.ActionableItem{}).Where("object_id = ? AND organization_id = ?", "test-item", org.ID).Count(&count)
		assert.Equal(t, int64(0), count)
	})

	t.Run("Create actionable item with invalid ruling", func(t *testing.T) {
		// Prepare request payload with invalid ruling ID
		request := ActionableItemRequest{
			RulingID:    "invalid-ruling",
			Title:       "Test Item",
			Severity:    "medium",
			Priority:    "medium",
			ProblemType: "compliance",
			Status:      "open",
		}
		body, _ := json.Marshal(request)

		// Create test request
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/actionable-item/", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response - just check status code since Fiber error handling in tests can be tricky
		assert.Equal(t, 404, resp.StatusCode)
	})
}
