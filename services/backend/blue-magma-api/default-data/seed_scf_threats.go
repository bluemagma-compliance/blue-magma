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

// SeedSCFThreats imports SCF threat catalog entries from the JSON export if present.
func SeedSCFThreats(db *gorm.DB) {
	path := "./default-data/other_scf_data/secure-controls-framework-scf-2025-3-1.xlsx - Threat Catalog.json"
	f, err := os.Open(path)
	if err != nil {
		log.Infof("No SCF threat catalog file found (%s): %v — skipping seeding", path, err)
		return
	}
	defer f.Close()

	var items []map[string]any
	if err := json.NewDecoder(f).Decode(&items); err != nil {
		log.Errorf("Failed to decode SCF threat catalog JSON: %v", err)
		return
	}

	for _, it := range items {
		// Extract identifier from "Threat #" (first value)
		objectID := ""
		if raw, ok := it["Threat #"]; ok {
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

		grouping, _ := it["Threat Grouping"].(string)
		title := toJoinedString(it["Threat*"])
		desc := toJoinedString(it["Threat Description"])
		materiality := toJoinedString(it["Materiality Considerations If this threat materialized, would it potentially exceed the following financial impacts for the organization?"])

		// The export uses a second unnamed materiality column; append it if present.
		if extra, ok := it[""]; ok {
			extraStr := toJoinedString(extra)
			if extraStr != "" {
				if materiality != "" {
					materiality = materiality + "\n" + extraStr
				} else {
					materiality = extraStr
				}
			}
		}

		rawJSON, err := json.Marshal(it)
		if err != nil {
			log.Warnf("Skipping SCF threat %s due to marshal error: %v", objectID, err)
			continue
		}

		up := models.SCFThreat{
			ObjectID:    objectID,
			Grouping:    strings.TrimSpace(grouping),
			Title:       strings.TrimSpace(title),
			Description: strings.TrimSpace(desc),
			Materiality: strings.TrimSpace(materiality),
			Data:        datatypes.JSON(rawJSON),
		}

		var existing models.SCFThreat
		err = db.Where("object_id = ?", objectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&up).Error; err != nil {
				log.Errorf("Failed to insert SCF threat %s: %v", objectID, err)
			} else {
				log.Infof("Inserted SCF threat %s", objectID)
			}
			continue
		}
		if err != nil {
			log.Errorf("Failed to query SCF threat %s: %v", objectID, err)
			continue
		}

		existing.Grouping = up.Grouping
		existing.Title = up.Title
		existing.Description = up.Description
		existing.Materiality = up.Materiality
		existing.Data = up.Data
		if err := db.Save(&existing).Error; err != nil {
			log.Errorf("Failed to update SCF threat %s: %v", objectID, err)
		}
	}
}

