package models

import (
	"os"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEmailHashGeneration(t *testing.T) {
	// Set encryption key for testing
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")

	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&User{}, &Organization{})
	assert.NoError(t, err)

	// Create organization first
	org := Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Org",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create a user
	user := User{
		ObjectID:       "test-user-123",
		Email:          "test@example.com",
		FirstName:      "Test",
		LastName:       "User",
		Username:       "test@example.com",
		OrganizationID: org.ID,
	}

	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Verify email_hash was set
	assert.NotEmpty(t, user.EmailHash)
	expectedHash := crypto.HashString("test@example.com")
	assert.Equal(t, expectedHash, user.EmailHash)

	// Verify email was encrypted
	assert.NotEqual(t, "test@example.com", user.Email)
}

func TestFindByEmail(t *testing.T) {
	// Set encryption key for testing
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")

	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&User{}, &Organization{})
	assert.NoError(t, err)

	// Create organization first
	org := Organization{
		ObjectID:         "test-org-456",
		OrganizationName: "Test Org 2",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create a user
	user := User{
		ObjectID:       "test-user-456",
		Email:          "findme@example.com",
		FirstName:      "Find",
		LastName:       "Me",
		Username:       "findme@example.com",
		OrganizationID: org.ID,
	}

	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Find user by email
	foundUser, err := FindByEmail(db, "findme@example.com")
	assert.NoError(t, err)
	assert.NotNil(t, foundUser)
	assert.Equal(t, user.ObjectID, foundUser.ObjectID)
	assert.Equal(t, "findme@example.com", foundUser.Email) // Should be decrypted
	assert.Equal(t, "Find", foundUser.FirstName)           // Should be decrypted
	assert.Equal(t, "Me", foundUser.LastName)              // Should be decrypted

	// Try to find non-existent user
	_, err = FindByEmail(db, "notfound@example.com")
	assert.Error(t, err)
	assert.Equal(t, gorm.ErrRecordNotFound, err)
}

func TestFindByEmailWithPreload(t *testing.T) {
	// Set encryption key for testing
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")

	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&User{}, &Organization{}, &Role{}, &UserRole{})
	assert.NoError(t, err)

	// Create organization
	org := Organization{
		ObjectID:         "test-org-789",
		OrganizationName: "Test Org 3",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create user
	user := User{
		ObjectID:       "test-user-789",
		Email:          "preload@example.com",
		FirstName:      "Preload",
		LastName:       "Test",
		Username:       "preload@example.com",
		OrganizationID: org.ID,
	}
	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Find user with preloaded organization
	foundUser, err := FindByEmailWithPreload(db, "preload@example.com", "Organization")
	assert.NoError(t, err)
	assert.NotNil(t, foundUser)
	assert.Equal(t, user.ObjectID, foundUser.ObjectID)
	assert.Equal(t, "Test Org 3", foundUser.Organization.OrganizationName)
}

