package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SCFRisk stores a single Secure Controls Framework risk catalog entry.
// It keeps a few searchable columns and the full original record as JSON.
type SCFRisk struct {
	gorm.Model

	ObjectID     string         `gorm:"not null;uniqueIndex" json:"object_id"` // e.g., "R-AC-1"
	Grouping     string         `json:"grouping"`                               // "Risk Grouping"
	Title        string         `json:"title"`                                  // short risk note
	Description  string         `json:"description"`                            // description of possible risk
	NISTFunction string         `json:"nist_function"`                          // e.g., "Protect", "Identify"
	Materiality  string         `json:"materiality"`                            // financial impact considerations
	Data         datatypes.JSON `json:"data"`                                   // full original record
}

