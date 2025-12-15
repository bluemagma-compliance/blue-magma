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

// TestCodebaseCreationAndRPCLookup tests the entire flow:
// 1. Create a codebase with a repo URL
// 2. Verify the repo name is extracted and stored as service name
// 3. Use RPC endpoint to lookup the codebase using just the repo name
func TestCodebaseCreationAndRPCLookup(t *testing.T) {
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

	// Create Fiber app and handlers
	app := fiber.New()
	codebaseHandler := NewCodebaseHandler(db)
	rpcHandler := NewRPCHandler(db, nil)

	// Define routes
	app.Post("/api/v1/org/:org_id/codebase", codebaseHandler.CreateCodebase)
	app.Post("/api/v1/org/:org_id/rpc/get-last-commit-hash/", rpcHandler.GetLastCommitHash)

	// Step 1: Create a codebase with a GitHub URL
	t.Run("Create codebase with GitHub URL", func(t *testing.T) {
		codebaseRequest := CodebaseRequest{
			CodebaseName:        "My Backend Service", // This will be ignored
			CodebaseRepoURL:     "https://github.com/bluemagma-compliance/backend",
			CodebaseDescription: "Backend service for the application",
			CodebaseType:        "codebase",
		}
		body, _ := json.Marshal(codebaseRequest)

		req := httptest.NewRequest("POST", "/api/v1/org/test-org/codebase", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, 201, resp.StatusCode)

		var response CodebaseResponse
		json.NewDecoder(resp.Body).Decode(&response)

		// Verify that the service name is the extracted repo name, not the provided name
		assert.Equal(t, "backend", response.CodebaseName)
		assert.Equal(t, "https://github.com/bluemagma-compliance/backend", response.CodebaseRepoURL)
		assert.Equal(t, "Backend service for the application", response.CodebaseDescription)
		assert.NotEmpty(t, response.ApiKey)
		assert.Equal(t, "test-org", response.OrganizationID)

		// Store the API key and codebase ObjectID for later use
		apiKey := response.ApiKey
		codebaseObjectID := response.ObjectID

		// Step 2: Create a codebase version with correct ObjectID pattern
		version := models.CodebaseVersion{
			ObjectID:       codebaseObjectID + "_main", // Use the pattern: {codebase.ObjectID}_{branchName}
			OrganizationID: org.ID,
			CodebaseID:     1, // First codebase created
			BranchName:     "main",
			CommitHash:     "abc123def456789",
		}
		err = db.Create(&version).Error
		assert.NoError(t, err)

		// Step 3: Use RPC endpoint to lookup using just the repo name
		t.Run("RPC lookup with repo name", func(t *testing.T) {
			rpcRequest := GetLastHashRequest{
				RepoUrl:    "backend", // Just the repo name, not the full URL
				BranchName: "main",
			}
			body, _ := json.Marshal(rpcRequest)

			req := httptest.NewRequest("POST", "/api/v1/org/test-org/rpc/get-last-commit-hash/", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", apiKey) // Use the API key from codebase creation
			resp, _ := app.Test(req)

			assert.Equal(t, 200, resp.StatusCode)

			var rpcResponse GetLastHashResponse
			json.NewDecoder(resp.Body).Decode(&rpcResponse)

			assert.Equal(t, "abc123def456789", rpcResponse.LastCommitHash)
		})
	})
}

// TestDocumentTreeHierarchy verifies the tree-building logic used in GetDocumentTree
// produces the expected parent/child relationships.
func TestDocumentTreeHierarchy(t *testing.T) {
	// Create an in-memory project and three documents wired as:
	// root (no parent) -> domain (parent=root) -> control (parent=domain).
	project := models.Project{ObjectID: "proj-doc-tree", Name: "Doc Tree Project"}

	rootID := uint(1)
	domainID := uint(2)
	controlID := uint(3)

	rootDoc := models.Document{
		ObjectID: "root-doc",
		Title:    "Controls Overview",
	}
	rootDoc.ID = rootID

	rootParentID := rootID
	domainDoc := models.Document{
		ObjectID: "domain-doc",
		Title:    "Domain A",
		ParentID: &rootParentID,
	}
	domainDoc.ID = domainID

	domainParentID := domainID
	controlDoc := models.Document{
		ObjectID: "control-doc",
		Title:    "Control 1",
		ParentID: &domainParentID,
	}
	controlDoc.ID = controlID

	documents := []models.Document{rootDoc, domainDoc, controlDoc}

	// This mirrors the logic in GetDocumentTree (kept here as a focused regression test).
	type TreeNode struct {
		DocumentResponse
		Children []*TreeNode `json:"children"`
	}

	nodeMap := make(map[uint]*TreeNode)
	var rootNodes []*TreeNode

	// First pass: create all nodes
	for _, doc := range documents {
		node := &TreeNode{
			DocumentResponse: buildDocumentResponse(doc, project),
			Children:         []*TreeNode{},
		}
		nodeMap[doc.ID] = node
	}

	// Second pass: wire parents and children using pointers (matches handler).
	for _, doc := range documents {
		node := nodeMap[doc.ID]
		if doc.ParentID == nil {
			rootNodes = append(rootNodes, node)
		} else if parent, exists := nodeMap[*doc.ParentID]; exists {
			parent.Children = append(parent.Children, node)
		}
	}

	// We expect a single root, with one domain child, which itself has one control child.
	if assert.Len(t, rootNodes, 1) {
		root := rootNodes[0]
		assert.Equal(t, "Controls Overview", root.Title)
		if assert.Len(t, root.Children, 1) {
			domain := root.Children[0]
			assert.Equal(t, "Domain A", domain.Title)
			if assert.Len(t, domain.Children, 1) {
				control := domain.Children[0]
				assert.Equal(t, "Control 1", control.Title)
			}
		}
	}
}
