package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupComplianceTemplateTestDB() *gorm.DB {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(
		&models.Organization{},
		&models.ReportTemplate{},
		&models.TemplateSection{},
		&models.Rule{},
	)
	return db
}

func TestCreateComplianceTemplateFromJSON(t *testing.T) {
	db := setupComplianceTemplateTestDB()
	handler := NewComplianceTemplateHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	// Create test app
	app := fiber.New()
	app.Post("/api/v1/org/:org_id/compliance-template/import", func(c *fiber.Ctx) error {
		// Mock auth context
		auth := &middleware.AuthContext{
			IsUser: true,
			User: &models.User{
				ObjectID:     "test-user",
				Organization: org,
			},
		}
		c.Locals("auth", auth)
		return handler.CreateFromJSON(c)
	})

	// Test JSON payload
	templateJSON := ComplianceTemplateJSON{
		Name:        "Test HIPAA Template",
		Description: "Test template for HIPAA compliance",
		Version:     "1.0",
		Source:      "HIPAA",
		Sections: []ComplianceTemplateSectionJSON{
			{
				Name:        "Access Control",
				Description: "Test access control section",
				Rules: []ComplianceTemplateRuleJSON{
					{
						Name:  "Unique User ID",
						Rule:  "Each user must have a unique ID",
						Scope: "authentication",
						Tags:  []string{"access_control", "user_id"},
					},
				},
			},
		},
	}

	jsonData, _ := json.Marshal(templateJSON)
	req := httptest.NewRequest("POST", "/api/v1/org/test-org-123/compliance-template/import", bytes.NewReader(jsonData))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	// Verify template was created in database using existing models
	var template models.ReportTemplate
	err = db.Where("organization_id = ?", org.ID).First(&template).Error
	assert.NoError(t, err)
	assert.Equal(t, "Test HIPAA Template", template.Name)
	assert.Equal(t, "Test template for HIPAA compliance", template.Description)
	assert.True(t, template.Active)

	// Verify sections were created
	var sections []models.TemplateSection
	err = db.Preload("Rules").Where("template_id = ?", template.ID).Find(&sections).Error
	assert.NoError(t, err)
	assert.Len(t, sections, 1)
	assert.Equal(t, "Access Control", sections[0].Name)
	assert.Len(t, sections[0].Rules, 1)
	assert.Equal(t, "Unique User ID", sections[0].Rules[0].Name)
	assert.Equal(t, "HIPAA", sections[0].Rules[0].Source)
	assert.Equal(t, "1.0", sections[0].Rules[0].PolicyVersion)
}

