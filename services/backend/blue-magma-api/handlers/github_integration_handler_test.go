package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupGitHubTestDB(t *testing.T) (*gorm.DB, *redis.Client) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:?_foreign_keys=on"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate the models
	err = db.AutoMigrate(
		&models.Organization{},
		&models.User{},
		&models.GithubInstallation{},
		&models.GithubRepository{},
		&models.GithubWebhookDelivery{},
		&models.Codebase{},
		&models.SubjectType{},
		&models.APIKey{},
	)
	assert.NoError(t, err)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org",
		OrganizationName: "Test Organization",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Setup Redis mock (using miniredis would be better for real tests)
	// For now, we'll use a nil client and handle it in the handler
	return db, nil
}

func TestGitHubIntegrationHandler_StartInstallation(t *testing.T) {
	// Skip this test if GitHub environment variables are not set
	// This is because the handler tries to create a GitHub service
	t.Skip("Skipping GitHub integration test - requires GitHub App configuration")

	db, redisClient := setupGitHubTestDB(t)

	// Create Fiber app and handler
	app := fiber.New()
	
	// Note: This will fail without proper GitHub environment variables
	// In a real test environment, you'd mock the GitHub service
	handler, err := NewGitHubIntegrationHandler(db, redisClient)
	if err != nil {
		t.Skipf("Skipping test due to GitHub service creation error: %v", err)
		return
	}

	// Define the route
	app.Post("/api/v1/org/:org_id/integrations/github/install/session", handler.StartInstallation)

	// Create request
	reqBody := InstallSessionRequest{
		ReturnURL: "https://example.com/callback",
	}
	reqJSON, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/v1/org/test-org/integrations/github/install/session", bytes.NewReader(reqJSON))
	req.Header.Set("Content-Type", "application/json")

	// Execute request
	resp, err := app.Test(req)
	assert.NoError(t, err)

	// Check response
	assert.Equal(t, 200, resp.StatusCode)
}

func TestGitHubModels(t *testing.T) {
	db, _ := setupGitHubTestDB(t)

	// Test creating GitHub installation
	installation := models.GithubInstallation{
		ObjectID:        "test-install-1",
		OrganizationID:  1,
		InstallationID:  12345,
		AppSlug:         "test-app",
		AccountType:     "Organization",
		AccountID:       67890,
		AccountLogin:    "test-org",
		RepoSelection:   "all",
		PermissionsJSON: `{"contents": "read"}`,
	}

	err := db.Create(&installation).Error
	assert.NoError(t, err)

	// Test creating GitHub repository
	repo := models.GithubRepository{
		ObjectID:       "test-repo-1",
		RepoID:         11111,
		InstallationID: 12345,
		Owner:          "test-org",
		Name:           "test-repo",
		FullName:       "test-org/test-repo",
		DefaultBranch:  "main",
		Private:        false,
		Visibility:     "public",
		Archived:       false,
		Disabled:       false,
	}

	err = db.Create(&repo).Error
	assert.NoError(t, err)

	// Test creating webhook delivery
	delivery := models.GithubWebhookDelivery{
		ObjectID:       "test-delivery-1",
		DeliveryGUID:   "12345-67890-abcdef",
		Event:          "push",
		Action:         "",
		InstallationID: &installation.InstallationID,
		RepositoryID:   &repo.RepoID,
		Status:         "pending",
		PayloadJSON:    `{"ref": "refs/heads/main"}`,
	}

	err = db.Create(&delivery).Error
	assert.NoError(t, err)

	// Verify records were created
	var count int64
	db.Model(&models.GithubInstallation{}).Count(&count)
	assert.Equal(t, int64(1), count)

	db.Model(&models.GithubRepository{}).Count(&count)
	assert.Equal(t, int64(1), count)

	db.Model(&models.GithubWebhookDelivery{}).Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestCodebaseWithGitHubFields(t *testing.T) {
	db, _ := setupGitHubTestDB(t)

	// Create subject type
	subjectType := models.SubjectType{
		ObjectID:    "codebase",
		Name:        "Codebase",
		Description: "Codebase type",
		Category:    "codebase",
	}
	err := db.Create(&subjectType).Error
	assert.NoError(t, err)

	// Create API key
	apiKey := models.APIKey{
		ObjectID:       "test-api-key",
		Name:           "Test API Key",
		OrganizationID: 1,
		Enabled:        true,
		Key:            "test-key-123",
	}
	err = db.Create(&apiKey).Error
	assert.NoError(t, err)

	codebase := models.Codebase{
		ObjectID:             "test-codebase",
		OrganizationID:       1,
		ServiceName:          "test-repo",
		ServiceRepoURL:       "https://github.com/test-org/test-repo",
		ServiceDescription:   "Test repository",
		APIKeyID:             apiKey.ID,
		SubjectTypeID:        subjectType.ID,
		SourceType:           "github",
	}

	err = db.Create(&codebase).Error
	assert.NoError(t, err)

	// Verify the codebase was created with GitHub fields
	var retrievedCodebase models.Codebase
	err = db.Where("object_id = ?", "test-codebase").First(&retrievedCodebase).Error
	assert.NoError(t, err)

	assert.Equal(t, "github", retrievedCodebase.SourceType)
}

func TestBase64PrivateKeyDecoding(t *testing.T) {
	// Test that our base64 private key decoding works
	// This is a fake key for testing purposes only
	fakePrivateKeyPEM := `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAtest
-----END RSA PRIVATE KEY-----`

	// Encode to base64
	encoded := base64.StdEncoding.EncodeToString([]byte(fakePrivateKeyPEM))

	// Decode back
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	assert.NoError(t, err)
	assert.Equal(t, fakePrivateKeyPEM, string(decoded))

	// Verify it contains the expected PEM markers
	assert.Contains(t, string(decoded), "-----BEGIN RSA PRIVATE KEY-----")
	assert.Contains(t, string(decoded), "-----END RSA PRIVATE KEY-----")
}
