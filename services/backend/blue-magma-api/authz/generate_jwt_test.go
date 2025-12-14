package authz

import (
	"os"
	"testing"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestGenerateTokens(t *testing.T) {
	// Set up encryption key for user model
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012") // 32 bytes
	defer os.Unsetenv("ENCRYPTION_KEY")

	// Setup test database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate models
	err = db.AutoMigrate(&models.Organization{}, &models.User{}, &models.Role{}, &models.UserRole{})
	assert.NoError(t, err)

	// Create test data
	org := models.Organization{ObjectID: "test-org", OrganizationName: "Test Org"}
	db.Create(&org)

	role := models.Role{Name: "owner", HierarchyLevel: 4, IsActive: true}
	db.Create(&role)

	phone1 := "1234567890"
	user := models.User{
		ObjectID:       "123",
		Username:       "testuser",
		Email:          "test@example.com",
		Phone:          &phone1,
		OrganizationID: org.ID,
	}
	db.Create(&user)

	userRole := models.UserRole{
		UserID:         user.ID,
		RoleID:         role.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}
	db.Create(&userRole)

	// Test that generating tokens for the same user ID at different times produces different tokens
	userID := "123"

	// Generate first set of tokens
	accessToken1, err := GenerateAccessToken(userID, db)
	assert.NoError(t, err)
	assert.NotEmpty(t, accessToken1)

	refreshToken1, err := GenerateRefreshToken(userID)
	assert.NoError(t, err)
	assert.NotEmpty(t, refreshToken1)

	// Wait a moment to ensure different timestamps
	time.Sleep(1000 * time.Millisecond)

	// Generate second set of tokens
	accessToken2, err := GenerateAccessToken(userID, db)
	assert.NoError(t, err)
	assert.NotEmpty(t, accessToken2)

	refreshToken2, err := GenerateRefreshToken(userID)
	assert.NoError(t, err)
	assert.NotEmpty(t, refreshToken2)

	// Verify that the tokens are different
	assert.NotEqual(t, accessToken1, accessToken2, "Access tokens should be different")
	assert.NotEqual(t, refreshToken1, refreshToken2, "Refresh tokens should be different")

	// Test that generating tokens for different user IDs produces different tokens
	// Create another user
	phone2 := "0987654321"
	user2 := models.User{
		ObjectID:       "456",
		Username:       "testuser2",
		Email:          "test2@example.com",
		Phone:          &phone2,
		OrganizationID: org.ID,
	}
	db.Create(&user2)

	userRole2 := models.UserRole{
		UserID:         user2.ID,
		RoleID:         role.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}
	db.Create(&userRole2)

	userID2 := "456"
	accessToken3, err := GenerateAccessToken(userID2, db)
	assert.NoError(t, err)
	assert.NotEmpty(t, accessToken3)

	refreshToken3, err := GenerateRefreshToken(userID2)
	assert.NoError(t, err)
	assert.NotEmpty(t, refreshToken3)

	// Verify that the tokens are different
	assert.NotEqual(t, accessToken1, accessToken3, "Access tokens for different users should be different")
	assert.NotEqual(t, refreshToken1, refreshToken3, "Refresh tokens for different users should be different")
}
