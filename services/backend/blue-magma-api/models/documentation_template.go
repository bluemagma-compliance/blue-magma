package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type DocumentationTemplate struct {
	gorm.Model

	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	// Template stores the hierarchical documentation template as JSON
	// Example: {"pages": [ {"id":"...","title":"...","content":"...","children":[...] } ] }
	Template datatypes.JSON `json:"template"`
}

