package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SCFEvidenceRequest stores a single SCF Evidence Request List entry.
// This is reference/catalog data, separate from project-specific EvidenceRequest.
type SCFEvidenceRequest struct {
	gorm.Model

	ObjectID        string         `gorm:"not null;uniqueIndex" json:"object_id"`        // e.g., "E-GOV-01"
	AreaOfFocus     string         `json:"area_of_focus"`                                 // "Area of Focus"
	Artifact        string         `json:"artifact"`                                      // "Documentation Artifact"
	Description     string         `json:"description"`                                   // "Artifact Description"
	ControlMappings string         `json:"control_mappings"`                              // newline-joined SCF control ids
	Data            datatypes.JSON `json:"data"`                                          // full original record
}

