package models

import (
	"gorm.io/gorm"
)

type CodebaseVersionProperty struct {
	gorm.Model
	ObjectID       string `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint   `json:"organization_id"` // Foreign key to Organization

	CodebaseVersionID uint            `json:"codebase_version_id"`                                                                 // Foreign key to CodebaseVersion
	CodebaseVersion   CodebaseVersion `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:CodebaseVersionID;" json:"-"` // Foreign key to CodebaseVersion
	VersionHash       string          `json:"version_hash"`

	PropertyKey   string `json:"property_key"`   // The key of the property
	PropertyValue string `json:"property_value"` // The value of the property
	PropertyType  string `json:"property_type"`
	Reasoning     string `json:"reasoning"` // Reasoning for the property, if applicable
	FilePath      string `json:"file_path"` // Path to the file where the property was found
}
