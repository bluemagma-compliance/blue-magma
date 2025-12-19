package models

import (
	"gorm.io/gorm"
)

// these are the properties that are found during the scanning process, they are based off a property but are not used for subsequent searches
type FoundProperty struct {
	gorm.Model
	ObjectID       string `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint   `json:"organization_id"` // Foreign key to Organization

	QuestionID uint     `json:"question_id"`                                                                  // Foreign key to Question
	Question   Question `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:QuestionID;" json:"-"` // Foreign key to Question

	Value        string `json:"value"`         // The value of the found property
	Key          string `json:"key"`           // The key of the found property
	PropertyType string `json:"property_type"` // Type of the property (e.g.,

	IsIssue       bool   `json:"is_issue"`       // Indicates if the found property is an issue
	IssueSeverity string `json:"issue_severity"` // Severity of the issue (e.g., "critical", "high", "medium", "low")
}
