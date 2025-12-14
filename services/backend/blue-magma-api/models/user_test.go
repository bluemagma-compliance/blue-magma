package models

import (
	"testing"

	"os"

	"github.com/joho/godotenv"
	log "github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func checkEnvVars(vars []string) {
	missing := []string{}
	for _, v := range vars {
		if os.Getenv(v) == "" {
			missing = append(missing, v)
		}
	}
	if len(missing) > 0 {
		log.Error("Missing required environment variables: ", missing)
	} else {
		log.Info("✅ All required environment variables are set")
	}
}

func TestMain(m *testing.M) {
	_ = godotenv.Load("../../.env") // or just ".env"

	var requiredEnvVars = []string{
		"DB_HOST",
		"DB_USER",
		"DB_PASSWORD",
		"DB_NAME",
		"DB_PORT",
		"DB_SSLMODE",
		"LOG_LEVEL",
		"INTERNAL_API_KEY",
		"ENCRYPTION_KEY",
		"JWT_SECRET",
		"JWT_REFRESH_SECRET",
	}

	checkEnvVars(requiredEnvVars)
	log.Info("environment variables:")
	for _, v := range requiredEnvVars {
		log.Info(v, ":", os.Getenv(v))
	}
	log.Info("")
	os.Exit(m.Run())
}

func TestUserFieldEncryption(t *testing.T) {
	// Setup in-memory DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	// Migrate User model
	err = db.AutoMigrate(&User{})
	assert.NoError(t, err)

	// Expected decrypted values
	expected := User{
		ObjectID:   "12345",
		FirstName:  "Alice",
		LastName:   "Smith",
		Username:   "alice123",
		Email:      "alice@example.com",
		Address:    "123 Main St",
		City:       "Springfield",
		State:      "IL",
		PostalCode: "62704",
		Country:    "USA",
	}
	expectedPhone := "555-1234"

	// User we actually save (with a separate phone pointer to avoid aliasing expected)
	phone := expectedPhone
	userToSave := expected
	userToSave.Phone = &phone

	// Save to DB (BeforeSave triggers encryption)
	err = db.Create(&userToSave).Error
	assert.NoError(t, err)

	// Confirm some fields are encrypted at rest
	assert.NotEqual(t, expected.FirstName, userToSave.FirstName)
	assert.NotEqual(t, expected.Email, userToSave.Email)

	// Read back and validate decrypted fields
	var loaded User
	err = db.First(&loaded, "object_id = ?", expected.ObjectID).Error
	assert.NoError(t, err)

	assert.Equal(t, expected.FirstName, loaded.FirstName)
	assert.Equal(t, expected.LastName, loaded.LastName)
	assert.Equal(t, expected.Email, loaded.Email)
	if assert.NotNil(t, loaded.Phone) {
		assert.Equal(t, expectedPhone, *loaded.Phone)
	}
	assert.Equal(t, expected.Address, loaded.Address)
	assert.Equal(t, expected.City, loaded.City)
	assert.Equal(t, expected.State, loaded.State)
	assert.Equal(t, expected.PostalCode, loaded.PostalCode)
	assert.Equal(t, expected.Country, loaded.Country)
}
