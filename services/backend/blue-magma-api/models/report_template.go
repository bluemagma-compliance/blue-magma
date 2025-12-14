package models

import "gorm.io/gorm"

type ReportTemplate struct {
	gorm.Model

	ObjectID       string `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint   `json:"organization_id"`

	Name        string `gorm:"not null" json:"name"`
	Description string `gorm:"not null" json:"description"`
	Active      bool   `gorm:"default:false" json:"active"` // Indicates if the template is active or not

	Codebases []Codebase `gorm:"many2many:report_template_codebases;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"codebases"`
}
