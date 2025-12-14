package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupInMemoryApp(t *testing.T) (*fiber.App, *gorm.DB) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&models.Organization{}, &models.Codebase{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	app := fiber.New()
	handler := &CodebaseVersionHandler{DB: db}
	app.Post("/api/v1/org/:org_id/codebase_version", handler.CreateCodebaseVersion)

	return app, db
}

func TestCreateServiceVersion(t *testing.T) {
	app, db := setupInMemoryApp(t)

	t.Run("should return 400 if request body is invalid", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/org/org123/codebase_version", bytes.NewBuffer([]byte("invalid json")))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("should return 404 if service is not found", func(t *testing.T) {

		body := CodebaseVersionRequest{
			CodebaseID: "nonexistent-service",
			BranchName: "main",
			CommitHash: "abc123",
		}
		bodyBytes, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/org/org123/codebase_version", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return 201 if service version is created successfully", func(t *testing.T) {

		org := models.Organization{
			ObjectID:         "org123",
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)

		service := models.Codebase{
			ObjectID:       "service123",
			OrganizationID: 1,
			ServiceName:    "Test Service",
		}
		assert.NoError(t, db.Create(&service).Error)

		body := CodebaseVersionRequest{
			CodebaseID: "service123",
			BranchName: "main",
			CommitHash: "abc123",
		}
		bodyBytes, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/org/org123/codebase_version", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	})
}
func TestGetServiceVersion(t *testing.T) {
	app, db := setupInMemoryApp(t)

	app.Get("/api/v1/org/:org_id/codebase_version/:service_version_id", (&CodebaseVersionHandler{DB: db}).GetCodebaseVersion)

	t.Run("should return 404 if service version is not found", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/org123/codebase_version/nonexistent-id", nil)
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("should return 200 and the service version if found", func(t *testing.T) {
		org := models.Organization{
			ObjectID:         "org123",
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)

		codebase := models.Codebase{
			ObjectID:       "service123",
			OrganizationID: 1,
			ServiceName:    "Test Service",
		}
		assert.NoError(t, db.Create(&codebase).Error)

		serviceVersion := models.CodebaseVersion{
			ObjectID:       "version123",
			OrganizationID: 1,
			BranchName:     "main",
			CommitHash:     "abc123",
			CodebaseID:     1,
		}
		assert.NoError(t, db.Create(&serviceVersion).Error)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/org123/codebase_version/version123", nil)
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusOK, resp.StatusCode)

		var response models.CodebaseVersion
		assert.NoError(t, json.NewDecoder(resp.Body).Decode(&response))
		assert.Equal(t, serviceVersion.ObjectID, response.ObjectID)
		assert.Equal(t, serviceVersion.OrganizationID, response.OrganizationID)
		assert.Equal(t, serviceVersion.BranchName, response.BranchName)
		assert.Equal(t, serviceVersion.CommitHash, response.CommitHash)
		assert.Equal(t, serviceVersion.CodebaseID, response.CodebaseID)
	})
}

// Can't really run this test because it has a snyc delete feature thing going on..
func TestDeleteServiceVersion(t *testing.T) {
	app, db := setupInMemoryApp(t)

	app.Delete("/api/v1/org/:org_id/codebase_version/:service_version_id", (&CodebaseVersionHandler{DB: db}).DeleteCodebaseVersion)

	t.Run("should return 204 if service version is deleted successfully", func(t *testing.T) {
		org := models.Organization{
			ObjectID:         "org123",
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)

		service := models.Codebase{
			ObjectID:       "service123",
			OrganizationID: 1,
			ServiceName:    "Test Service",
		}
		assert.NoError(t, db.Create(&service).Error)

		serviceVersion := models.CodebaseVersion{
			ObjectID:       "version123",
			OrganizationID: 1,
			BranchName:     "main",
			CommitHash:     "abc123",
			CodebaseID:     1,
		}
		assert.NoError(t, db.Create(&serviceVersion).Error)

		req := httptest.NewRequest(http.MethodDelete, "/api/v1/org/org123/codebase_version/version123", nil)
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusNoContent, resp.StatusCode)

		var count int64
		db.Model(&models.CodebaseVersion{}).Where("object_id = ?", "version123").Count(&count)
		assert.Equal(t, int64(0), count)
	})
}
