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

// firstJoinedField returns the first field whose key contains substr, converted using toJoinedString.
func firstJoinedField(m map[string]any, substr string) string {
	for k, v := range m {
		if strings.Contains(k, substr) {
			return toJoinedString(v)
		}
	}
	return ""
}

// SeedSCFRisks imports SCF risk catalog entries from the JSON export if present.
func SeedSCFRisks(db *gorm.DB) {
	path := "./default-data/other_scf_data/secure-controls-framework-scf-2025-3-1.xlsx - Risk Catalog.json"
	f, err := os.Open(path)
	if err != nil {
		log.Infof("No SCF risk catalog file found (%s): %v — skipping seeding", path, err)
		return
	}
	defer f.Close()

	var items []map[string]any
	if err := json.NewDecoder(f).Decode(&items); err != nil {
		log.Errorf("Failed to decode SCF risk catalog JSON: %v", err)
		return
	}

	for _, it := range items {
		// Extract identifier from "Risk #" (first value)
		objectID := ""
		if raw, ok := it["Risk #"]; ok {
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

		grouping, _ := it["Risk Grouping"].(string)
		title := firstJoinedField(it, "Risk* Note")
		desc := firstJoinedField(it, "Description of Possible Risk")
		nistFn := firstJoinedField(it, "NIST CSF")
		materiality := firstJoinedField(it, "Materiality Considerations")

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
			log.Warnf("Skipping SCF risk %s due to marshal error: %v", objectID, err)
			continue
		}

		up := models.SCFRisk{
			ObjectID:     objectID,
			Grouping:     strings.TrimSpace(grouping),
			Title:        strings.TrimSpace(title),
			Description:  strings.TrimSpace(desc),
			NISTFunction: strings.TrimSpace(nistFn),
			Materiality:  strings.TrimSpace(materiality),
			Data:         datatypes.JSON(rawJSON),
		}

		var existing models.SCFRisk
		err = db.Where("object_id = ?", objectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&up).Error; err != nil {
				log.Errorf("Failed to insert SCF risk %s: %v", objectID, err)
			} else {
				log.Infof("Inserted SCF risk %s", objectID)
			}
			continue
		}
		if err != nil {
			log.Errorf("Failed to query SCF risk %s: %v", objectID, err)
			continue
		}

		existing.Grouping = up.Grouping
		existing.Title = up.Title
		existing.Description = up.Description
		existing.NISTFunction = up.NISTFunction
		existing.Materiality = up.Materiality
		existing.Data = up.Data
		if err := db.Save(&existing).Error; err != nil {
			log.Errorf("Failed to update SCF risk %s: %v", objectID, err)
		}
	}
}

