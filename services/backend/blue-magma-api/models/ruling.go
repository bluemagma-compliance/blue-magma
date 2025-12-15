package models

import (
	"time"

	"gorm.io/gorm"
)

type Ruling struct {
	ID        uint `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	ObjectID       string `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint   `json:"organization_id"` // Foreign key to Organization

	// RuleAssignmentID uint           `json:"rule_assignment_id"` // FK column in Ruling table
	// RuleAssignment   RuleAssignment `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:RuleAssignmentID"`
	// ReportID         string         `json:"report_id"` // FK column in Ruling table
	RuleID uint `json:"rule_id"` // Foreign key to Rule
	Rule   Rule `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:RuleID;" json:"-"`

	CodebaseVersionID uint            `json:"codebase_version_id"` // Foreign key to CodebaseVersion
	CodebaseVersion   CodebaseVersion `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:CodebaseVersionID;" json:"-"`

	ReportSectionID uint          `json:"report_section_id"` // Foreign key to ReportSection
	ReportSection   ReportSection `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ReportSectionID;" json:"-"`

	// Fields
	Decision  string `json:"decision"` // "compliant" | "non-compliant" | "warning"
	Reasoning string `json:"reasoning"`

	Level  string `json:"level"`  // e.g., "critical", "high", "medium", "low"
	Status string `json:"status"` // "pending" | "completed" | "failed"

	ActionableItems []ActionableItem `gorm:"foreignKey:RulingID" json:"actionable_items"`
}
