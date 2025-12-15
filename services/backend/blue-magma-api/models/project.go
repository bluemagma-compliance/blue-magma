package models

import "gorm.io/gorm"

type Project struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	Name            string  `gorm:"not null" json:"name"`
	Description     string  `json:"description"`
	Status          string  `gorm:"default:'on-hold'" json:"status"`   // 'initializing' | 'active' | 'up-to-date' | 'out-of-date' | 'audit-ready' | 'completed' | 'on-hold'
	ComplianceScore float64 `gorm:"default:0" json:"compliance_score"` // 0-100

	// Relationships (reverse - no constraints here, they're defined on the child model)
	PolicyTemplates []PolicyTemplate `gorm:"foreignKey:ProjectID" json:"policy_templates,omitempty"`
}
