package models

import "gorm.io/gorm"

type Question struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`                                                                 // Foreign key to Organization
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"` // Foreign key to Organization

	DateCreated string `json:"date_created"` // Date the question was created
	Question    string `json:"question"`     // The question text
	Answer      string `json:"answer"`       // The answer text

	RulingID uint   `json:"ruling_id"`                                                                 // Foreign key to Ruling
	Ruling   Ruling `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:RulingID" json:"-"` // Foreign key to Ruling
}
