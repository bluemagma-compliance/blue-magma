package defaultdata

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/bluemagma-compliance/blue-magma-api/models"
)

// truthy returns whether a value from the SCF JSON should be considered present/non-empty.
func truthy(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		s := strings.TrimSpace(strings.ToLower(t))
		if s == "" || s == "false" || s == "no" || s == "n/a" || s == "0" {
			return false
		}
		return true
	case float64:
		return t != 0
	case int:
		return t != 0
	case []any:
		return len(t) > 0
	case map[string]any:
		return len(t) > 0
	default:
		return v != nil
	}
}

// toJoinedString converts a value to a display string. If it's a list, join string items with newlines.
func toJoinedString(v any) string {
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	case []any:
		parts := make([]string, 0, len(t))
		for _, el := range t {
			if s, ok := el.(string); ok {
				s = strings.TrimSpace(s)
				if s != "" {
					parts = append(parts, s)
				}
			}
		}
		return strings.Join(parts, "\n")
	default:
		return ""
	}
}


// SeedSCFControls imports SCF controls from default-data/scf_controls.json if present.
// The file should contain a JSON array where each element is a full SCF record.
func SeedSCFControls(db *gorm.DB) {
	path := "./default-data/scf_controls.json"
	f, err := os.Open(path)
	if err != nil {
		log.Infof("No SCF controls file found (%s): %v — skipping seeding", path, err)
		return
	}
	defer f.Close()

	var items []map[string]any
	if err := json.NewDecoder(f).Decode(&items); err != nil {
		log.Errorf("Failed to decode SCF controls JSON: %v", err)
		return
	}

	for _, it := range items {
		// Extract identifier from "SCF #" (first value)
		objectID := ""
		if raw, ok := it["SCF #"]; ok {
			if arr, ok := raw.([]any); ok && len(arr) > 0 {
				if s, ok := arr[0].(string); ok {
					objectID = strings.TrimSpace(s)
				}
			}
		}
		if objectID == "" {
			log.Warnf("Skipping SCF record without SCF # (id)")
			continue
		}

		// Extract basic fields
		domain, _ := it["SCF Domain"].(string)
		title, _ := it["SCF Control"].(string)
		cadence, _ := it["Conformity Validation Cadence"].(string)
		weight := 0
		if wRaw, ok := it["Relative Control Weighting"]; ok {
			switch w := wRaw.(type) {
			case float64:
				weight = int(w)
			case int:
				weight = w
			case string:
				// best-effort parse
				if v, err := strconv.Atoi(strings.TrimSpace(w)); err == nil {
					weight = v
				}
			}
		}

		// Derive coverage/core booleans from known fields
		coversSOC2 := truthy(it["AICPA TSC 2017:2022 (used for SOC 2)"])
		coversHIPAA := truthy(it["US HIPAA Administrative Simplification (2013)"]) || truthy(it["US HIPAA Security Rule / NIST SP 800-66 R2"])
		coversGDPR := truthy(it["EMEA EU GDPR"]) || truthy(it["EU GDPR"]) // fallback alias
		coversISO27001 := truthy(it["ISO 27001 v2013"]) || truthy(it["ISO 27001 v2022"]) || truthy(it["ISO/IEC 27001:2013"]) || truthy(it["ISO/IEC 27001:2022"])

		// ISO 42001 may appear with slightly different key names; detect generically
		coversISO42001 := false
		for k, v := range it {
			upper := strings.ToUpper(k)
			if strings.Contains(upper, "ISO 42001") && truthy(v) {
				coversISO42001 = true
				break
			}
		}

		// NIST CSF detection (explicit v2.0 + generic CSF substring)
		coversNISTCSF := truthy(it["NIST CSF v2.0"])
		if !coversNISTCSF {
			for k, v := range it {
				upper := strings.ToUpper(k)
				if strings.Contains(upper, "NIST CSF") && truthy(v) {
					coversNISTCSF = true
					break
				}
			}
		}

		// NIST AI RMF detection
		coversNISTAIRMF := truthy(it["NIST AI RMF AI 100-1 v1.0"]) || truthy(it["NIST AI RMF v1.0"]) || truthy(it["NIST AI RMF"])

		// SCF CORE levels
		isCoreLvl1 := truthy(it["SCF CORE ESP Level 1 Foundational"]) || truthy(it["SCF CORE Level 1 Foundational"])
		isCoreLvl2 := truthy(it["SCF CORE ESP Level 2 Critical Infrastructure"]) || truthy(it["SCF CORE Level 2 Critical Infrastructure"])
		isCoreAIOps := truthy(it["SCF CORE AI-Enabled Operations"]) || truthy(it["SCF CORE AI Enabled Operations"])
		// SCF CORE Fundamentals (Level 0)
		isCoreLvl0 := truthy(it["SCF CORE Fundamentals"]) || truthy(it["SCF CORE ESP Fundamentals"]) || truthy(it["SCF CORE Level 0 Fundamentals"])

		// MCR/DSR indicators (best-effort until exact keys are confirmed)
		isMCR := false
		isDSR := false
		for k, v := range it {
			upper := strings.ToUpper(k)
			if (strings.Contains(upper, "MCR") || strings.Contains(upper, "MINIMUM CONTROL REQUIRE")) && truthy(v) {
				isMCR = true
			}
			if (strings.Contains(upper, "DSR") || strings.Contains(upper, "DATA SECURITY REQUIRE")) && truthy(v) {
				isDSR = true
			}
		}

		// Summaries
		riskThreatSummary := toJoinedString(it["Risk Threat Summary"])
		controlThreatSummary := toJoinedString(it["Control Threat Summary"])

		// Detailed control info
		controlDescription, _ := it["Secure Controls Framework (SCF) Control Description"].(string)
		microSmallSolutions := toJoinedString(it["Possible Solutions & Considerations Micro-Small Business (<10 staff) BLS Firm Size Classes 1-2"])

		// Marshal full item as JSON for storage
		raw, err := json.Marshal(it)
		if err != nil {
			log.Warnf("Skipping SCF %s due to marshal error: %v", objectID, err)
			continue
		}

		up := models.SCFControl{
			ObjectID:           objectID,
			Domain:             domain,
			Title:              title,
			Cadence:            cadence,
			Weight:             weight,
			CoversHIPAA:        coversHIPAA,
			CoversSOC2:         coversSOC2,
			CoversGDPR:         coversGDPR,
			CoversISO27001:     coversISO27001,
			CoversISO42001:     coversISO42001,
			CoversNISTCSF:      coversNISTCSF,
			IsCoreLvl0:         isCoreLvl0,
			CoversNISTAIRMF:    coversNISTAIRMF,
			RiskThreatSummary:  riskThreatSummary,
			ControlThreatSummary: controlThreatSummary,
			ControlDescription:  strings.TrimSpace(controlDescription),
			MicroSmallSolutions: microSmallSolutions,
			IsCoreLvl1:         isCoreLvl1,
			IsCoreLvl2:         isCoreLvl2,
			IsCoreAIOps:        isCoreAIOps,
			IsMCR:              isMCR,
			IsDSR:              isDSR,
			Data:               datatypes.JSON(raw),
		}

		var existing models.SCFControl
		err = db.Where("object_id = ?", objectID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&up).Error; err != nil {
				log.Errorf("Failed to insert SCF %s: %v", objectID, err)
			} else {
				log.Infof("Inserted SCF %s", objectID)
			}
			continue
		}
		if err != nil {
			log.Errorf("Failed to query SCF %s: %v", objectID, err)
			continue
		}

		// Update existing
		existing.Domain = up.Domain
		existing.Title = up.Title
		existing.Cadence = up.Cadence
		existing.Weight = up.Weight
		existing.CoversHIPAA = up.CoversHIPAA
		existing.CoversSOC2 = up.CoversSOC2
		existing.CoversGDPR = up.CoversGDPR
		existing.IsCoreLvl0 = up.IsCoreLvl0
		existing.CoversISO27001 = up.CoversISO27001
		existing.CoversISO42001 = up.CoversISO42001
		existing.CoversNISTCSF = up.CoversNISTCSF
		existing.CoversNISTAIRMF = up.CoversNISTAIRMF
		existing.IsCoreLvl1 = up.IsCoreLvl1
		existing.IsCoreLvl2 = up.IsCoreLvl2
		existing.IsCoreAIOps = up.IsCoreAIOps
		existing.IsMCR = up.IsMCR
		existing.IsDSR = up.IsDSR
		existing.RiskThreatSummary = up.RiskThreatSummary
		existing.ControlThreatSummary = up.ControlThreatSummary
		existing.ControlDescription = up.ControlDescription
		existing.MicroSmallSolutions = up.MicroSmallSolutions
		existing.Data = up.Data
		if err := db.Save(&existing).Error; err != nil {
			log.Errorf("Failed to update SCF %s: %v", objectID, err)
		} else {
			log.Infof("Updated SCF %s", objectID)
		}
	}
}

