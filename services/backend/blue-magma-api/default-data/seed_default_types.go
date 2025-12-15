package defaultdata

import (
	"encoding/json"
	"os"

	log "github.com/sirupsen/logrus"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"gorm.io/gorm"
)

type importType struct {
	ObjectID    string `gorm:"not null;unique" json:"object_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"` // Category of the type (e.g., "
}

func SeedDefaultTypes(db *gorm.DB) {
	log.Info("Seeding default subject types...")
	file, err := os.Open("./default-data/default_types.json")
	if err != nil {
		log.Printf("No default types file found: %v", err)
		log.Info("Skipping seeding default subject types")
		return
	}
	defer file.Close()

	var types []importType
	if err := json.NewDecoder(file).Decode(&types); err != nil {
		log.Info("Error decoding default types")
		log.Printf("Error decoding default rules: %v", err)
		return
	}

	for _, subjectType := range types {
		var existing models.SubjectType
		// log.Info("Checking if subject type exists: ", subjectType.ObjectID)
		err := db.Where("object_id = ?", subjectType.ObjectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			// Create new rule
			subjectToCreate := models.SubjectType{
				ObjectID:    subjectType.ObjectID,
				Name:        subjectType.Name,
				Category:    subjectType.Category,
				Description: subjectType.Description,
			}
			if err := db.Create(&subjectToCreate).Error; err != nil {
				log.Printf("Failed to create rule %s: %v", subjectType.ObjectID, err)
				log.Info("Skipping seeding default subject types")
			} else {
				log.Printf("Inserted rule: %s", subjectType.ObjectID)
				log.Info("✅ Default subject types seeded successfully")
			}
		}
	}
}
