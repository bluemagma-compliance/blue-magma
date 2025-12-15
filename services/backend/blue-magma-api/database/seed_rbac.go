package database

import (
	"log"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"gorm.io/gorm"
)

// SeedRBAC seeds the database with initial roles
func SeedRBAC(db *gorm.DB) error {
	// Create roles with hierarchy (higher numbers = higher privileges)
	roles := []models.Role{
		{Name: "user", Description: "Standard user with basic access", HierarchyLevel: 1, IsActive: true},
		{Name: "legal", Description: "Legal team with compliance and rule management access", HierarchyLevel: 2, IsActive: true},
		{Name: "admin", Description: "Administrator with user management capabilities", HierarchyLevel: 3, IsActive: true},
		{Name: "owner", Description: "Organization owner with full access", HierarchyLevel: 4, IsActive: true},
	}

	for _, role := range roles {
		// Check if role already exists using Count to avoid "record not found" logs
		var count int64
		db.Model(&models.Role{}).Where("name = ?", role.Name).Count(&count)

		if count == 0 {
			if err := db.Create(&role).Error; err != nil {
				log.Printf("Failed to create role %s: %v", role.Name, err)
				return err
			}
			log.Printf("Created role: %s", role.Name)
		}
	}

	log.Println("RBAC seeding completed successfully")
	return nil
}


