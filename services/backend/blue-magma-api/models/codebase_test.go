package models_test

import (
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestDeleteCodebaseCascadesVersions(t *testing.T) {
	_, db := setupInMemoryApp(t)

	// Setup API route if you're testing through Fiber
	// OR you can work directly with DB for this cascade test

	// Create org
	org := models.Organization{
		ObjectID:         "org123",
		OrganizationName: "Test Org",
	}
	assert.NoError(t, db.Create(&org).Error)

	subjectType := models.SubjectType{
		ObjectID:    "subjectType123",
		Name:        "Test Subject Type",
		Description: "A test subject type",
		Category:    "Test Category",
	}
	assert.NoError(t, db.Create(&subjectType).Error)

	assert.NoError(t, db.Create(&models.APIKey{
		ObjectID:       "apikey123",
		OrganizationID: org.ID,
		Name:           "Test Key",
		Enabled:        true,
	}).Error)

	// Create codebase
	codebase := models.Codebase{
		ObjectID:       "codebase123",
		OrganizationID: org.ID,
		ServiceName:    "Test Service",
		APIKeyID:       1,
		SubjectTypeID:  subjectType.ID,
	}
	assert.NoError(t, db.Create(&codebase).Error)

	// Create versions
	versions := []models.CodebaseVersion{
		{
			ObjectID:       "version1",
			OrganizationID: org.ID,
			CodebaseID:     codebase.ID,
			BranchName:     "main",
			CommitHash:     "abc123",
		},
		{
			ObjectID:       "version2",
			OrganizationID: org.ID,
			CodebaseID:     codebase.ID,
			BranchName:     "dev",
			CommitHash:     "def456",
		},
	}
	for _, v := range versions {
		assert.NoError(t, db.Create(&v).Error)
	}

	// Verify versions exist
	var count int64
	db.Model(&models.CodebaseVersion{}).Where("codebase_id = ?", codebase.ID).Count(&count)
	assert.Equal(t, int64(2), count)

	// delete a single version
	assert.NoError(t, db.Delete(&models.CodebaseVersion{}, "object_id = ?", "version1").Error)

	// Delete codebase
	assert.NoError(t, db.Delete(&codebase).Error)

	// Verify versions are deleted
	db.Model(&models.CodebaseVersion{}).Where("codebase_id = ?", codebase.ID).Count(&count)
	assert.Equal(t, int64(0), count)
}

func setupInMemoryApp(t *testing.T) (any, *gorm.DB) {

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared&_foreign_keys=on"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	// Migrate the schema
	db.Migrator().DropTable(&models.CodebaseVersion{})
	db.Migrator().DropTable(&models.Codebase{})
	db.Migrator().DropTable(&models.Organization{})
	db.Migrator().DropTable(&models.SubjectType{})

	db.AutoMigrate(&models.Organization{}, &models.APIKey{}, &models.SubjectType{}, &models.Codebase{}, &models.CodebaseVersion{})
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	// Return nil for app (not used in this test), and db
	return nil, db
}
