package defaultdata

import (
	"encoding/json"
	"os"
	"strings"

	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/bluemagma-compliance/blue-magma-api/models"
)

// firstFromSCFIDs returns the first SCF identifier from a value that may be a string or list.
func firstFromSCFIDs(v any) string {
	ids := parseSCFIDs(v)
	if len(ids) == 0 {
		return ""
	}
	return strings.TrimSpace(ids[0])
}

// SeedSCFAssessmentObjectives imports SCF Assessment Objectives (AO) from the JSON export if present.
func SeedSCFAssessmentObjectives(db *gorm.DB) {
	path := "./default-data/other_scf_data/secure-controls-framework-scf-2025-3-1.xlsx - Assessment Objectives 2025.3.1.json"
	f, err := os.Open(path)
	if err != nil {
		log.Infof("No SCF Assessment Objectives file found (%s): %v — skipping seeding", path, err)
		return
	}
	defer f.Close()

	var items []map[string]any
	if err := json.NewDecoder(f).Decode(&items); err != nil {
		log.Errorf("Failed to decode SCF Assessment Objectives JSON: %v", err)
		return
	}

	for _, it := range items {
		objectID := firstFromSCFIDs(it["SCF AO #"])
		if objectID == "" {
			// Skip header or malformed rows
			continue
		}

		controlMappings := toJoinedString(it["SCF #"])
		statement, _ := it["SCF Assessment Objective (AO) In addition to relevant policies, standards and procedures, the assessor shall examine, interview, and/or test to determine if appropriately scoped evidence exists to support the claim that:"].(string)
		origin := toJoinedString(it["SCF Assessment Objective (AO) Origin(s)"])
		isBaseline := truthy(it["SCF Baseline AOs"])

		rawJSON, err := json.Marshal(it)
		if err != nil {
			log.Warnf("Skipping SCF Assessment Objective %s due to marshal error: %v", objectID, err)
			continue
		}

		up := models.SCFAssessmentObjective{
			ObjectID:        strings.TrimSpace(objectID),
			ControlMappings: strings.TrimSpace(controlMappings),
			Statement:       strings.TrimSpace(statement),
			Origin:          strings.TrimSpace(origin),
			IsSCFBaseline:   isBaseline,
			Data:            datatypes.JSON(rawJSON),
		}

		var existing models.SCFAssessmentObjective
		err = db.Where("object_id = ?", up.ObjectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&up).Error; err != nil {
				log.Errorf("Failed to insert SCF Assessment Objective %s: %v", up.ObjectID, err)
			} else {
				log.Infof("Inserted SCF Assessment Objective %s", up.ObjectID)
			}
			continue
		}
		if err != nil {
			log.Errorf("Failed to query SCF Assessment Objective %s: %v", up.ObjectID, err)
			continue
		}

		existing.ControlMappings = up.ControlMappings
		existing.Statement = up.Statement
		existing.Origin = up.Origin
		existing.IsSCFBaseline = up.IsSCFBaseline
		existing.Data = up.Data
		if err := db.Save(&existing).Error; err != nil {
			log.Errorf("Failed to update SCF Assessment Objective %s: %v", up.ObjectID, err)
		}
	}
}

