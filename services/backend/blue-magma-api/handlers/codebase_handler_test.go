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

func TestCreateService(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Organization{}, &models.APIKey{}, &models.Rule{}, &models.SubjectType{}, &models.Codebase{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	// creat an organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// create a dummy exploratory-rule
	exploratoryRule := models.Rule{
		ObjectID:       "exploratory-rule",
		OrganizationID: 1,
		Name:           "Exploratory Rule",
		Description:    "A rule for exploratory testing",
		Scope:          "exploratory",
		PolicyVersion:  "1.0",
	}
	// Save the exploratory rule to the database
	err = db.Create(&exploratoryRule).Error
	assert.NoError(t, err)

	subjectType := models.SubjectType{
		ObjectID:    "codebase",
		Name:        "codebase",
		Description: "A test subject type",
		Category:    "codebase",
	}
	// Save the subject type to the database
	err = db.Create(&subjectType).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewCodebaseHandler(db)

	// Define the route
	app.Post("/api/v1/org/:org_id/codebase", handler.CreateCodebase)

	t.Run("Successful service creation", func(t *testing.T) {
		// Prepare request payload
		serviceRequest := CodebaseRequest{
			CodebaseName:        "Test Service",
			CodebaseRepoURL:     "https://github.com/example/test-codebase",
			CodebaseDescription: "A test service",
			CodebaseType:        "codebase",
		}
		body, _ := json.Marshal(serviceRequest)

		// Create test request
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/codebase", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 201, resp.StatusCode)

		var response CodebaseResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "test-codebase", response.CodebaseName) // Now uses extracted repo name
		assert.Equal(t, "https://github.com/example/test-codebase", response.CodebaseRepoURL)
		assert.Equal(t, "A test service", response.CodebaseDescription)
	})

	t.Run("Invalid request payload", func(t *testing.T) {
		// Create test request with invalid payload
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/codebase", bytes.NewReader([]byte("invalid")))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 400, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Invalid request", response["error"])
	})

}
func TestGetServices(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Organization{}, &models.APIKey{}, &models.Codebase{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	// creat an organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewCodebaseHandler(db)

	// Define the route
	app.Get("/api/v1/org/:org_id/codebase", handler.GetCodebases)

	t.Run("Successful retrieval of services", func(t *testing.T) {
		// Seed the database with test data
		testServices := []models.Codebase{
			{
				ObjectID:           "service-1-3",
				OrganizationID:     1,
				ServiceName:        "service-one", // Use extracted repo name
				ServiceRepoURL:     "https://github.com/example/service-one",
				ServiceDescription: "First test service",
			},
			{
				ObjectID:           "service-2-3",
				OrganizationID:     1,
				ServiceName:        "service-two", // Use extracted repo name
				ServiceRepoURL:     "https://github.com/example/service-two",
				ServiceDescription: "Second test service",
			},
		}
		for _, service := range testServices {
			db.Create(&service)
		}

		// Create test request
		req := httptest.NewRequest("GET", "/api/v1/org/test-org/codebase", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response []CodebaseResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Len(t, response, 2)
		assert.Equal(t, "service-one", response[0].CodebaseName) // Now uses extracted repo name
		assert.Equal(t, "service-two", response[1].CodebaseName) // Now uses extracted repo name
	})

	t.Run("No services found for organization", func(t *testing.T) {

		emptyOrg := models.Organization{
			ObjectID:         "empty-org",
			OrganizationName: "Empty Organization",
		}
		err = db.Create(&emptyOrg).Error
		assert.NoError(t, err)

		// Create test request for an organization with no services
		req := httptest.NewRequest("GET", "/api/v1/org/empty-org/codebase", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response []CodebaseResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Len(t, response, 0)
	})

	t.Run("Database error during retrieval", func(t *testing.T) {
		// Simulate database error by closing the DB connection
		sqlDB, _ := db.DB()
		sqlDB.Close()

		// Create test request
		req := httptest.NewRequest("GET", "/api/v1/org/test-org/codebase", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 500, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Failed to find organization", response["error"])
	})
}
func TestGetService(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Codebase{}, &models.APIKey{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	// create an organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewCodebaseHandler(db)

	// Define the route
	app.Get("/api/v1/org/:org_id/codebase/:service_id", handler.GetCodebase)

	t.Run("Successful retrieval of a service", func(t *testing.T) {
		// Seed the database with test data
		testService := models.Codebase{
			ObjectID:           "service-1",
			OrganizationID:     1,
			ServiceName:        "test-service", // Use extracted repo name
			ServiceRepoURL:     "https://github.com/example/test-service",
			ServiceDescription: "A test service",
		}
		db.Create(&testService)

		// Create test request
		req := httptest.NewRequest("GET", "/api/v1/org/test-org/codebase/service-1?type=manual", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response CodebaseResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "service-1", response.ObjectID)
		assert.Equal(t, "test-service", response.CodebaseName) // Now uses extracted repo name
		assert.Equal(t, "https://github.com/example/test-service", response.CodebaseRepoURL)
		assert.Equal(t, "A test service", response.CodebaseDescription)
	})

	t.Run("Service not found", func(t *testing.T) {
		// Create test request for a non-existent service
		req := httptest.NewRequest("GET", "/api/v1/org/test-org/codebase/non-existent-service?type=manual", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 404, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Service not found", response["error"])
	})

	t.Run("Database error during retrieval", func(t *testing.T) {
		// Simulate database error by closing the DB connection
		sqlDB, _ := db.DB()
		sqlDB.Close()

		// Create test request
		req := httptest.NewRequest("GET", "/api/v1/org/test-org/codebase/service-1?type=manual", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 500, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Failed to find organization", response["error"])
	})
}
func TestUpdateService(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Codebase{}, &models.APIKey{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	// create an organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewCodebaseHandler(db)

	// Define the route
	app.Put("/api/v1/org/:org_id/codebase/:service_id", handler.UpdateCodebase)

	t.Run("Successful service update", func(t *testing.T) {
		// Seed the database with test data
		testService := models.Codebase{
			ObjectID:           "service-1",
			OrganizationID:     1,
			ServiceName:        "old-service", // Use extracted repo name
			ServiceRepoURL:     "https://github.com/example/old-service",
			ServiceDescription: "Old description",
		}
		db.Create(&testService)

		// Prepare request payload
		serviceRequest := CodebaseRequest{
			CodebaseName:        "Updated Service Name",
			CodebaseRepoURL:     "https://github.com/example/updated-service",
			CodebaseDescription: "Updated description",
		}
		body, _ := json.Marshal(serviceRequest)

		// Create test request
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/codebase/service-1", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response CodebaseResponse
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "service-1", response.ObjectID)
		assert.Equal(t, "updated-service", response.CodebaseName) // Now uses extracted repo name
		assert.Equal(t, "https://github.com/example/updated-service", response.CodebaseRepoURL)
		assert.Equal(t, "Updated description", response.CodebaseDescription)
	})

	t.Run("Invalid request payload", func(t *testing.T) {
		// Create test request with invalid payload
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/codebase/service-1", bytes.NewReader([]byte("invalid")))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 400, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Invalid request", response["error"])
	})

	t.Run("Service not found", func(t *testing.T) {
		// Prepare request payload
		serviceRequest := CodebaseRequest{
			CodebaseName:        "Non-existent Service",
			CodebaseRepoURL:     "https://github.com/example/non-existent-service",
			CodebaseDescription: "Non-existent description",
		}
		body, _ := json.Marshal(serviceRequest)

		// Create test request for a non-existent service
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/codebase/non-existent-service", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 404, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Service not found", response["error"])
	})

	t.Run("Database error during update", func(t *testing.T) {
		// Seed the database with test data
		testService := models.Codebase{
			ObjectID:           "service-2",
			OrganizationID:     2,
			ServiceName:        "Another Service",
			ServiceRepoURL:     "https://github.com/example/another-service",
			ServiceDescription: "Another description",
		}
		db.Create(&testService)

		// Simulate database error by closing the DB connection
		sqlDB, _ := db.DB()
		sqlDB.Close()

		// Prepare request payload
		serviceRequest := CodebaseRequest{
			CodebaseName:        "Updated Service Name",
			CodebaseRepoURL:     "https://github.com/example/updated-service",
			CodebaseDescription: "Updated description",
		}
		body, _ := json.Marshal(serviceRequest)

		// Create test request
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/codebase/service-2", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 500, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Failed to find organization", response["error"])
	})
}
func TestDeleteService(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(&models.Organization{}, &models.APIKey{}, &models.Codebase{}, &models.CodebaseVersion{})
	assert.NoError(t, err)

	// create an organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create Fiber app and handler
	app := fiber.New()
	handler := NewCodebaseHandler(db)

	// Define the route
	app.Delete("/api/v1/org/:org_id/codebase/:service_id", handler.DeleteCodebase)

	t.Run("Successful service deletion", func(t *testing.T) {
		// Seed the database with test data
		testService := models.Codebase{
			ObjectID:           "service-1",
			OrganizationID:     1,
			ServiceName:        "test-service", // Use extracted repo name
			ServiceRepoURL:     "https://github.com/example/test-service",
			ServiceDescription: "A test service",
		}
		db.Create(&testService)

		// create a codebase version to attach to the service
		version := models.CodebaseVersion{
			ObjectID:   "version-1",
			CodebaseID: 1,
			BranchName: "test/1.2",
		}
		err = db.Create(&version).Error
		assert.NoError(t, err)

		// Create test request
		req := httptest.NewRequest("DELETE", "/api/v1/org/test-org/codebase/service-1", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 200, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Service deleted successfully", response["message"])

		// Verify the service is deleted
		var service models.Codebase
		result := db.Where("object_id = ?", "service-1").First(&service)
		assert.Error(t, result.Error)
		assert.Equal(t, gorm.ErrRecordNotFound, result.Error)
	})

	t.Run("Service not found", func(t *testing.T) {
		// Create test request for a non-existent service
		req := httptest.NewRequest("DELETE", "/api/v1/org/test-org/codebase/non-existent-service", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 404, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Service not found", response["error"])
	})

	t.Run("Database error during deletion", func(t *testing.T) {
		// Seed the database with test data
		testService := models.Codebase{
			ObjectID:           "service-2",
			OrganizationID:     1,
			ServiceName:        "Another Service",
			ServiceRepoURL:     "https://github.com/example/another-service",
			ServiceDescription: "Another description",
		}
		db.Create(&testService)

		// Simulate database error by closing the DB connection
		sqlDB, _ := db.DB()
		sqlDB.Close()

		// Create test request
		req := httptest.NewRequest("DELETE", "/api/v1/org/test-org/codebase/service-2", nil)
		resp, _ := app.Test(req)

		// Assert response
		assert.Equal(t, 500, resp.StatusCode)

		var response map[string]string
		json.NewDecoder(resp.Body).Decode(&response)

		assert.Equal(t, "Failed to find organization", response["error"])
	})
}
