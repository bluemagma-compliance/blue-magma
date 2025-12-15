package models

import (
	"time"
	"gorm.io/gorm"
)

// ActionableItem represents an actionable item generated from a ruling
// It describes compliance issues found in reports with severity, problem description, and proposed fixes
type ActionableItem struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	ObjectID       string         `gorm:"uniqueIndex;not null" json:"object_id"`
	OrganizationID uint           `gorm:"not null" json:"organization_id"`
	RulingID       uint           `gorm:"not null" json:"ruling_id"`

	// Core identification (Required)
	Title          string         `gorm:"not null" json:"title"`
	Severity       string         `gorm:"not null;default:'medium'" json:"severity"`    // critical, high, medium, low
	Priority       string         `gorm:"not null;default:'medium'" json:"priority"`   // critical, high, medium, low
	ProblemType    string         `gorm:"not null" json:"problem_type"`                // security, compliance, performance, etc.

	// Optional details
	Description    string         `gorm:"type:text" json:"description"`
	ProposedFix    string         `gorm:"type:text" json:"proposed_fix"`
	FilePath       string         `json:"file_path"`
	LineNumber     *int           `json:"line_number"`

	// Tracking
	Status         string         `gorm:"default:'open'" json:"status"`               // open, in_progress, resolved, dismissed
	AssignedTo     string         `json:"assigned_to"`
	DueDate        *time.Time     `json:"due_date"`
	ResolvedAt     *time.Time     `json:"resolved_at"`
	ResolvedBy     string         `json:"resolved_by"`

	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Organization Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	Ruling       Ruling       `gorm:"foreignKey:RulingID" json:"ruling,omitempty"`
}
