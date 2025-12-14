package handlers

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSearchDocumentTestDB(t *testing.T) (*gorm.DB, models.Organization, models.Project) {
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	assert.NoError(t, err)

	assert.NoError(t, db.AutoMigrate(&models.Organization{}, &models.Project{}, &models.Document{}))

	org := models.Organization{ObjectID: "org1", OrganizationName: "Test Org"}
	assert.NoError(t, db.Create(&org).Error)

	project := models.Project{ObjectID: "proj1", OrganizationID: org.ID, Name: "Test Project"}
	assert.NoError(t, db.Create(&project).Error)

	return db, org, project
}

func setupSearchEvidenceRequestTestDB(t *testing.T) (*gorm.DB, models.Organization, models.Project, models.Document) {
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	assert.NoError(t, err)

	assert.NoError(t, db.AutoMigrate(&models.Organization{}, &models.Project{}, &models.Document{}, &models.EvidenceRequest{}))

	org := models.Organization{ObjectID: "org1", OrganizationName: "Test Org"}
	assert.NoError(t, db.Create(&org).Error)

	project := models.Project{ObjectID: "proj1", OrganizationID: org.ID, Name: "Test Project"}
	assert.NoError(t, db.Create(&project).Error)

	doc := models.Document{ObjectID: "doc1", OrganizationID: org.ID, ProjectID: project.ID, Title: "Doc", Content: ""}
	assert.NoError(t, db.Create(&doc).Error)

	return db, org, project, doc
}

// TestGetDocuments_SearchAndLimit verifies that GetDocuments applies the top-5
// limit and supports case-insensitive title search within a project.
func TestGetDocuments_SearchAndLimit(t *testing.T) {
	db, org, project := setupSearchDocumentTestDB(t)
	app := fiber.New()
	handler := NewDocumentHandler(db)

	// Seed 6 documents with ordered titles
	for i := 1; i <= 6; i++ {
		doc := models.Document{
			ObjectID:       fmt.Sprintf("doc-%d", i),
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			Title:          fmt.Sprintf("Doc %d", i),
			Order:          i,
		}
		assert.NoError(t, db.Create(&doc).Error)
	}

	// Simple middleware to inject organization
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("organization", org)
		return c.Next()
	})

	app.Get("/api/v1/org/:org_id/project/:project_id/document", handler.GetDocuments)

	// Without q: should return all documents ordered by `order` (no truncation).
	req := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/document", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var body struct {
		Documents []DocumentResponse `json:"documents"`
	}
	assert.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	assert.Len(t, body.Documents, 6)
	assert.Equal(t, "Doc 1", body.Documents[0].Title)
	assert.Equal(t, "Doc 6", body.Documents[5].Title)

	// With q present but empty: should return the first 5 documents ordered by
	// `order`.
	searchEmptyReq := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/document?q=", nil)
	searchEmptyResp, err := app.Test(searchEmptyReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, searchEmptyResp.StatusCode)

	var searchEmptyBody struct {
		Documents []DocumentResponse `json:"documents"`
	}
	assert.NoError(t, json.NewDecoder(searchEmptyResp.Body).Decode(&searchEmptyBody))
	assert.Len(t, searchEmptyBody.Documents, 5)
	assert.Equal(t, "Doc 1", searchEmptyBody.Documents[0].Title)
	assert.Equal(t, "Doc 5", searchEmptyBody.Documents[4].Title)

	// With q=Doc 2: should only return matching documents (1 in this case).
	searchReq := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/document?q=doc+2", nil)
	searchResp, err := app.Test(searchReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, searchResp.StatusCode)

	var searchBody struct {
		Documents []DocumentResponse `json:"documents"`
	}
	assert.NoError(t, json.NewDecoder(searchResp.Body).Decode(&searchBody))
	assert.Len(t, searchBody.Documents, 1)
	assert.Equal(t, "Doc 2", searchBody.Documents[0].Title)
}

// TestGetEvidenceRequests_SearchAndLimit verifies that GetEvidenceRequests
// applies the top-5 limit and supports case-insensitive title search within a
// project.
func TestGetEvidenceRequests_SearchAndLimit(t *testing.T) {
	db, org, project, doc := setupSearchEvidenceRequestTestDB(t)
	app := fiber.New()
	handler := NewEvidenceRequestHandler(db)

	// Seed 7 evidence requests, 5 matching "alpha" in the title.
	for i := 1; i <= 5; i++ {
		req := models.EvidenceRequest{
			ObjectID:       fmt.Sprintf("alpha-%d", i),
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			DocumentID:     doc.ID,
			Title:          fmt.Sprintf("Alpha Request %d", i),
			Status:         "pending",
		}
		assert.NoError(t, db.Create(&req).Error)
	}
	for i := 1; i <= 2; i++ {
		req := models.EvidenceRequest{
			ObjectID:       fmt.Sprintf("beta-%d", i),
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			DocumentID:     doc.ID,
			Title:          fmt.Sprintf("Beta Request %d", i),
			Status:         "pending",
		}
		assert.NoError(t, db.Create(&req).Error)
	}

	// Simple middleware to inject organization
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("organization", org)
		return c.Next()
	})

	app.Get("/api/v1/org/:org_id/project/:project_id/evidence-request", handler.GetEvidenceRequests)

	// Without q: should return all evidence requests.
	listReq := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/evidence-request", nil)
	listResp, err := app.Test(listReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, listResp.StatusCode)

	var listBody struct {
		EvidenceRequests []EvidenceRequestResponse `json:"evidence_requests"`
	}
	assert.NoError(t, json.NewDecoder(listResp.Body).Decode(&listBody))
	assert.Len(t, listBody.EvidenceRequests, 7)

	// With q present but empty: should return exactly 5 evidence requests.
	listEmptyReq := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/evidence-request?q=", nil)
	listEmptyResp, err := app.Test(listEmptyReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, listEmptyResp.StatusCode)

	var listEmptyBody struct {
		EvidenceRequests []EvidenceRequestResponse `json:"evidence_requests"`
	}
	assert.NoError(t, json.NewDecoder(listEmptyResp.Body).Decode(&listEmptyBody))
	assert.Len(t, listEmptyBody.EvidenceRequests, 5)

	// With q=alpha: should return up to 5 matching evidence requests.
	searchReq := httptest.NewRequest("GET", "/api/v1/org/"+org.ObjectID+"/project/"+project.ObjectID+"/evidence-request?q=alpha", nil)
	searchResp, err := app.Test(searchReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, searchResp.StatusCode)

	var searchBody struct {
		EvidenceRequests []EvidenceRequestResponse `json:"evidence_requests"`
	}
	assert.NoError(t, json.NewDecoder(searchResp.Body).Decode(&searchBody))
	assert.LessOrEqual(t, len(searchBody.EvidenceRequests), 5)
	for _, er := range searchBody.EvidenceRequests {
		assert.Contains(t, er.Title, "Alpha")
	}
}
