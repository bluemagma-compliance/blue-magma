package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Agent represents an AI agent configuration for a project
// It defines what data sources to use, instructions, output format, and scheduling
type Agent struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	Name        string `gorm:"not null" json:"name"`
	Description string `json:"description"`

	// DataSources contains a list of data source identifiers as JSON array
	// Structure: ["github-repo-1", "confluence-space-2", "codebase-uuid-3"]
	DataSources datatypes.JSON `json:"data_sources"`

	// Instructions contains the text instructions for the agent
	Instructions string `gorm:"type:text" json:"instructions"`

	// OutputFormat describes the desired output format
	OutputFormat string `gorm:"type:text" json:"output_format"`

	// Schedule as cron expression (e.g., "0 0 * * 0" for weekly)
	// Empty string means manual-only execution
	Schedule string `json:"schedule"`

	IsActive   bool       `gorm:"default:true" json:"is_active"`
	LastRunAt  *time.Time `json:"last_run_at"`
	NextRunAt  *time.Time `json:"next_run_at"`
	RunCount   int        `gorm:"default:0" json:"run_count"`
	LastStatus string     `json:"last_status"` // "success" | "failed" | "running" | ""
}

