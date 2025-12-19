package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SCFAssessmentObjective stores a single SCF Assessment Objective (AO) entry.
// It keeps a few searchable columns and the full original record as JSON.
type SCFAssessmentObjective struct {
	gorm.Model

	ObjectID        string         `gorm:"not null;uniqueIndex" json:"object_id"` // e.g., "AAT-01_A01"
	ControlMappings string         `json:"control_mappings"`                       // newline-joined SCF control ids
	Statement       string         `json:"statement"`                              // AO statement text
	Origin          string         `json:"origin"`                                 // AO origin(s)
	IsSCFBaseline   bool           `json:"is_scf_baseline"`                        // from "SCF Baseline AOs"

	// Full original SCF record
	Data datatypes.JSON `json:"data"`
}

