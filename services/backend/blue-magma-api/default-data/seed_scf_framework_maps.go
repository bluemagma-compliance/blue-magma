package defaultdata

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/bluemagma-compliance/blue-magma-api/models"
)

// SeedSCFFrameworkMaps imports mapping rows from JSON files under default-data/scf_maps/.
// Each file should contain a JSON array of objects like the provided example.
func SeedSCFFrameworkMaps(db *gorm.DB) {
	dir := "./default-data/scf_maps"
	if _, err := os.Stat(dir); err != nil {
		log.Infof("No SCF framework maps dir found (%s): %v — skipping seeding", dir, err)
		return
	}

	fileEntries := []string{}
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil { return nil }
		if d.IsDir() { return nil }
		if strings.HasSuffix(strings.ToLower(d.Name()), ".json") {
			fileEntries = append(fileEntries, path)
		}
		return nil
	})

	for _, path := range fileEntries {
		framework := frameworkFromFilename(filepath.Base(path))
		f, err := os.Open(path)
		if err != nil {
			log.Errorf("Failed to open %s: %v", path, err)
			continue
		}
		var items []map[string]any
		if err := json.NewDecoder(f).Decode(&items); err != nil {
			log.Errorf("Failed to decode %s: %v", path, err)
			_ = f.Close()
			continue
		}
		_ = f.Close()

		for _, it := range items {
			externalID, _ := it["DE #"].(string)
			externalName, _ := it["FDE Name"].(string)
			externalDesc, _ := it["Focal Document Element (FDE) Description"].(string)
			strmRel := toJoinedString(it["STRM Relationship"]) // may be multi-line
			strmRat, _ := it["STRM Rationale"].(string)
			scfTitle, _ := it["SCF Control"].(string)
			scfIDs := parseSCFIDs(it["SCF #"]) // may be string or list
			strength := parseInt(it["Strength of Relationship (optional)"])
			notes, _ := it["Notes (optional)"].(string)

			raw, err := json.Marshal(it)
			if err != nil { continue }

			for _, scfID := range scfIDs {
				up := models.SCFFrameworkMap{
					Framework:           framework,
					ExternalID:          strings.TrimSpace(externalID),
					ExternalName:        strings.TrimSpace(externalName),
					ExternalDescription: strings.TrimSpace(externalDesc),
					STRMRelationship:    strings.TrimSpace(strmRel),
					STRMRationale:       strings.TrimSpace(strmRat),
					Strength:            strength,
					Notes:               strings.TrimSpace(notes),
					SCFObjectID:         strings.TrimSpace(scfID),
					SCFControlTitle:     strings.TrimSpace(scfTitle),
					Data:                datatypes.JSON(raw),
				}

				var existing models.SCFFrameworkMap
				err = db.Where("framework = ? AND external_id = ? AND scf_object_id = ?", up.Framework, up.ExternalID, up.SCFObjectID).First(&existing).Error
				if err == gorm.ErrRecordNotFound {
					if err := db.Create(&up).Error; err != nil {
						log.Errorf("Failed to insert map %s/%s->%s: %v", up.Framework, up.ExternalID, up.SCFObjectID, err)
					}
					continue
				}
				if err != nil { continue }

				existing.ExternalName = up.ExternalName
				existing.ExternalDescription = up.ExternalDescription
				existing.STRMRelationship = up.STRMRelationship
				existing.STRMRationale = up.STRMRationale
				existing.Strength = up.Strength
				existing.Notes = up.Notes
				existing.SCFControlTitle = up.SCFControlTitle
				existing.Data = up.Data
				if err := db.Save(&existing).Error; err != nil {
					log.Errorf("Failed to update map %s/%s->%s: %v", up.Framework, up.ExternalID, up.SCFObjectID, err)
				}
			}
		}
	}
}

func frameworkFromFilename(name string) string {
	base := strings.TrimSuffix(strings.ToLower(name), filepath.Ext(name))

	// Match actual filenames from scf_maps directory
	if strings.Contains(base, "nist-csf") || strings.Contains(base, "nist_csf") {
		return "NIST CSF"
	}
	if strings.Contains(base, "nist-ai") || strings.Contains(base, "nist_ai") {
		return "NIST AI RMF"
	}
	if strings.Contains(base, "iso-27001") || strings.Contains(base, "iso_27001") || strings.Contains(base, "iso27001") {
		return "ISO27001"
	}
	if strings.Contains(base, "iso-42001") || strings.Contains(base, "iso_42001") || strings.Contains(base, "iso42001") {
		return "ISO42001"
	}
	if strings.Contains(base, "gdpr") || strings.Contains(base, "eu-gdpr") {
		return "GDPR"
	}
	if strings.Contains(base, "aicpa") || strings.Contains(base, "tsc") || strings.Contains(base, "soc") {
		return "SOC2"
	}
	if strings.Contains(base, "hipaa") || strings.Contains(base, "hitech") {
		return "HIPAA"
	}

	return strings.ToUpper(base)
}

func parseSCFIDs(v any) []string {
	switch t := v.(type) {
	case string:
		if s := strings.TrimSpace(t); s != "" { return []string{s} }
	case []any:
		ids := []string{}
		for _, el := range t {
			if s, ok := el.(string); ok {
				s = strings.TrimSpace(s)
				if s != "" { ids = append(ids, s) }
			}
		}
		return ids
	}
	return nil
}

func parseInt(v any) int {
	switch t := v.(type) {
	case int:
		return t
	case float64:
		return int(t)
	case string:
		if s := strings.TrimSpace(t); s != "" {
			if n, err := strconv.Atoi(s); err == nil { return n }
		}
	}
	return 0
}

