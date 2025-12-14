package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// SCFFrameworkMap represents a mapping between an external framework control
// and an SCF control. Each row is a single relationship (external control -> one SCF control).
// The raw source JSON is stored internally but excluded from API JSON responses.
type SCFFrameworkMap struct {
	gorm.Model

	Framework            string         `json:"framework" gorm:"index:idx_framework_ext_scf,priority:1"`
	ExternalID           string         `json:"external_id" gorm:"index:idx_framework_ext_scf,priority:2"`
	ExternalName         string         `json:"external_name"`
	ExternalDescription  string         `json:"external_description"`
	STRMRelationship     string         `json:"strm_relationship"`
	STRMRationale        string         `json:"strm_rationale"`
	Strength             int            `json:"strength"`
	Notes                string         `json:"notes"`

	SCFObjectID          string         `json:"scf_object_id" gorm:"index:idx_framework_ext_scf,priority:3"`
	SCFControlTitle      string         `json:"scf_control_title"`

	Data                 datatypes.JSON `json:"-"`
}

