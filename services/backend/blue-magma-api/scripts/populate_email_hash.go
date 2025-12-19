package main

import (
	"fmt"
	"log"
	"os"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// One-time script to populate email_hash for existing users
func main() {
	// Load .env file if it exists
	_ = godotenv.Load()

	// Get database connection string from environment
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")

	if dbHost == "" || dbPort == "" || dbUser == "" || dbPassword == "" || dbName == "" {
		log.Fatal("Database environment variables not set")
	}

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=require",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Populating email_hash for existing users...")
	
	var users []models.User
	if err := db.Find(&users).Error; err != nil {
		log.Fatalf("Failed to fetch users: %v", err)
	}

	count := 0
	for i := range users {
		// Skip if email_hash is already set
		if users[i].EmailHash != "" {
			log.Printf("User ID %d already has email_hash, skipping", users[i].ID)
			continue
		}

		// Decrypt email (AfterFind hook should have done this)
		if users[i].Email == "" {
			log.Printf("Skipping user ID %d - no email", users[i].ID)
			continue
		}

		// Generate hash from decrypted email
		emailHash := crypto.HashString(users[i].Email)
		
		// Update only the email_hash field without triggering BeforeSave
		if err := db.Model(&users[i]).UpdateColumn("email_hash", emailHash).Error; err != nil {
			log.Printf("Failed to update email_hash for user ID %d: %v", users[i].ID, err)
			continue
		}
		
		log.Printf("Updated email_hash for user ID %d (email: %s)", users[i].ID, users[i].Email)
		count++
	}

	log.Printf("Successfully populated email_hash for %d users", count)
}

