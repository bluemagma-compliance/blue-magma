package handlers

import (
    "encoding/json"
    "net/http/httptest"
    "testing"

    "github.com/bluemagma-compliance/blue-magma-api/models"
    "github.com/gofiber/fiber/v2"
    "github.com/stretchr/testify/assert"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

// setupDocumentFullTestDB creates an in-memory DB and Fiber app suitable for testing
// GetDocumentFull with SCF metadata.
func setupDocumentFullTestDB(t *testing.T) (*gorm.DB, models.Organization, models.Project) {
    db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
    assert.NoError(t, err)

    assert.NoError(t, db.AutoMigrate(
        &models.Organization{},
        &models.Project{},
        &models.Document{},
        &models.SCFFrameworkMap{},
        &models.Evidence{},
        &models.Collection{},
        &models.EvidenceRequest{},
        &models.DocumentRelation{},
    ))

    org := models.Organization{ObjectID: "org1", OrganizationName: "Test Org"}
    assert.NoError(t, db.Create(&org).Error)

    project := models.Project{ObjectID: "proj1", OrganizationID: org.ID, Name: "Test Project"}
    assert.NoError(t, db.Create(&project).Error)

    return db, org, project
}

// TestGetDocumentFull_IncludesSCFMetadata verifies that control documents expose
// SCF frameworks and framework_mappings in the full document response, consistent
// with the trust center commitment views.
func TestGetDocumentFull_IncludesSCFMetadata(t *testing.T) {
    db, org, project := setupDocumentFullTestDB(t)
    app := fiber.New()
    handler := NewDocumentHandler(db)

    scfID := "GOV-01"

    // Seed a control document with SCF metadata
    doc := models.Document{
        ObjectID:       "doc1",
        OrganizationID: org.ID,
        ProjectID:      project.ID,
        TemplatePageID: "control-gov-01",
        Title:          "Access Control",
        Content:        "Some control content",
    }

    // Framework keys: SOC 2 and NIST CSF
    frameworksJSON := []byte("[\"soc2\",\"nist_csf\"]")
    doc.SCFControlID = &scfID
    doc.SCFFrameworkKeys = frameworksJSON

    assert.NoError(t, db.Create(&doc).Error)

    // Seed SCF framework mappings for this control. Intentionally insert out of
    // order to verify deterministic sorting in the response.
    mappings := []models.SCFFrameworkMap{
        {Framework: "nist_csf", ExternalID: "PR.AC-2", SCFObjectID: scfID},
        {Framework: "nist_csf", ExternalID: "PR.AC-1", SCFObjectID: scfID},
        {Framework: "soc2", ExternalID: "CC1.1", SCFObjectID: scfID},
    }
    for _, m := range mappings {
        assert.NoError(t, db.Create(&m).Error)
    }

    // Middleware to inject organization
    app.Use(func(c *fiber.Ctx) error {
        c.Locals("organization", org)
        return c.Next()
    })

    app.Get("/api/v1/org/:org_id/project/:project_id/document/:document_id/full", handler.GetDocumentFull)

    req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/document/"+doc.ObjectID+"/full", nil)
    resp, err := app.Test(req)
    assert.NoError(t, err)
    assert.Equal(t, fiber.StatusOK, resp.StatusCode)

    var body struct {
        Document struct {
            ObjectID          string `json:"object_id"`
            IsControl         bool   `json:"is_control"`
            Frameworks        []string `json:"frameworks"`
            SCFID             string   `json:"scf_id"`
            FrameworkMappings []struct {
                Framework   string   `json:"framework"`
                ExternalIDs []string `json:"external_ids"`
            } `json:"framework_mappings"`
        } `json:"document"`
    }

    assert.NoError(t, json.NewDecoder(resp.Body).Decode(&body))

    // Basic document assertions
    assert.Equal(t, doc.ObjectID, body.Document.ObjectID)
    assert.True(t, body.Document.IsControl)

    // Framework keys should round-trip from SCFFrameworkKeys
    assert.ElementsMatch(t, []string{"soc2", "nist_csf"}, body.Document.Frameworks)

    // SCF control ID should be exposed
    assert.Equal(t, scfID, body.Document.SCFID)

    // Framework mappings should be grouped by framework and sorted
    assert.Len(t, body.Document.FrameworkMappings, 2)

    // First framework alphabetically should be nist_csf
    if body.Document.FrameworkMappings[0].Framework == "nist_csf" {
        assert.Equal(t, []string{"PR.AC-1", "PR.AC-2"}, body.Document.FrameworkMappings[0].ExternalIDs)
        assert.Equal(t, "soc2", body.Document.FrameworkMappings[1].Framework)
        assert.Equal(t, []string{"CC1.1"}, body.Document.FrameworkMappings[1].ExternalIDs)
    } else {
        // Or the reverse order, depending on sort, but still sorted within each framework
        assert.Equal(t, "nist_csf", body.Document.FrameworkMappings[1].Framework)
        assert.Equal(t, []string{"PR.AC-1", "PR.AC-2"}, body.Document.FrameworkMappings[1].ExternalIDs)
        assert.Equal(t, "soc2", body.Document.FrameworkMappings[0].Framework)
        assert.Equal(t, []string{"CC1.1"}, body.Document.FrameworkMappings[0].ExternalIDs)
    }
}

