package models

import (
	"gorm.io/gorm"
)

type SubjectType struct {
	gorm.Model
	ObjectID    string `gorm:"not null;uniqueIndex" json:"object_id"`
	Description string `json:"description"`                      // Description of the subject type
	Name        string `gorm:"not null;uniqueIndex" json:"name"` // Name of the subject type
	Category    string `json:"category"`                         // Category of the subject type (e.g., "service", "codebase", "codebase_version")
}
