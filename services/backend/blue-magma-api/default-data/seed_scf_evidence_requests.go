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

// SeedSCFEvidenceRequests imports SCF Evidence Request List entries from the JSON export if present.
func SeedSCFEvidenceRequests(db *gorm.DB) {
	path := "./default-data/other_scf_data/secure-controls-framework-scf-2025-3-1.xlsx - Evidence Request List 2025.3.1.json"
	f, err := os.Open(path)
	if err != nil {
		log.Infof("No SCF Evidence Request List file found (%s): %v — skipping seeding", path, err)
		return
	}
	defer f.Close()

	var items []map[string]any
	if err := json.NewDecoder(f).Decode(&items); err != nil {
		log.Errorf("Failed to decode SCF Evidence Request List JSON: %v", err)
		return
	}

	for _, it := range items {
		// Extract identifier from "ERL #" (first value)
		objectID := ""
		if raw, ok := it["ERL #"]; ok {
			switch t := raw.(type) {
			case string:
				objectID = strings.TrimSpace(t)
			default:
				ids := parseSCFIDs(raw)
				if len(ids) > 0 {
					objectID = strings.TrimSpace(ids[0])
				}
			}
		}
		if objectID == "" {
			// Skip header or malformed rows
			continue
		}

		areaOfFocus, _ := it["Area of Focus"].(string)
		artifact, _ := it["Documentation Artifact"].(string)
		desc, _ := it["Artifact Description"].(string)
		controlMappings := toJoinedString(it["SCF Control Mappings"])

		rawJSON, err := json.Marshal(it)
		if err != nil {
			log.Warnf("Skipping SCF Evidence Request %s due to marshal error: %v", objectID, err)
			continue
		}

		up := models.SCFEvidenceRequest{
			ObjectID:        objectID,
			AreaOfFocus:     strings.TrimSpace(areaOfFocus),
			Artifact:        strings.TrimSpace(artifact),
			Description:     strings.TrimSpace(desc),
			ControlMappings: strings.TrimSpace(controlMappings),
			Data:            datatypes.JSON(rawJSON),
		}

		var existing models.SCFEvidenceRequest
		err = db.Where("object_id = ?", objectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&up).Error; err != nil {
				log.Errorf("Failed to insert SCF Evidence Request %s: %v", objectID, err)
			} else {
				log.Infof("Inserted SCF Evidence Request %s", objectID)
			}
			continue
		}
		if err != nil {
			log.Errorf("Failed to query SCF Evidence Request %s: %v", objectID, err)
			continue
		}

		existing.AreaOfFocus = up.AreaOfFocus
		existing.Artifact = up.Artifact
		existing.Description = up.Description
		existing.ControlMappings = up.ControlMappings
		existing.Data = up.Data
		if err := db.Save(&existing).Error; err != nil {
			log.Errorf("Failed to update SCF Evidence Request %s: %v", objectID, err)
		}
	}
}

