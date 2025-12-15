package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SCFThreat stores a single Secure Controls Framework threat in a public table.
// It keeps a few searchable columns and the full original record as JSON.
type SCFThreat struct {
	gorm.Model

	ObjectID    string         `gorm:"not null;uniqueIndex" json:"object_id"` // e.g., "NT-1"
	Grouping    string         `json:"grouping"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Materiality string         `json:"materiality"`

	// Full original SCF record
	Data datatypes.JSON `json:"data"`
}

