package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"gorm.io/datatypes"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestApp() (*fiber.App, *gorm.DB, error) {
	logrus.SetLevel(logrus.DebugLevel)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		return nil, nil, err
	}

	// Migrate models
	err = db.AutoMigrate(&models.Organization{}, &models.Rule{})
	if err != nil {
		return nil, nil, err
	}

	//cerate org
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	if err := db.Create(&org).Error; err != nil {
		return nil, nil, err
	}

	app := fiber.New()
	handler := NewRuleHandler(db)
	app.Post("/api/v1/org/:org_id/rule", handler.CreateRule)
	app.Put("/api/v1/org/:org_id/rule/:rule_id", handler.UpdateRule)
	app.Get("/api/v1/org/:org_id/rule/:rule_id", handler.GetRule)
	app.Get("/api/v1/org/:org_id/rule", handler.GetRules)
	app.Delete("/api/v1/org/:org_id/rule/:rule_id", handler.DeleteRule)

	return app, db, nil
}

func TestCreateRule(t *testing.T) {
	t.Run("successfully create a rule", func(t *testing.T) {
		app, _, err := setupTestApp()
		assert.NoError(t, err)

		requestBody := RuleRequest{
			Rule:  "Test Rule",
			Scope: "Test Scope",
			// Queries:        []string{}, // avoid failing on not-found queries
			EvidenceSchema: `{"key": "value"}`,
			Tags:           "tag1,tag2",
			Source:         "Test Source",
			Description:    "Test Description",
		}
		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/rule", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	})

	t.Run("invalid request body", func(t *testing.T) {
		app, _, err := setupTestApp()
		assert.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/v1/org/test-org/rule", bytes.NewReader([]byte("invalid json")))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("invalid evidence schema", func(t *testing.T) {
		app, _, err := setupTestApp()
		assert.NoError(t, err)

		requestBody := RuleRequest{
			Rule:  "Test Rule",
			Scope: "Test Scope",
			// Queries:        []string{},
			EvidenceSchema: `invalid-json`,
			Tags:           "tag1,tag2",
			Source:         "Test Source",
			Description:    "Test Description",
		}
		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", "/api/v1/org/test-org/rule", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

}
func TestUpdateRule(t *testing.T) {
	t.Run("successfully update a rule", func(t *testing.T) {
		app, db, err := setupTestApp()
		assert.NoError(t, err)

		// // create the org too
		// org := models.Organization{
		// 	ObjectID:         "test-org",
		// 	OrganizationName: "Test Organization",
		// }
		// assert.NoError(t, db.Create(&org).Error)

		// Create a rule to update
		rule := models.Rule{
			ObjectID:       "test-rule-id",
			Rule:           "Old Rule",
			Scope:          "Old Scope",
			EvidenceSchema: datatypes.JSON([]byte(`{"old_key": "old_value"}`)),
			Tags:           "old_tag",
			Source:         "Old Source",
			Description:    "Old Description",
			OrganizationID: 1,
		}
		assert.NoError(t, db.Create(&rule).Error)

		// Prepare update request
		requestBody := RuleRequest{
			Rule:           "Updated Rule",
			Scope:          "Updated Scope",
			EvidenceSchema: `{"new_key": "new_value"}`,
			Tags:           "new_tag",
			Source:         "Updated Source",
			Description:    "Updated Description",
		}
		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/rule/test-rule-id", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusOK, resp.StatusCode)

		// Verify the rule was updated
		var updatedRule models.Rule
		assert.NoError(t, db.First(&updatedRule, "object_id = ?", "test-rule-id").Error)
		assert.Equal(t, "Updated Rule", updatedRule.Rule)
		assert.Equal(t, "Updated Scope", updatedRule.Scope)
		assert.JSONEq(t, `{"new_key": "new_value"}`, string(updatedRule.EvidenceSchema))
		assert.Equal(t, "new_tag", updatedRule.Tags)
		assert.Equal(t, "Updated Source", updatedRule.Source)
		assert.Equal(t, "Updated Description", updatedRule.Description)
	})

	t.Run("rule not found", func(t *testing.T) {
		app, _, err := setupTestApp()
		assert.NoError(t, err)

		requestBody := RuleRequest{
			Rule:           "Non-existent Rule",
			Scope:          "Non-existent Scope",
			EvidenceSchema: `{"key": "value"}`,
			Tags:           "tag1,tag2",
			Source:         "Non-existent Source",
			Description:    "Non-existent Description",
		}
		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/rule/non-existent-rule-id", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("invalid request body", func(t *testing.T) {
		app, _, err := setupTestApp()
		assert.NoError(t, err)

		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/rule/test-rule-id", bytes.NewReader([]byte("invalid json")))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("invalid evidence schema", func(t *testing.T) {
		app, db, err := setupTestApp()
		assert.NoError(t, err)

		// Create a rule to update
		rule := models.Rule{
			ObjectID:       "test-rule-id",
			Rule:           "Old Rule",
			Scope:          "Old Scope",
			EvidenceSchema: datatypes.JSON([]byte(`{"old_key": "old_value"}`)),
			Tags:           "old_tag",
			Source:         "Old Source",
			Description:    "Old Description",
			OrganizationID: 1,
		}
		assert.NoError(t, db.Create(&rule).Error)

		// Prepare update request with invalid evidence schema
		requestBody := RuleRequest{
			Rule:           "Updated Rule",
			Scope:          "Updated Scope",
			EvidenceSchema: `invalid-json`,
			Tags:           "new_tag",
			Source:         "Updated Source",
			Description:    "Updated Description",
		}
		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("PUT", "/api/v1/org/test-org/rule/test-rule-id", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})
}
func TestDeleteRule(t *testing.T) {
	t.Run("successfully delete a rule", func(t *testing.T) {
		app, db, err := setupTestApp()
		assert.NoError(t, err)

		// Create a rule to delete
		rule := models.Rule{
			ObjectID:       "test-rule-id",
			Rule:           "Test Rule",
			Scope:          "Test Scope",
			EvidenceSchema: datatypes.JSON([]byte(`{"key": "value"}`)),
			Tags:           "tag1,tag2",
			Source:         "Test Source",
			Description:    "Test Description",
			OrganizationID: 1,
		}
		assert.NoError(t, db.Create(&rule).Error)

		// Send delete request
		req := httptest.NewRequest("DELETE", "/api/v1/org/test-org/rule/test-rule-id", nil)
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusOK, resp.StatusCode)

		// Verify the rule was deleted
		var deletedRule models.Rule
		err = db.First(&deletedRule, "object_id = ?", "test-rule-id").Error
		assert.Error(t, err)
		assert.Equal(t, gorm.ErrRecordNotFound, err)
	})

	t.Run("rule not found", func(t *testing.T) {
		app, _, err := setupTestApp()
		assert.NoError(t, err)

		// Send delete request for a non-existent rule
		req := httptest.NewRequest("DELETE", "/api/v1/org/test-org/rule/non-existent-rule-id", nil)
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("organization not found", func(t *testing.T) {
		app, db, err := setupTestApp()
		assert.NoError(t, err)

		// Create a rule without an associated organization
		rule := models.Rule{
			ObjectID:       "test-rule-id",
			Rule:           "Test Rule",
			Scope:          "Test Scope",
			EvidenceSchema: datatypes.JSON([]byte(`{"key": "value"}`)),
			Tags:           "tag1,tag2",
			Source:         "Test Source",
			Description:    "Test Description",
			OrganizationID: 23,
		}
		assert.NoError(t, db.Create(&rule).Error)

		// Send delete request for a rule with a non-existent organization
		req := httptest.NewRequest("DELETE", "/api/v1/org/test-org/rule/test-rule-id", nil)
		resp, _ := app.Test(req)

		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})
}
