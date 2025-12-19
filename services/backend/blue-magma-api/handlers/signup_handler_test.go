package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/bluemagma-compliance/blue-magma-api/database"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestHandleSignup(t *testing.T) {
	// Load env
	_ = godotenv.Load("../../.env")

	// Require access-code for this test to exercise the Redis flow
	os.Setenv("ACCESS_CODE_REQUIRED", "true")
	defer os.Unsetenv("ACCESS_CODE_REQUIRED")

	// Setup in-memory DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate all models including RBAC
	err = db.AutoMigrate(
		&models.Organization{},
		&models.User{},
		&models.Role{},
		&models.UserRole{},
	)
	assert.NoError(t, err)

	// Seed RBAC data
	err = database.SeedRBAC(db)
	assert.NoError(t, err)

	// Setup in-memory Redis and seed a one-use access code
	m, err := miniredis.Run()
	assert.NoError(t, err)
	defer m.Close()
	m.Set("access_code:TEST123", "1")

	rdb := redis.NewClient(&redis.Options{Addr: m.Addr()})

	// Setup Fiber app and route
	app := fiber.New()
	handler := &SignupHandler{DB: db, Redis: rdb}
	app.Post("/auth/signup", handler.HandleSignup)

	// Prepare test request
	reqBody := signupRequest{
		FirstName:  "Alice",
		LastName:   "Smith",
		Email:      "alice@example.com",
		Password:   "securepass123",
		Phone:      "555-1234",
		AccessCode: "TEST123",
	}
	body, _ := json.Marshal(reqBody)

	// Send request
	req, _ := http.NewRequest("POST", "/auth/signup", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	// Decode response
	var result SignupResponse
	json.NewDecoder(resp.Body).Decode(&result)

	assert.True(t, result.Success)
	assert.NotZero(t, result.UserID)
	assert.NotEmpty(t, result.AccessToken)
	assert.NotEmpty(t, result.RefreshToken)

	// Confirm user exists in DB
	var user models.User
	err = db.Where("object_id = ?", result.UserID).First(&user).Error
	assert.NoError(t, err)
	assert.Equal(t, reqBody.Email, user.Email)
}
