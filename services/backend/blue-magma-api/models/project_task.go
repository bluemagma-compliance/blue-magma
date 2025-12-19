package models

import (
	"time"

	"gorm.io/gorm"
)

// ProjectTask represents a generic work item scoped to a project within an organization.
// Tasks can optionally be linked to a specific document and/or evidence request but are
// always associated with a project and organization.
type ProjectTask struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	// Optional associations
	DocumentID        *uint            `gorm:"index" json:"document_id"`
	Document          *Document        `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;foreignKey:DocumentID" json:"-"`
	EvidenceRequestID *uint            `gorm:"index" json:"evidence_request_id"`
	EvidenceRequest   *EvidenceRequest `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;foreignKey:EvidenceRequestID" json:"-"`

	DependsOnTaskID *uint        `gorm:"index" json:"-"`
	DependsOnTask   *ProjectTask `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;foreignKey:DependsOnTaskID" json:"-"`

	Title       string     `gorm:"not null" json:"title"`
	Description string     `gorm:"type:text" json:"description"`
	Notes       string     `gorm:"type:text" json:"notes"`
	Status      string     `gorm:"index;default:'todo'" json:"status"`     // "todo", "in_progress", "completed", "stuck"
	Priority    string     `gorm:"index;default:'medium'" json:"priority"` // "low", "medium", "high", "critical"
	DueDate     *time.Time `gorm:"index" json:"due_date"`
}
