package models

import (
	"gorm.io/gorm"
)

type PolicyTemplate struct {
	gorm.Model
	ObjectID string `gorm:"not null;unique" json:"object_id"`

	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	Title       string `gorm:"not null" json:"title"`
	Description string `json:"description"`
	Content     string `gorm:"type:text" json:"content"` // Markdown content
	Category    string `json:"category"`                 // e.g., "Security", "Privacy", "Compliance", "Operations"
}

