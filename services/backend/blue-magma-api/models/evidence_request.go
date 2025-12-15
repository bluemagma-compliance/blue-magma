package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// EvidenceRequest represents a request for evidence that needs to be collected
type EvidenceRequest struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	DocumentID uint     `json:"document_id"` // Belongs to a document
	Document   Document `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:DocumentID" json:"-"`

	// Request details
	Title        string `gorm:"not null" json:"title"`
	Description  string `gorm:"type:text" json:"description"` // What evidence is needed
	RequiredType string `json:"required_type"`                // "text", "config", "artifact", "collection", "any"

	// Guidance
	SuggestedSources   datatypes.JSON `json:"suggested_sources"`                    // Array of suggested source types/locations
	AcceptanceCriteria string         `gorm:"type:text" json:"acceptance_criteria"` // What makes this evidence acceptable

	// Assignment
	AssignedTo string     `gorm:"index" json:"assigned_to"`         // user_id
	Priority   string     `gorm:"default:'medium'" json:"priority"` // "low", "medium", "high", "critical"
	DueDate    *time.Time `gorm:"index" json:"due_date"`

	// Status
	Status string `gorm:"index;default:'pending'" json:"status"` // "pending", "in_progress", "fulfilled", "rejected", "cancelled"

	// Fulfillment
	FulfilledAt     *time.Time `json:"fulfilled_at"`
	FulfilledByUser string     `json:"fulfilled_by_user"` // user_id
	RejectionReason string     `gorm:"type:text" json:"rejection_reason"`

	// Metadata
		CreatedBy      string `json:"created_by"`       // user_id
		RelevanceScore int    `gorm:"default:0" json:"relevance_score"` // Integer relevance score (e.g. 0-100)
}
