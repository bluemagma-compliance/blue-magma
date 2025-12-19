package models

import (
	"gorm.io/gorm"
)

type ReportSection struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`                                                 // Unique
	OrganizationID uint         `json:"organization_id"`                                                                  // Foreign key to Organization
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID;" json:"-"` // Foreign key to Organization

	ReportID uint   `json:"report_id"`                                                                  // Foreign key to Report
	Report   Report `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ReportID;" json:"-"` // Foreign key to Report

	Name        string `json:"name"`        // Name of the section
	Description string `json:"description"` // Description of the section
}
