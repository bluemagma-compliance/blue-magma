package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/database"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSuperAdminTest(t *testing.T) (*gorm.DB, *fiber.App, *SuperAdminAuthHandler) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate super admin table
	err = db.AutoMigrate(&models.SuperAdmin{})
	assert.NoError(t, err)

	// Set required env vars for JWT
	os.Setenv("SUPER_ADMIN_JWT_SECRET", "test-super-admin-secret-key-32bytes!")

	// Create test super admin
	passwordHash, err := crypto.HashPassword("TestPassword123!")
	assert.NoError(t, err)

	superAdmin := models.SuperAdmin{
		LoginIdentifier: "test-super-admin",
		PasswordHash:    passwordHash,
		AllowedIPs:      "127.0.0.1,192.168.1.0/24",
		TwoFactorEmails: "admin@example.com,security@example.com",
		IsActive:        true,
	}
	err = db.Create(&superAdmin).Error
	assert.NoError(t, err)

	// Setup Fiber app
	app := fiber.New()
	handler := &SuperAdminAuthHandler{
		DB:           db,
		EmailService: nil, // Email service not needed for tests
	}

	return db, app, handler
}

func TestSuperAdminLogin_Success(t *testing.T) {
	db, app, handler := setupSuperAdminTest(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	app.Post("/super-admin/auth/login", handler.HandleSuperAdminLogin)

	reqBody := SuperAdminLoginRequest{
		LoginIdentifier: "test-super-admin",
		Password:        "TestPassword123!",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/super-admin/auth/login", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "127.0.0.1") // Whitelisted IP

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, 200, resp.StatusCode)

	var response SuperAdminLoginResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.True(t, response.Success)
	assert.Contains(t, response.Message, "2FA code sent")

	// Verify 2FA code was set in database
	var superAdmin models.SuperAdmin
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	assert.NotEmpty(t, superAdmin.TwoFactorCode)
	assert.NotNil(t, superAdmin.TwoFactorCodeExpiration)
	assert.True(t, superAdmin.Is2FACodeValid())
}

func TestSuperAdminLogin_InvalidPassword(t *testing.T) {
	db, app, handler := setupSuperAdminTest(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	app.Post("/super-admin/auth/login", handler.HandleSuperAdminLogin)

	reqBody := SuperAdminLoginRequest{
		LoginIdentifier: "test-super-admin",
		Password:        "WrongPassword",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/super-admin/auth/login", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "127.0.0.1")

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, 401, resp.StatusCode)

	var response SuperAdminLoginResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "Invalid credentials")

	// Verify failed login was recorded
	var superAdmin models.SuperAdmin
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	assert.Equal(t, 1, superAdmin.FailedLoginCount)
}

func TestSuperAdminLogin_IPNotWhitelisted(t *testing.T) {
	db, app, handler := setupSuperAdminTest(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	app.Post("/super-admin/auth/login", handler.HandleSuperAdminLogin)

	reqBody := SuperAdminLoginRequest{
		LoginIdentifier: "test-super-admin",
		Password:        "TestPassword123!",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/super-admin/auth/login", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "10.0.0.1") // Not whitelisted

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, 403, resp.StatusCode)

	var response SuperAdminLoginResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "IP address not whitelisted")
}

func TestSuperAdminVerify2FA_Success(t *testing.T) {
	db, app, handler := setupSuperAdminTest(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	// Setup 2FA code
	var superAdmin models.SuperAdmin
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	expiresAt := time.Now().Add(5 * time.Minute)
	superAdmin.TwoFactorCode = "123456"
	superAdmin.TwoFactorCodeExpiration = &expiresAt
	superAdmin.TwoFactorCodeAttempts = 0
	db.Save(&superAdmin)

	app.Post("/super-admin/auth/verify-2fa", handler.HandleSuperAdminVerify2FA)

	reqBody := SuperAdminVerify2FARequest{
		LoginIdentifier: "test-super-admin",
		Code:            "123456",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/super-admin/auth/verify-2fa", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "127.0.0.1")

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, 200, resp.StatusCode)

	var response SuperAdminVerify2FAResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.True(t, response.Success)
	assert.NotEmpty(t, response.AccessToken)
	assert.Equal(t, "Bearer", response.TokenType)
	assert.Greater(t, response.ExpiresIn, 0)

	// Verify 2FA code was cleared
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	assert.Empty(t, superAdmin.TwoFactorCode)
	assert.Nil(t, superAdmin.TwoFactorCodeExpiration)
}

func TestSuperAdminVerify2FA_InvalidCode(t *testing.T) {
	db, app, handler := setupSuperAdminTest(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	// Setup 2FA code
	var superAdmin models.SuperAdmin
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	expiresAt := time.Now().Add(5 * time.Minute)
	superAdmin.TwoFactorCode = "123456"
	superAdmin.TwoFactorCodeExpiration = &expiresAt
	superAdmin.TwoFactorCodeAttempts = 0
	db.Save(&superAdmin)

	app.Post("/super-admin/auth/verify-2fa", handler.HandleSuperAdminVerify2FA)

	reqBody := SuperAdminVerify2FARequest{
		LoginIdentifier: "test-super-admin",
		Code:            "999999", // Wrong code
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/super-admin/auth/verify-2fa", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "127.0.0.1")

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, 401, resp.StatusCode)

	var response SuperAdminVerify2FAResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "Invalid 2FA code")

	// Verify attempt was incremented
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	assert.Equal(t, 1, superAdmin.TwoFactorCodeAttempts)
}

func TestSuperAdminVerify2FA_ExpiredCode(t *testing.T) {
	db, app, handler := setupSuperAdminTest(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	// Setup expired 2FA code
	var superAdmin models.SuperAdmin
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	expiresAt := time.Now().Add(-1 * time.Minute) // Expired
	superAdmin.TwoFactorCode = "123456"
	superAdmin.TwoFactorCodeExpiration = &expiresAt
	db.Save(&superAdmin)

	app.Post("/super-admin/auth/verify-2fa", handler.HandleSuperAdminVerify2FA)

	reqBody := SuperAdminVerify2FARequest{
		LoginIdentifier: "test-super-admin",
		Code:            "123456",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/super-admin/auth/verify-2fa", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "127.0.0.1")

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, 401, resp.StatusCode)

	var response SuperAdminVerify2FAResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "2FA code expired")
}

func TestSuperAdminVerify2FA_IPMismatch(t *testing.T) {
	db, app, handler := setupSuperAdminTest(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	// Setup 2FA code
	var superAdmin models.SuperAdmin
	db.Where("login_identifier = ?", "test-super-admin").First(&superAdmin)
	expiresAt := time.Now().Add(5 * time.Minute)
	superAdmin.TwoFactorCode = "123456"
	superAdmin.TwoFactorCodeExpiration = &expiresAt
	db.Save(&superAdmin)

	app.Post("/super-admin/auth/verify-2fa", handler.HandleSuperAdminVerify2FA)

	reqBody := SuperAdminVerify2FARequest{
		LoginIdentifier: "test-super-admin",
		Code:            "123456",
	}
	bodyBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/super-admin/auth/verify-2fa", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Real-IP", "10.0.0.1") // Not whitelisted

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, 403, resp.StatusCode)

	var response SuperAdminVerify2FAResponse
	json.NewDecoder(resp.Body).Decode(&response)
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "IP address not whitelisted")
}

