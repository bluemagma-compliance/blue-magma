package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type ProjectTemplate struct {
	gorm.Model
	ObjectID string `gorm:"not null;unique" json:"object_id"`

	OrganizationID uint         `json:"organization_id"` // Always 1 for public templates
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	Title       string `gorm:"not null" json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"` // e.g., "HIPAA", "SOX", "PCI-DSS", "General"

	// Complete template data as JSON blob
	// Structure: { documentation_template: {...}, policy_templates: [...] }
	TemplateData datatypes.JSON `json:"template_data"`

	IsActive bool `gorm:"default:true" json:"is_active"`
}

