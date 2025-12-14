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

// Helper for in-memory DB and Fiber app
func setupTestEnv() (*gorm.DB, *PropertyHandler, *fiber.App) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(nil, err)
	_ = db.AutoMigrate(&models.CodebaseVersion{}, &models.CodebaseVersionProperty{})
	handler := &PropertyHandler{DB: db}
	app := fiber.New()
	app.Post("/api/v1/org/:org_id/property/code/", handler.CreateProperty)
	app.Get("/api/v1/org/:org_id/property/code/:property_id", handler.GetProperty)
	app.Put("/api/v1/org/:org_id/property/code/:property_id", handler.EditProperty)
	app.Get("/api/v1/org/:org_id/property/code/", handler.GetProperties)
	app.Delete("/api/v1/org/:org_id/property/code/:property_id", handler.DeleteProperty)
	return db, handler, app
}

func TestPropertyHandler(t *testing.T) {
	t.Run("GetProperty_NotFound", func(t *testing.T) {
		_, _, app := setupTestEnv()
		orgID := "org-1"
		propertyID := "prop-1"
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/"+propertyID, nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("GetProperty_Success", func(t *testing.T) {
		db, _, app := setupTestEnv()

		org := models.Organization{
			ObjectID:         "org-1",
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		propertyID := "prop-1"
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		prop := models.CodebaseVersionProperty{
			ObjectID:          propertyID,
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		}
		db.Create(&prop)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/"+propertyID, nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var got models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&got)
		assert.Equal(t, prop.PropertyKey, got.PropertyKey)
		assert.Equal(t, prop.PropertyValue, got.PropertyValue)
	})

	t.Run("EditProperty_Success", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		propertyID := "prop-1"

		//create org
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		// Create codebase version and property

		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		prop := models.CodebaseVersionProperty{
			ObjectID:          propertyID,
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		}
		db.Create(&prop)
		editReq := CreatePropertyRequest{
			CodebaseVersionID: codebaseVersionID,
			PropertyKey:       "baz",
			PropertyValue:     "qux",
			PropertyType:      "int",
		}
		body, _ := json.Marshal(editReq)
		req := httptest.NewRequest(http.MethodPut, "/api/v1/org/"+orgID+"/property/code/"+propertyID, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var got models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&got)
		assert.Equal(t, "baz", got.PropertyKey)
		assert.Equal(t, "qux", got.PropertyValue)
		assert.Equal(t, "int", got.PropertyType)
	})

	t.Run("EditProperty_NotFound", func(t *testing.T) {
		_, _, app := setupTestEnv()
		orgID := "org-1"
		propertyID := "not-exist"
		editReq := CreatePropertyRequest{
			CodebaseVersionID: "cbv-1",
			PropertyKey:       "baz",
			PropertyValue:     "qux",
			PropertyType:      "int",
		}
		body, _ := json.Marshal(editReq)
		req := httptest.NewRequest(http.MethodPut, "/api/v1/org/"+orgID+"/property/code/"+propertyID, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("GetProperties_FilterByTypeAndKey", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"

		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)

		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p1",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p2",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "baz",
			PropertyValue:     "qux",
			PropertyType:      "int",
		})
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?type=string&key=foo", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 1)
		assert.Equal(t, "foo", props[0].PropertyKey)
		assert.Equal(t, "string", props[0].PropertyType)
	})

	t.Run("DeleteProperty_Success", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		propertyID := "prop-1"

		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)

		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          propertyID,
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		})
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/org/"+orgID+"/property/code/"+propertyID, nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
		// Confirm deletion
		var prop models.CodebaseVersionProperty
		tx := db.Where("object_id = ?", propertyID).First(&prop)
		assert.Error(t, tx.Error)
	})

	t.Run("DeleteProperty_NotFound", func(t *testing.T) {
		_, _, app := setupTestEnv()
		orgID := "org-1"
		propertyID := "not-exist"
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/org/"+orgID+"/property/code/"+propertyID, nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("GetProperties_VectorFilter_InvalidFormat", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)

		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?value_vector=not,a,vector", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("GetProperties_EmptyResult", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?type=doesnotexist", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 0)
	})
}
func TestGetProperties(t *testing.T) {
	t.Run("ReturnsAllPropertiesForOrg", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		prop1 := models.CodebaseVersionProperty{
			ObjectID:          "p1",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "key1",
			PropertyValue:     "val1",
			PropertyType:      "string",
		}
		prop2 := models.CodebaseVersionProperty{
			ObjectID:          "p2",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "key2",
			PropertyValue:     "val2",
			PropertyType:      "int",
		}
		db.Create(&prop1)
		db.Create(&prop2)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 2)
	})

	t.Run("FiltersByCodebaseVersionID", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID1 := "cbv-1"
		codebaseVersionID2 := "cbv-2"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID1, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID2, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p1",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "key1",
			PropertyValue:     "val1",
			PropertyType:      "string",
		})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p2",
			OrganizationID:    1,
			CodebaseVersionID: 2,
			PropertyKey:       "key2",
			PropertyValue:     "val2",
			PropertyType:      "int",
		})
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?codebase_version_id="+codebaseVersionID1, nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 1)
		assert.Equal(t, uint(1), props[0].CodebaseVersionID)
	})

	t.Run("FiltersByPath", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p1",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "key1",
			PropertyValue:     "val1",
			PropertyType:      "string",
			FilePath:          "/foo/bar/baz.go",
		})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p2",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "key2",
			PropertyValue:     "val2",
			PropertyType:      "int",
			FilePath:          "/other/file.go",
		})
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?path=baz.go", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 1)
		assert.Contains(t, props[0].FilePath, "baz.go")
	})

	t.Run("FiltersByType", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p1",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "key1",
			PropertyValue:     "val1",
			PropertyType:      "string",
		})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p2",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "key2",
			PropertyValue:     "val2",
			PropertyType:      "int",
		})
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?type=int", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 1)
		assert.Equal(t, "int", props[0].PropertyType)
	})

	t.Run("FiltersByKey", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p1",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p2",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "baz",
			PropertyValue:     "qux",
			PropertyType:      "int",
		})
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?key=foo", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 1)
		assert.Equal(t, "foo", props[0].PropertyKey)
	})

	t.Run("ReturnsEmptyArrayIfNoMatch", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          "p1",
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		})
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?type=doesnotexist", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var props []models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&props)
		assert.Len(t, props, 0)
	})

	t.Run("ReturnsBadRequestOnInvalidVector", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		req := httptest.NewRequest(http.MethodGet, "/api/v1/org/"+orgID+"/property/code/?value_vector=not,a,vector", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
func TestDeleteProperty(t *testing.T) {
	t.Run("DeleteProperty_Success", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		propertyID := "prop-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          propertyID,
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		})
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/org/"+orgID+"/property/code/"+propertyID, nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
		// Confirm deletion
		var prop models.CodebaseVersionProperty
		tx := db.Where("object_id = ?", propertyID).First(&prop)
		assert.Error(t, tx.Error)
	})

	t.Run("DeleteProperty_NotFound", func(t *testing.T) {
		_, _, app := setupTestEnv()
		orgID := "org-1"
		propertyID := "not-exist"
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/org/"+orgID+"/property/code/"+propertyID, nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}
func TestEditProperty(t *testing.T) {
	t.Run("EditProperty_UpdatesFields", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		propertyID := "prop-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		// Create codebase version and property
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          propertyID,
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "original-key",
			PropertyValue:     "original-value",
			PropertyType:      "string",
			Reasoning:         "original-reason",
			FilePath:          "/original/path.go",
		})
		editReq := CreatePropertyRequest{
			CodebaseVersionID: codebaseVersionID,
			PropertyKey:       "new-key",
			PropertyValue:     "new-value",
			PropertyType:      "int",
			Reasoning:         "new-reason",
			FilePath:          "/new/path.go",
		}
		body, _ := json.Marshal(editReq)
		req := httptest.NewRequest(http.MethodPut, "/api/v1/org/"+orgID+"/property/code/"+propertyID, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		var got models.CodebaseVersionProperty
		json.NewDecoder(resp.Body).Decode(&got)
		assert.Equal(t, "new-key", got.PropertyKey)
		assert.Equal(t, "new-value", got.PropertyValue)
		assert.Equal(t, "int", got.PropertyType)
		assert.Equal(t, "new-reason", got.Reasoning)
		assert.Equal(t, "/new/path.go", got.FilePath)
	})

	t.Run("EditProperty_InvalidBody", func(t *testing.T) {
		db, _, app := setupTestEnv()
		orgID := "org-1"
		codebaseVersionID := "cbv-1"
		propertyID := "prop-1"
		org := models.Organization{
			ObjectID:         orgID,
			OrganizationName: "Test Org",
		}
		assert.NoError(t, db.Create(&org).Error)
		db.Create(&models.CodebaseVersion{ObjectID: codebaseVersionID, OrganizationID: org.ID})
		db.Create(&models.CodebaseVersionProperty{
			ObjectID:          propertyID,
			OrganizationID:    1,
			CodebaseVersionID: 1,
			PropertyKey:       "foo",
			PropertyValue:     "bar",
			PropertyType:      "string",
		})
		req := httptest.NewRequest(http.MethodPut, "/api/v1/org/"+orgID+"/property/code/"+propertyID, bytes.NewReader([]byte("{invalid json")))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("EditProperty_NotFound", func(t *testing.T) {
		_, _, app := setupTestEnv()
		orgID := "org-1"
		propertyID := "not-exist"
		editReq := CreatePropertyRequest{
			CodebaseVersionID: "cbv-1",
			PropertyKey:       "baz",
			PropertyValue:     "qux",
			PropertyType:      "int",
		}
		body, _ := json.Marshal(editReq)
		req := httptest.NewRequest(http.MethodPut, "/api/v1/org/"+orgID+"/property/code/"+propertyID, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

}
