package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Rule struct {
	gorm.Model
	ObjectID string `gorm:"not null;unique" json:"object_id"`

	Name           string         `json:"name"`
	Rule           string         `json:"rule"`
	PolicyName     string         `json:"policy_name"`
	PolicyVersion  string         `json:"policy_version"`
	EvidenceSchema datatypes.JSON `json:"evidence_schema"`
	Scope          string         `json:"scope"`
	Tags           string         `json:"tags"`
	Public         bool           `json:"Public"` // not really used other than for display reasons
	Source         string         `json:"source"`
	Description    string         `json:"description"`
	Level          string         `json:"level"` // e.g., "critical", "high", "medium", "low"
	Section        string         `json:"section"`

	OrganizationID uint         `json:"organization_id"`                                                                  // public rules are linked to the public org
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID;" json:"-"` // Foreign key to Organization

}