func TestGetComplianceTemplates(t *testing.T) {
	db := setupComplianceTemplateTestDB()
	handler := NewComplianceTemplateHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	// Create test template using existing ReportTemplate model
	template := models.ReportTemplate{
		ObjectID:       "template-123",
		OrganizationID: org.ID,
		Name:           "Test Template",
		Description:    "Test Description",
		Active:         true,
	}
	db.Create(&template)

	// Create test section and rule
	section := models.TemplateSection{
		ObjectID:       "section-123",
		OrganizationID: org.ID,
		Name:           "Test Section",
		Description:    "Test Section Description",
		TemplateID:     template.ID,
	}
	db.Create(&section)

	rule := models.Rule{
		ObjectID:       "rule-123",
		OrganizationID: org.ID,
		Name:           "Test Rule",
		Rule:           "Test rule description",
		Source:         "TEST",
		PolicyVersion:  "1.0",
	}
	db.Create(&rule)
	db.Model(&section).Association("Rules").Append(&rule)

	// Create test app
	app := fiber.New()
	app.Get("/api/v1/org/:org_id/compliance-template", func(c *fiber.Ctx) error {
		// Mock auth context
		auth := &middleware.AuthContext{
			IsUser: true,
			User: &models.User{
				ObjectID:     "test-user",
				Organization: org,
			},
		}
		c.Locals("auth", auth)
		return handler.GetComplianceTemplates(c)
	})

	req := httptest.NewRequest("GET", "/api/v1/org/test-org-123/compliance-template", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Parse response
	var templates []ComplianceTemplateResponse
	json.NewDecoder(resp.Body).Decode(&templates)
	assert.Len(t, templates, 1)
	assert.Equal(t, "Test Template", templates[0].Name)
	assert.Equal(t, "template-123", templates[0].ObjectID)
}

func TestGetComplianceTemplate(t *testing.T) {
	db := setupComplianceTemplateTestDB()
	handler := NewComplianceTemplateHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	// Create test template using existing ReportTemplate model
	template := models.ReportTemplate{
		ObjectID:       "template-123",
		OrganizationID: org.ID,
		Name:           "Test Template",
		Description:    "Test Description",
		Active:         true,
	}
	db.Create(&template)

	// Create test section and rule
	section := models.TemplateSection{
		ObjectID:       "section-123",
		OrganizationID: org.ID,
		Name:           "Test Section",
		Description:    "Test Section Description",
		TemplateID:     template.ID,
	}
	db.Create(&section)

	rule := models.Rule{
		ObjectID:       "rule-123",
		OrganizationID: org.ID,
		Name:           "Test Rule",
		Rule:           "Test rule description",
		Source:         "TEST",
		PolicyVersion:  "1.0",
	}
	db.Create(&rule)
	db.Model(&section).Association("Rules").Append(&rule)

	// Create test app
	app := fiber.New()
	app.Get("/api/v1/org/:org_id/compliance-template/:template_id", func(c *fiber.Ctx) error {
		// Mock auth context
		auth := &middleware.AuthContext{
			IsUser: true,
			User: &models.User{
				ObjectID:     "test-user",
				Organization: org,
			},
		}
		c.Locals("auth", auth)
		return handler.GetComplianceTemplate(c)
	})

	req := httptest.NewRequest("GET", "/api/v1/org/test-org-123/compliance-template/template-123", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Parse response
	var templateResp ComplianceTemplateResponse
	json.NewDecoder(resp.Body).Decode(&templateResp)
	assert.Equal(t, "Test Template", templateResp.Name)
	assert.Equal(t, "template-123", templateResp.ObjectID)
}

func TestExportComplianceTemplate(t *testing.T) {
	db := setupComplianceTemplateTestDB()
	handler := NewComplianceTemplateHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	// Create test template using existing ReportTemplate model
	template := models.ReportTemplate{
		ObjectID:       "template-123",
		OrganizationID: org.ID,
		Name:           "Test HIPAA Template",
		Description:    "Test template for HIPAA compliance",
		Active:         true,
	}
	db.Create(&template)

	// Create test section
	section := models.TemplateSection{
		ObjectID:       "section-123",
		OrganizationID: org.ID,
		Name:           "Access Control",
		Description:    "Test access control section",
		TemplateID:     template.ID,
	}
	db.Create(&section)

	// Create test rules with different tags
	rule1 := models.Rule{
		ObjectID:       "rule-123",
		OrganizationID: org.ID,
		Name:           "Unique User ID",
		Rule:           "Each user must have a unique ID",
		Scope:          "authentication",
		Tags:           "access_control,user_id",
		Source:         "HIPAA",
		PolicyVersion:  "1.0",
		PolicyName:     "Test HIPAA Template",
	}
	db.Create(&rule1)

	rule2 := models.Rule{
		ObjectID:       "rule-456",
		OrganizationID: org.ID,
		Name:           "Password Policy",
		Rule:           "Passwords must be complex",
		Scope:          "authentication",
		Tags:           "access_control,password",
		Source:         "HIPAA",
		PolicyVersion:  "1.0",
		PolicyName:     "Test HIPAA Template",
	}
	db.Create(&rule2)

	// Associate rules with section
	db.Model(&section).Association("Rules").Append(&rule1, &rule2)

	// Create test app
	app := fiber.New()
	app.Get("/api/v1/org/:org_id/compliance-template/:template_id/export", func(c *fiber.Ctx) error {
		// Mock auth context
		auth := &middleware.AuthContext{
			IsUser: true,
			User: &models.User{
				ObjectID:     "test-user",
				Organization: org,
			},
		}
		c.Locals("auth", auth)
		return handler.ExportComplianceTemplate(c)
	})

	req := httptest.NewRequest("GET", "/api/v1/org/test-org-123/compliance-template/template-123/export", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Parse response
	var exportedTemplate ComplianceTemplateJSON
	json.NewDecoder(resp.Body).Decode(&exportedTemplate)

	// Verify exported template structure
	assert.Equal(t, "Test HIPAA Template", exportedTemplate.Name)
	assert.Equal(t, "Test template for HIPAA compliance", exportedTemplate.Description)
	assert.Equal(t, "1.0", exportedTemplate.Version)
	assert.Equal(t, "HIPAA", exportedTemplate.Source)
	assert.Len(t, exportedTemplate.Sections, 1)

	// Verify section
	section1 := exportedTemplate.Sections[0]
	assert.Equal(t, "Access Control", section1.Name)
	assert.Equal(t, "Test access control section", section1.Description)
	assert.Len(t, section1.Rules, 2)

	// Verify rules (order might vary, so check both possibilities)
	ruleNames := []string{section1.Rules[0].Name, section1.Rules[1].Name}
	assert.Contains(t, ruleNames, "Unique User ID")
	assert.Contains(t, ruleNames, "Password Policy")

	// Find and verify specific rule
	var uniqueUserRule *ComplianceTemplateRuleJSON
	for _, rule := range section1.Rules {
		if rule.Name == "Unique User ID" {
			uniqueUserRule = &rule
			break
		}
	}
	assert.NotNil(t, uniqueUserRule)
	assert.Equal(t, "Each user must have a unique ID", uniqueUserRule.Rule)
	assert.Equal(t, "authentication", uniqueUserRule.Scope)
	assert.Contains(t, uniqueUserRule.Tags, "access_control")
	assert.Contains(t, uniqueUserRule.Tags, "user_id")
}

func TestExportComplianceTemplate_NotFound(t *testing.T) {
	db := setupComplianceTemplateTestDB()
	handler := NewComplianceTemplateHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	// Create test app
	app := fiber.New()
	app.Get("/api/v1/org/:org_id/compliance-template/:template_id/export", func(c *fiber.Ctx) error {
		// Mock auth context
		auth := &middleware.AuthContext{
			IsUser: true,
			User: &models.User{
				ObjectID:     "test-user",
				Organization: org,
			},
		}
		c.Locals("auth", auth)
		return handler.ExportComplianceTemplate(c)
	})

	req := httptest.NewRequest("GET", "/api/v1/org/test-org-123/compliance-template/nonexistent-template/export", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	// Parse error response
	var errorResp map[string]string
	json.NewDecoder(resp.Body).Decode(&errorResp)
	assert.Equal(t, "Compliance template not found", errorResp["error"])
}

func TestExportComplianceTemplate_EmptyTemplate(t *testing.T) {
	db := setupComplianceTemplateTestDB()
	handler := NewComplianceTemplateHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
	}
	db.Create(&org)

	// Create test template with no sections
	template := models.ReportTemplate{
		ObjectID:       "template-123",
		OrganizationID: org.ID,
		Name:           "Empty Template",
		Description:    "Template with no sections",
		Active:         true,
	}
	db.Create(&template)

	// Create test app
	app := fiber.New()
	app.Get("/api/v1/org/:org_id/compliance-template/:template_id/export", func(c *fiber.Ctx) error {
		// Mock auth context
		auth := &middleware.AuthContext{
			IsUser: true,
			User: &models.User{
				ObjectID:     "test-user",
				Organization: org,
			},
		}
		c.Locals("auth", auth)
		return handler.ExportComplianceTemplate(c)
	})

	req := httptest.NewRequest("GET", "/api/v1/org/test-org-123/compliance-template/template-123/export", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Parse response
	var exportedTemplate ComplianceTemplateJSON
	json.NewDecoder(resp.Body).Decode(&exportedTemplate)

	// Verify exported template structure
	assert.Equal(t, "Empty Template", exportedTemplate.Name)
	assert.Equal(t, "Template with no sections", exportedTemplate.Description)
	assert.Equal(t, "", exportedTemplate.Version) // Should be empty when no rules
	assert.Equal(t, "", exportedTemplate.Source)  // Should be empty when no rules
	assert.Len(t, exportedTemplate.Sections, 0)   // Should be empty array
}
