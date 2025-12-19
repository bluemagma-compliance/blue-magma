package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SCFControl stores a single Secure Controls Framework control in a public table.
// It keeps a few searchable columns and the full original record as JSON.
type SCFControl struct {
	gorm.Model

	ObjectID string         `gorm:"not null;uniqueIndex" json:"object_id"` // e.g., "GOV-01"
	Domain   string         `json:"domain"`
	Title    string         `json:"title"`
	Cadence  string         `json:"cadence"`
	Weight   int            `json:"weight"`

	// Coverage flags for common frameworks
	CoversHIPAA     bool `json:"covers_hipaa"`
	CoversSOC2      bool `json:"covers_soc2"`
	CoversGDPR      bool `json:"covers_gdpr"`
	CoversISO27001  bool `json:"covers_iso27001"`
	CoversISO42001  bool `json:"covers_iso42001"`
	CoversNISTCSF   bool `json:"covers_nist_csf"`
	CoversNISTAIRMF bool `json:"covers_nist_ai_rmf"`

	// Core set memberships
	IsCoreLvl0  bool `json:"is_core_lvl0"`
	IsCoreLvl1  bool `json:"is_core_lvl1"`
	IsCoreLvl2  bool `json:"is_core_lvl2"`
	IsCoreAIOps bool `json:"is_core_ai_ops"`

	// Additional indicators
	IsMCR bool `json:"is_mcr"`
	IsDSR bool `json:"is_dsr"`

	// Summaries
	RiskThreatSummary    string `json:"risk_threat_summary"`
	ControlThreatSummary string `json:"control_threat_summary"`

	// Detailed control content
	ControlDescription  string `json:"control_description"`
	MicroSmallSolutions string `json:"micro_small_solutions"`

	// Full original SCF record
	Data datatypes.JSON `json:"data"`
}

