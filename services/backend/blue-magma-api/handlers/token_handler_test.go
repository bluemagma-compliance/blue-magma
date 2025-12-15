package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestHandleToken(t *testing.T) {
	// Load env
	_ = godotenv.Load("../../.env")

	// Setup in-memory DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)
	err = db.AutoMigrate(&models.User{}, &models.Organization{}, &models.Role{}, &models.UserRole{})
	assert.NoError(t, err)

	// Create a test user
	hash, err := crypto.HashPassword("securepass123")
	assert.NoError(t, err)

	orgID := "test-org-id"

	org := models.Organization{
		ObjectID:                orgID,
		OrganizationName:        "Test Organization",
		OrganizationDescription: "Test organization for testing",
	}
	err = db.Create(&org).Error
	assert.NoError(t, err)

	// Create owner role
	ownerRole := models.Role{
		Name:           "owner",
		Description:    "Organization owner",
		HierarchyLevel: 4,
		IsActive:       true,
	}
	err = db.Create(&ownerRole).Error
	assert.NoError(t, err)

	phone := "555-1234"
	user := models.User{
		ObjectID:       "test-user-id",
		FirstName:      "Test",
		LastName:       "User",
		Email:          "test@example.com",
		Phone:          &phone,
		Verified:       true,
		Organization:   org,
		OrganizationID: org.ID,
		Username:       "test@example.com",
	}
	user.SetPasswordHash(hash)
	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Create user role assignment
	userRole := models.UserRole{
		UserID:         user.ID,
		RoleID:         ownerRole.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}
	err = db.Create(&userRole).Error
	assert.NoError(t, err)

	// Setup Fiber app and route
	app := fiber.New()
	handler := &TokenHandler{DB: db}
	app.Post("/auth/token", handler.HandleToken)

	// Test get password hash
	t.Run("Get Password Hash", func(t *testing.T) {
		passwordHash := user.GetPasswordHash()
		assert.Equal(t, hash, passwordHash)
	})

	// Test get password hash again
	t.Run("Get Password Hash Again", func(t *testing.T) {
		passwordHash := user.GetPasswordHash()
		assert.Equal(t, hash, passwordHash)
	})

	// Test password grant
	t.Run("Password Grant", func(t *testing.T) {
		reqBody := TokenRequest{
			GrantType: "password",
			Username:  "test@example.com",
			Password:  "securepass123",
		}
		body, _ := json.Marshal(reqBody)

		req, _ := http.NewRequest("POST", "/auth/token", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result TokenResponse
		json.NewDecoder(resp.Body).Decode(&result)

		assert.NotEmpty(t, result.AccessToken)
		assert.Equal(t, "Bearer", result.TokenType)
		assert.Equal(t, 7200, result.ExpiresIn)
		assert.NotEmpty(t, result.RefreshToken)
	})

	// Test refresh token grant
	t.Run("Refresh Token Grant", func(t *testing.T) {
		// First get a refresh token
		reqBody := TokenRequest{
			GrantType: "password",
			Username:  "test@example.com",
			Password:  "securepass123",
		}
		body, _ := json.Marshal(reqBody)

		req, _ := http.NewRequest("POST", "/auth/token", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result TokenResponse
		json.NewDecoder(resp.Body).Decode(&result)
		log.Warnf("Result: %+v", result)
		refreshToken := result.RefreshToken

		// Add a small delay to ensure different timestamps
		time.Sleep(1000 * time.Millisecond)

		// Now use the refresh token
		reqBody = TokenRequest{
			GrantType:    "refresh_token",
			RefreshToken: refreshToken,
		}
		body, _ = json.Marshal(reqBody)

		req, _ = http.NewRequest("POST", "/auth/token", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err = app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)

		var result2 TokenResponse
		json.NewDecoder(resp.Body).Decode(&result2)

		log.Warnf("Result 2: %+v", result2)

		assert.NotEmpty(t, result2.AccessToken)
		assert.Equal(t, "Bearer", result2.TokenType)
		assert.Equal(t, 7200, result2.ExpiresIn)
		assert.NotEmpty(t, result2.RefreshToken)
		assert.NotEqual(t, refreshToken, result2.RefreshToken) // Should be a new refresh token
	})

	// Test invalid password
	t.Run("Invalid Password", func(t *testing.T) {
		reqBody := TokenRequest{
			GrantType: "password",
			Username:  "test@example.com",
			Password:  "wrongpassword",
		}
		body, _ := json.Marshal(reqBody)

		req, _ := http.NewRequest("POST", "/auth/token", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	// Test invalid refresh token
	t.Run("Invalid Refresh Token", func(t *testing.T) {
		reqBody := TokenRequest{
			GrantType:    "refresh_token",
			RefreshToken: "invalid_token",
		}
		body, _ := json.Marshal(reqBody)

		req, _ := http.NewRequest("POST", "/auth/token", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	// Test unsupported grant type
	t.Run("Unsupported Grant Type", func(t *testing.T) {
		reqBody := TokenRequest{
			GrantType: "unsupported",
		}
		body, _ := json.Marshal(reqBody)

		req, _ := http.NewRequest("POST", "/auth/token", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})
}

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&models.User{}, &models.Organization{}, &models.Role{}, &models.UserRole{})
	assert.NoError(t, err)

	return db
}

func TestTokenHandler_PasswordGrant(t *testing.T) {
	db := setupTestDB(t)
	handler := NewTokenHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-id",
		OrganizationName: "Test Organization",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Create user role
	userRole := models.Role{
		Name:           "user",
		Description:    "Standard user",
		HierarchyLevel: 1,
		IsActive:       true,
	}
	err = db.Create(&userRole).Error
	assert.NoError(t, err)

	// Create a test user
	password := "testpassword123"
	hashedPassword, err := crypto.HashPassword(password)
	assert.NoError(t, err)

	user := models.User{
		ObjectID:       "test-user-id",
		Email:          "test@example.com",
		PasswordHash:   hashedPassword,
		Username:       "test@example.com",
		OrganizationID: org.ID,
	}
	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Create user role assignment
	userRoleAssignment := models.UserRole{
		UserID:         user.ID,
		RoleID:         userRole.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}
	err = db.Create(&userRoleAssignment).Error
	assert.NoError(t, err)

	// Create test request
	req := TokenRequest{
		GrantType: "password",
		Username:  user.Username,
		Password:  password,
	}
	body, err := json.Marshal(req)
	assert.NoError(t, err)

	// Create test context
	app := fiber.New()
	app.Post("/token", handler.HandleToken)
	request := httptest.NewRequest("POST", "/token", bytes.NewBuffer(body))
	request.Header.Set("Content-Type", "application/json")

	// Make request
	response, err := app.Test(request)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, response.StatusCode)

	// Parse response
	var result TokenResponse
	err = json.NewDecoder(response.Body).Decode(&result)
	assert.NoError(t, err)

	// Verify response
	assert.NotEmpty(t, result.AccessToken)
	assert.Equal(t, "Bearer", result.TokenType)
	assert.NotEmpty(t, result.RefreshToken)
	assert.Equal(t, "user", result.Scope)
	auth := authz.TokenService{}
	// Verify refresh token is stored for the user
	found, err := auth.FindRefreshToken(user.ObjectID, result.RefreshToken, db)
	assert.NoError(t, err)
	assert.True(t, found)
}

func TestTokenHandler_RefreshTokenGrant(t *testing.T) {
	db := setupTestDB(t)
	handler := NewTokenHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-id",
		OrganizationName: "Test Organization",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Create user role
	userRole := models.Role{
		Name:           "user",
		Description:    "Standard user",
		HierarchyLevel: 1,
		IsActive:       true,
	}
	err = db.Create(&userRole).Error
	assert.NoError(t, err)

	// Create a test user
	password := "testpassword123"
	hashedPassword, err := crypto.HashPassword(password)
	assert.NoError(t, err)

	user := models.User{
		ObjectID:       "test-user-id",
		Email:          "test@example.com",
		PasswordHash:   hashedPassword,
		Username:       "test@example.com",
		OrganizationID: org.ID,
	}
	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Create user role assignment
	userRoleAssignment := models.UserRole{
		UserID:         user.ID,
		RoleID:         userRole.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}
	err = db.Create(&userRoleAssignment).Error
	assert.NoError(t, err)

	// Get initial tokens
	initialReq := TokenRequest{
		GrantType: "password",
		Username:  user.Username,
		Password:  password,
	}
	initialBody, err := json.Marshal(initialReq)
	assert.NoError(t, err)

	app := fiber.New()
	app.Post("/token", handler.HandleToken)
	initialRequest := httptest.NewRequest("POST", "/token", bytes.NewBuffer(initialBody))
	initialRequest.Header.Set("Content-Type", "application/json")

	initialResponse, err := app.Test(initialRequest)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, initialResponse.StatusCode)

	var initialResult TokenResponse
	err = json.NewDecoder(initialResponse.Body).Decode(&initialResult)
	assert.NoError(t, err)

	// Add a small delay to ensure different timestamps
	time.Sleep(1000 * time.Millisecond)

	// Request new tokens using refresh token
	refreshReq := TokenRequest{
		GrantType:    "refresh_token",
		RefreshToken: initialResult.RefreshToken,
	}
	refreshBody, err := json.Marshal(refreshReq)
	assert.NoError(t, err)

	refreshRequest := httptest.NewRequest("POST", "/token", bytes.NewBuffer(refreshBody))
	refreshRequest.Header.Set("Content-Type", "application/json")

	refreshResponse, err := app.Test(refreshRequest)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, refreshResponse.StatusCode)

	var refreshResult TokenResponse
	err = json.NewDecoder(refreshResponse.Body).Decode(&refreshResult)
	assert.NoError(t, err)

	// Verify new tokens are different
	assert.NotEqual(t, initialResult.AccessToken, refreshResult.AccessToken)
	assert.NotEqual(t, initialResult.RefreshToken, refreshResult.RefreshToken)
	auth := authz.TokenService{}
	// Verify old refresh token is no longer valid
	found, err := auth.FindRefreshToken(user.ObjectID, initialResult.RefreshToken, db)
	assert.NoError(t, err)
	assert.False(t, found)

	// Verify new refresh token is valid
	found, err = auth.FindRefreshToken(user.ObjectID, refreshResult.RefreshToken, db)
	assert.NoError(t, err)
	assert.True(t, found)

	// Try to use the same refresh token again (should fail)
	reuseRequest := httptest.NewRequest("POST", "/token", bytes.NewBuffer(refreshBody))
	reuseRequest.Header.Set("Content-Type", "application/json")

	reuseResponse, err := app.Test(reuseRequest)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, reuseResponse.StatusCode)
}

func TestTokenHandler_RevokeToken(t *testing.T) {
	db := setupTestDB(t)
	handler := NewTokenHandler(db)

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-id",
		OrganizationName: "Test Organization",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Create user role
	userRole := models.Role{
		Name:           "user",
		Description:    "Standard user",
		HierarchyLevel: 1,
		IsActive:       true,
	}
	err = db.Create(&userRole).Error
	assert.NoError(t, err)

	// Create a test user
	password := "testpassword123"
	hashedPassword, err := crypto.HashPassword(password)
	assert.NoError(t, err)

	user := models.User{
		ObjectID:       "test-user-id",
		Email:          "test@example.com",
		PasswordHash:   hashedPassword,
		Username:       "test@example.com",
		OrganizationID: org.ID,
	}
	err = db.Create(&user).Error
	assert.NoError(t, err)

	// Create user role assignment
	userRoleAssignment := models.UserRole{
		UserID:         user.ID,
		RoleID:         userRole.ID,
		OrganizationID: org.ID,
		IsActive:       true,
	}
	err = db.Create(&userRoleAssignment).Error
	assert.NoError(t, err)

	// Get initial tokens
	initialReq := TokenRequest{
		GrantType: "password",
		Username:  user.Username,
		Password:  password,
	}
	initialBody, err := json.Marshal(initialReq)
	assert.NoError(t, err)

	app := fiber.New()
	app.Post("/token", handler.HandleToken)
	app.Post("/revoke", handler.RevokeToken)

	initialRequest := httptest.NewRequest("POST", "/token", bytes.NewBuffer(initialBody))
	initialRequest.Header.Set("Content-Type", "application/json")

	initialResponse, err := app.Test(initialRequest)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, initialResponse.StatusCode)

	var initialResult TokenResponse
	err = json.NewDecoder(initialResponse.Body).Decode(&initialResult)
	assert.NoError(t, err)

	auth := authz.TokenService{}
	// Verify refresh token is stored for the user
	found, err := auth.FindRefreshToken(user.ObjectID, initialResult.RefreshToken, db)
	assert.NoError(t, err)
	assert.True(t, found)

	// Revoke the refresh token
	revokeReq := RevokeTokenRequest{
		RefreshToken: initialResult.RefreshToken,
	}
	revokeBody, err := json.Marshal(revokeReq)
	assert.NoError(t, err)

	revokeRequest := httptest.NewRequest("POST", "/revoke", bytes.NewBuffer(revokeBody))
	revokeRequest.Header.Set("Content-Type", "application/json")

	revokeResponse, err := app.Test(revokeRequest)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, revokeResponse.StatusCode)

	auth = authz.TokenService{}
	// Verify refresh token is no longer valid
	found, err = auth.FindRefreshToken(user.ObjectID, initialResult.RefreshToken, db)
	assert.NoError(t, err)
	assert.False(t, found)

	// Try to use the revoked refresh token (should fail)
	refreshReq := TokenRequest{
		GrantType:    "refresh_token",
		RefreshToken: initialResult.RefreshToken,
	}
	refreshBody, err := json.Marshal(refreshReq)
	assert.NoError(t, err)

	refreshRequest := httptest.NewRequest("POST", "/token", bytes.NewBuffer(refreshBody))
	refreshRequest.Header.Set("Content-Type", "application/json")

	refreshResponse, err := app.Test(refreshRequest)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, refreshResponse.StatusCode)
}
