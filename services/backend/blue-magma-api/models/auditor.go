package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Auditor represents an audit configuration for a project
// It defines what to audit, how often, and the criteria for success/failure
type Auditor struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description"`

	// Schedule as cron expression (e.g., "0 0 * * 0" for weekly)
	// Empty string means manual-only execution
	Schedule string `json:"schedule"`

	// Instructions contains the audit requirements and criteria in JSON format
	// Structure: {
	//   "requirements": [
	//     {
	//       "id": "req-1",
	//       "title": "...",
	//       "description": "...",
	//       "context": "...",
	//       "success_criteria": ["...", "..."],
	//       "failure_criteria": ["...", "..."],
	//       "weight": 30
	//     }
	//   ],
	//   "passing_score": 80,
	//   "evaluation_instructions": "..."
	// }
	Instructions datatypes.JSON `json:"instructions"`

	IsActive   bool       `gorm:"default:true" json:"is_active"`
	LastRunAt  *time.Time `json:"last_run_at"`
	NextRunAt  *time.Time `json:"next_run_at"`
	RunCount   int        `gorm:"default:0" json:"run_count"`
	LastStatus string     `json:"last_status"` // "passed" | "failed" | "partial" | "error" | ""

	// Relationships
	AuditReports []AuditReport `gorm:"foreignKey:AuditorID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"audit_reports,omitempty"`
}

