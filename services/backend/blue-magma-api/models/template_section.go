package models

import (
	"gorm.io/gorm"
)

type TemplateSection struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`                                                                 // Foreign key to Organization
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"` // Foreign key to Organization

	Name        string `gorm:"not null" json:"name"`        // Name of the section
	Description string `gorm:"not null" json:"description"` // Description of the section

	Rules []Rule `gorm:"many2many:template_section_rules;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"rules"` // Many-to-many relationship with Rule

	TemplateID uint           `json:"template_id"`                                                   // Foreign key to ReportTemplate
	Template   ReportTemplate `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"template"` // Foreign key to ReportTemplate
}
