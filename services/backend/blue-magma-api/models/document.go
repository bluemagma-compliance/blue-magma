package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Document represents an actual documentation page instance created from a template page
type Document struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	// Template relationship (not FK, just reference)
	TemplatePageID string `json:"template_page_id"` // References the page ID from DocumentationTemplate

	// Content
	Title   string `gorm:"not null" json:"title"`
	Content string `gorm:"type:text" json:"content"` // Markdown content

	// SCF metadata for control documents created from SCF configuration. These
	// fields allow us to associate documents directly with SCF controls and the
	// frameworks they cover, without relying on TemplatePageID parsing.
	SCFControlID     *string        `json:"scf_control_id"`
	SCFFrameworkKeys datatypes.JSON `json:"scf_framework_keys"` // JSON array of framework keys (e.g. ["soc2","nist_csf"])

	// Relevance scoring for this documentation page in the organization's
	// context. This is an integer score (e.g. 0-100) that can be used by
	// clients to prioritise work across controls, risks, and other pages.
	RelevanceScore int `gorm:"default:0" json:"relevance_score"`

	// Hierarchy
	ParentID *uint      `json:"parent_id"`                                                                                 // Nullable for root documents
	Parent   *Document  `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;foreignKey:ParentID" json:"parent,omitempty"` // Self-referential
	Children []Document `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Order    int        `gorm:"default:0" json:"order"`

	// Metadata
	Status       string `gorm:"default:'draft'" json:"status"` // "draft", "in_progress", "complete", "needs_review"
	Version      int    `gorm:"default:1" json:"version"`
	LastEditedBy string `json:"last_edited_by"` // user_id

	// Relationships (reverse - no constraints here, they're defined on the child models)
	Evidence         []Evidence        `gorm:"foreignKey:DocumentID" json:"evidence,omitempty"`
	EvidenceRequests []EvidenceRequest `gorm:"foreignKey:DocumentID" json:"evidence_requests,omitempty"`
}
