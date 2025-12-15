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

func TestGetLastCommitHash(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Organization{}, &models.APIKey{}, &models.SubjectType{}, &models.Codebase{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create subject type
	subjectType := models.SubjectType{
		ObjectID:    "codebase",
		Name:        "Codebase",
		Description: "Codebase type",
		Category:    "codebase",
	}
	err = db.Create(&subjectType).Error
	assert.NoError(t, err)

	// Create API key
	apiKey := models.APIKey{
		ObjectID:       "test-api-key",
		Name:           "Test API Key",
		OrganizationID: org.ID,
		Enabled:        true,
		Key:            "test-key-123",
	}
	err = db.Create(&apiKey).Error
	assert.NoError(t, err)

	// Create test codebase with repo name as service name
	codebase := models.Codebase{
		ObjectID:           "test-codebase",
		OrganizationID:     org.ID,
		ServiceName:        "backend", // This is the repo name that will be sent in RPC requests
		ServiceRepoURL:     "https://github.com/user/backend",
		ServiceDescription: "Test backend service",
		APIKeyID:           apiKey.ID,
		SubjectTypeID:      subjectType.ID,
	}
	err = db.Create(&codebase).Error
	assert.NoError(t, err)

	// Create test codebase version
	version := models.CodebaseVersion{
		ObjectID:       "test-codebase_main",
		OrganizationID: org.ID,
		CodebaseID:     codebase.ID,
		BranchName:     "main",
		CommitHash:     "abc123def456",
	}
	err = db.Create(&version).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewRPCHandler(db, nil) // Redis client not needed for this test

	// Define the route
	app.Post("/api/v1/org/:org_id/rpc/get-last-commit-hash/", handler.GetLastCommitHash)

	t.Run("Successful lookup with repo name", func(t *testing.T) {
		// Prepare request payload with repo name (not full URL)
		request := GetLastHashRequest{
			RepoUrl:    "backend", // This is what the RPC client sends
			BranchName: "main",
		}
		body, _ := json.Marshal(request)

		// Create test request with API key header
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/rpc/get-last-commit-hash/", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "APIKey test-key-123")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response GetLastHashResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "abc123def456", response.LastCommitHash)
	})

	t.Run("Codebase not found with wrong repo name", func(t *testing.T) {
		// Prepare request payload with wrong repo name
		request := GetLastHashRequest{
			RepoUrl:    "nonexistent", // This repo doesn't exist
			BranchName: "main",
		}
		body, _ := json.Marshal(request)

		// Create test request with API key header
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/rpc/get-last-commit-hash/", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "APIKey test-key-123")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 404, resp.StatusCode)

		var response map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Codebase not found", response["error"])
	})
}

func TestGenerateComprehensiveReport(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Organization{}, &models.APIKey{}, &models.SubjectType{}, &models.Codebase{}, &models.CodebaseVersion{}, &models.ReportTemplate{})
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

	// Create dependencies: SubjectType, APIKey, Codebase, CodebaseVersion
	subjectType := models.SubjectType{
		ObjectID:    "codebase",
		Name:        "Codebase",
		Description: "Codebase type",
		Category:    "codebase",
	}
	err = db.Create(&subjectType).Error
	assert.NoError(t, err)

	apiKey := models.APIKey{
		ObjectID:       "test-api-key",
		Name:           "Test API Key",
		OrganizationID: org.ID,
		Enabled:        true,
		Key:            "test-key-123",
	}
	err = db.Create(&apiKey).Error
	assert.NoError(t, err)

	codebase := models.Codebase{
		ObjectID:           "test-codebase",
		OrganizationID:     org.ID,
		ServiceName:        "backend",
		ServiceRepoURL:     "https://github.com/user/backend",
		ServiceDescription: "Test backend service",
		APIKeyID:           apiKey.ID,
		SubjectTypeID:      subjectType.ID,
	}
	err = db.Create(&codebase).Error
	assert.NoError(t, err)

	version := models.CodebaseVersion{
		ObjectID:       "cbv-1",
		OrganizationID: org.ID,
		CodebaseID:     codebase.ID,
		BranchName:     "main",
		CommitHash:     "abc123",
	}
	err = db.Create(&version).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewRPCHandler(db, nil) // Redis client not needed for this test

	// Define the route
	app.Post("/api/v1/org/:org_id/rpc/generate-report/", handler.GenerateReport)

	t.Run("Valid request structure", func(t *testing.T) {
		// Prepare request payload
		request := ReportGenerationRequest{
			TemplateID:        "test-template",
			CodebaseVersionID: "cbv-1",
			ReportName:        "Test Report",
			ReportDescription: "Test report description",
		}
		body, _ := json.Marshal(request)

		// Create test request
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/rpc/generate-report/", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		if err != nil || resp == nil {
			// Expected: network failure because the-council service is not available in unit tests
			return
		}
		// Should return 500 when the-council is unreachable
		assert.Equal(t, 500, resp.StatusCode)
		var response map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&response)
		// Should fail with connection error, not validation error
		assert.Contains(t, response["error"], "Failed to initiate report generation")
	})

	t.Run("Missing template ID", func(t *testing.T) {
		// Prepare request payload without template ID but with a valid codebase version to reach template validation
		request := ReportGenerationRequest{
			CodebaseVersionID: "cbv-1",
			ReportName:        "Test Report",
			ReportDescription: "Test report description",
		}
		body, _ := json.Marshal(request)

		// Create test request
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/rpc/generate-report/", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Should fail with template not found error
		assert.Equal(t, 404, resp.StatusCode)

		var response map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&response)
		assert.Equal(t, "Report template not found", response["error"])
	})

	t.Run("Invalid organization", func(t *testing.T) {
		// Prepare request payload
		request := ReportGenerationRequest{
			TemplateID:        "test-template",
			CodebaseVersionID: "cbv-1",
		}
		body, _ := json.Marshal(request)

		// Create test request with invalid org ID
		req := httptest.NewRequest("POST", "/api/v1/org/invalid-org/rpc/generate-report/", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Should fail with organization not found error
		assert.Equal(t, 404, resp.StatusCode)

		var response map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&response)
		assert.Equal(t, "Organization not found", response["error"])
	})
}
