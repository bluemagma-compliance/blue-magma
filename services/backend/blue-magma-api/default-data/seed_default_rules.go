package defaultdata

import (
	"encoding/json"
	"log"
	"os"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type importRule struct {
	ObjectID string `gorm:"not null;unique" json:"object_id"`

	Name           string         `json:"name"`
	Rule           string         `json:"rule"`
	PolicyName     string         `json:"policy_name"`
	PolicyVersion  string         `json:"policy_version"`
	EvidenceSchema datatypes.JSON `json:"evidence_schema"`
	Scope          string         `json:"scope"`
	Tags           string         `json:"tags"`
	Public         bool           `json:"Public"` // not really used other than for display reasons
	Source         string         `json:"source"`
	Description    string         `json:"description"`

	OrganizationID string
}

func EnsurePublicOrgExists(db *gorm.DB) uint {
	var org models.Organization
	err := db.Where("object_id = ?", "public").First(&org).Error
	if err == gorm.ErrRecordNotFound {
		publicOrg := models.Organization{
			ObjectID:                "public",
			OrganizationName:        "Public Organization",
			OrganizationDescription: "This is a public organization for shared rules.",
		}
		if err := db.Create(&publicOrg).Error; err != nil {
			log.Printf("Failed to create public org: %v", err)
			return 0 // Return 0 or handle error as needed
		} else {
			log.Printf("Created public org with object_id 'public'")
			return publicOrg.ID
		}
	}
	return org.ID
}

func SeedDefaultRules(db *gorm.DB) {
	file, err := os.Open("./default-data/default_rules.json")
	if err != nil {
		log.Printf("No default rules file found: %v", err)
		return
	}
	defer file.Close()

	var rules []importRule
	if err := json.NewDecoder(file).Decode(&rules); err != nil {
		log.Printf("Error decoding default rules: %v", err)
		return
	}

	// Ensure the public organization exists
	org_id := EnsurePublicOrgExists(db)
	if org_id == 0 {
		log.Println("Failed to ensure public organization exists, aborting rule import.")
		return
	}

	for _, rule := range rules {
		var existing models.Rule
		err := db.Where("object_id = ?", rule.ObjectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			// Create new rule
			ruleToCreate := models.Rule{
				ObjectID:       rule.ObjectID,
				Name:           rule.Name,
				Rule:           rule.Rule,
				PolicyName:     rule.PolicyName,
				PolicyVersion:  rule.PolicyVersion,
				EvidenceSchema: rule.EvidenceSchema,
				Scope:          rule.Scope,
				Tags:           rule.Tags,
				Public:         rule.Public,
				Source:         rule.Source,
				Description:    rule.Description,
				OrganizationID: org_id, // Use the public organization ID
			}
			if err := db.Create(&ruleToCreate).Error; err != nil {
				log.Printf("Failed to create rule %s: %v", rule.ObjectID, err)
			} else {
				log.Printf("Inserted rule: %s", rule.ObjectID)
			}
		}
	}
}
