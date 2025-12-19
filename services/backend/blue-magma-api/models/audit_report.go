package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// AuditReport represents the results of running an auditor
type AuditReport struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	AuditorID uint     `json:"auditor_id"`
	Auditor   Auditor  `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:AuditorID" json:"-"`

	// Status of the audit execution
	Status string `gorm:"not null" json:"status"` // "passed" | "failed" | "partial" | "error" | "running"

	// Overall score (0-100)
	Score float64 `gorm:"default:0" json:"score"`

	// Results contains detailed findings in JSON format
	// Structure: {
	//   "requirements": [
	//     {
	//       "id": "req-1",
	//       "title": "...",
	//       "status": "passed" | "failed" | "partial",
	//       "score": 95,
	//       "findings": "...",
	//       "evidence_reviewed": ["...", "..."],
	//       "reasoning": "..."
	//     }
	//   ],
	//   "summary": "...",
	//   "recommendations": ["...", "..."]
	// }
	Results datatypes.JSON `json:"results"`

	// Execution metadata
	ExecutedAt time.Time `json:"executed_at"`
	ExecutedBy string    `json:"executed_by"` // "scheduled" | "manual" | user_id
	Duration   int       `json:"duration"`    // Duration in seconds

	// Error information (if status is "error")
	ErrorMessage string `json:"error_message,omitempty"`
}

