package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Collection represents AI-generated synthesis of multiple evidence sources
// Collections are standalone entities that are referenced BY evidence and documents
type Collection struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	// Collection metadata
	Name        string `gorm:"not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`
	Type        string `gorm:"not null" json:"type"` // "process", "table", "diagram"

	// AI generation metadata
	AgentType      string `json:"agent_type"`              // "synthesis_agent", "diagram_generator", etc.
	AgentReasoning string `gorm:"type:text" json:"agent_reasoning"` // Why the agent created this
	AgentPrompt    string `gorm:"type:text" json:"agent_prompt"`    // The prompt used to generate this
	AgentContext   string `gorm:"type:text" json:"agent_context"`   // The specific context under which sources were brought together

	// Content (polymorphic based on type)
	Content datatypes.JSON `json:"content"`

	// Versioning - hash of the content
	ContentHash string `gorm:"index" json:"content_hash"` // SHA-256 hash of content field for change detection

	// Source tracking - NO CHILDREN, just source references
	// Array of source objects (evidence IDs, external sources, etc.)
	Sources datatypes.JSON `json:"sources"`

	// NO RELATIONSHIPS - Collections are referenced BY evidence and documents
}

