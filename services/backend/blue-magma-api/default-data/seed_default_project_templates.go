package defaultdata

import (
	"encoding/json"
	"os"

	log "github.com/sirupsen/logrus"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type importProjectTemplate struct {
	ObjectID     string         `json:"object_id"`
	Title        string         `json:"title"`
	Description  string         `json:"description"`
	Category     string         `json:"category"`
	TemplateData datatypes.JSON `json:"template_data"`
	IsActive     bool           `json:"is_active"`
}

func SeedDefaultProjectTemplates(db *gorm.DB) {
	log.Info("Seeding default project templates...")
	file, err := os.Open("./default-data/default_project_templates.json")
	if err != nil {
		log.Printf("No default project templates file found: %v", err)
		log.Info("Skipping seeding default project templates")
		return
	}
	defer file.Close()

	var templates []importProjectTemplate
	if err := json.NewDecoder(file).Decode(&templates); err != nil {
		log.Info("Error decoding default project templates")
		log.Printf("Error decoding default project templates: %v", err)
		return
	}

	// Ensure the public organization exists
	orgID := EnsurePublicOrgExists(db)
	if orgID == 0 {
		log.Println("Failed to ensure public organization exists, aborting project template import.")
		return
	}

	for _, template := range templates {
		var existing models.ProjectTemplate
		err := db.Where("object_id = ?", template.ObjectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			// Create new project template
			templateToCreate := models.ProjectTemplate{
				ObjectID:       template.ObjectID,
				OrganizationID: orgID, // Use the public organization ID
				Title:          template.Title,
				Description:    template.Description,
				Category:       template.Category,
				TemplateData:   template.TemplateData,
				IsActive:       template.IsActive,
			}
			if err := db.Create(&templateToCreate).Error; err != nil {
				log.Printf("Failed to create project template %s: %v", template.ObjectID, err)
			} else {
				log.Printf("✅ Inserted project template: %s", template.Title)
			}
		} else {
			log.Printf("Project template %s already exists, skipping", template.ObjectID)
		}
	}

	log.Info("✅ Default project templates seeded successfully")
}

