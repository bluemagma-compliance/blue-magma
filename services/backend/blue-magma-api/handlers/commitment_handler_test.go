package handlers

import (
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

// setupCommitmentTestEnv creates an in-memory DB and Fiber app with the
// commitment routes registered for testing.
func setupCommitmentTestEnv() (*gorm.DB, *fiber.App) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	if err := db.AutoMigrate(&models.Organization{}, &models.Project{}, &models.Document{}, &models.SCFFrameworkMap{}, &models.SCFControl{}); err != nil {
		panic(err)
	}

	app := fiber.New()
	handler := NewCommitmentHandler(db)

	// Public route
	app.Get("/api/v1/public/commitment", handler.GetPublicCommitment)

	// Org-scoped preview route uses middleware in production; here we just
	// inject the organization into Locals directly in the test.
	app.Get("/api/v1/org/:org_id/commitment/preview", func(c *fiber.Ctx) error {
		orgID := c.Params("org_id")
		var org models.Organization
		if err := db.Where("object_id = ?", orgID).First(&org).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		c.Locals("organization", org)
		return handler.GetPrivateCommitmentPreview(c)
	})

	return db, app
}

func TestGetPublicCommitment_SharingDisabledOrNotFound(t *testing.T) {
	db, app := setupCommitmentTestEnv()

	// Org that exists but does not share commitment
	org := models.Organization{ObjectID: "org-no-share", OrganizationName: "No Share Org", ShareCommitment: false}
	assert.NoError(t, db.Create(&org).Error)

	// Missing org_id
	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/commitment", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	// Non-existent org
	req = httptest.NewRequest(http.MethodGet, "/api/v1/public/commitment?org_id=does-not-exist", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	// Existing org but ShareCommitment=false should still return 404
	req = httptest.NewRequest(http.MethodGet, "/api/v1/public/commitment?org_id=org-no-share", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestGetPublicAndPrivateCommitment_WithActiveProjectAndControls(t *testing.T) {
	db, app := setupCommitmentTestEnv()

	// Org with sharing enabled
	org := models.Organization{ObjectID: "org-share", OrganizationName: "Share Org", ShareCommitment: true}
	assert.NoError(t, db.Create(&org).Error)

	// Active project
	project := models.Project{ObjectID: "proj-1", OrganizationID: org.ID, Name: "Project 1", Status: "active"}
	assert.NoError(t, db.Create(&project).Error)

	// Control document with SCF metadata
	scfID := "AC-01"
	frameworksJSON := []byte("[\"soc2\",\"nist_csf\"]")
	doc := models.Document{
		ObjectID:         "doc-1",
		OrganizationID:   org.ID,
		ProjectID:        project.ID,
		Title:            "AC-01 - Access Control",
		Content:          "Control description that should NOT be exposed",
		Status:           "in_progress",
		SCFControlID:     &scfID,
		SCFFrameworkKeys: frameworksJSON,
	}
	assert.NoError(t, db.Create(&doc).Error)

	// SCF control metadata used for the public description
	scfControl := models.SCFControl{
		ObjectID:           scfID,
		Title:              "Access Control",
		ControlDescription: "SCF control-level description used in public commitment views.",
	}
	assert.NoError(t, db.Create(&scfControl).Error)

	// Framework mapping for this SCF control
	mapping := models.SCFFrameworkMap{
		Framework:    "NIST CSF",
		ExternalID:   "PR.AC-1",
		ExternalName: "Access control policy",
		SCFObjectID:  scfID,
	}
	assert.NoError(t, db.Create(&mapping).Error)

	// --- Public endpoint ---
	req := httptest.NewRequest(http.MethodGet, "/api/v1/public/commitment?org_id=org-share", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var publicResp CommitmentResponse
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&publicResp))
	assert.Equal(t, "org-share", publicResp.Organization.ObjectID)
	assert.True(t, publicResp.Organization.ShareCommitment)
	assert.Len(t, publicResp.Projects, 1)
	assert.Equal(t, "proj-1", publicResp.Projects[0].ObjectID)
	assert.Len(t, publicResp.Projects[0].Controls, 1)

	ctrl := publicResp.Projects[0].Controls[0]
	assert.Equal(t, "AC-01 - Access Control", ctrl.Title)
	// Description should come from SCFControl.ControlDescription, not from the
	// internal document content.
	assert.Contains(t, ctrl.Description, "SCF control-level description")
	assert.NotContains(t, ctrl.Description, "should NOT be exposed")
	assert.Equal(t, "in_progress", ctrl.Status)
	assert.Equal(t, "AC-01", ctrl.SCFID)
	assert.ElementsMatch(t, []string{"soc2", "nist_csf"}, ctrl.Frameworks)
	assert.Len(t, ctrl.FrameworkMappings, 1)
	assert.Equal(t, "NIST CSF", ctrl.FrameworkMappings[0].Framework)
	assert.ElementsMatch(t, []string{"PR.AC-1"}, ctrl.FrameworkMappings[0].ExternalIDs)

	// --- Private preview endpoint ---
	req = httptest.NewRequest(http.MethodGet, "/api/v1/org/org-share/commitment/preview", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var privateResp CommitmentResponse
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&privateResp))
	assert.Equal(t, publicResp.Organization.ObjectID, privateResp.Organization.ObjectID)
	assert.Len(t, privateResp.Projects, 1)
}
