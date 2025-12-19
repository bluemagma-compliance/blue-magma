package models

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Evidence represents a piece of evidence collected for compliance documentation
type Evidence struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint    `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	DocumentID uint     `json:"document_id"` // Belongs to ONE document
	Document   Document `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:DocumentID" json:"-"`

	// Evidence metadata
	Name        string `gorm:"not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`
	Type        string `gorm:"not null" json:"type"` // "temporary", "static", "dynamic"

	// Source information
	SourceID     string `json:"source_id"`                      // ID of the source system/document/user
	SourceType   string `json:"source_type"`                    // "confluence_page", "github_repo", "user_upload", "api_response", etc.
	SourceMethod string `gorm:"type:text" json:"source_method"` // "query: SELECT * FROM users", "API: GET /users", "Interview with John Doe"
	SourceQuery  string `gorm:"type:text" json:"source_query"`  // The actual query/method used

	// Temporal data
	DateCollected time.Time  `json:"date_collected"`
	DateExpires   *time.Time `json:"date_expires"` // Nullable

	// Content
	Context   string         `gorm:"type:text" json:"context"`   // Why this evidence matters, what it proves
	ValueType string         `gorm:"not null" json:"value_type"` // "text", "config", "artifact", "collection"
	Value     datatypes.JSON `json:"value"`                      // Polymorphic storage based on value_type

	// Versioning - hash of the value content
	ContentHash string `gorm:"index" json:"content_hash"` // SHA-256 hash of value field for change detection

	// Organization
	Group string         `gorm:"index" json:"group"` // "access_controls", "mfa_evidence", etc.
	Tags  datatypes.JSON `json:"tags"`               // Array of tags

	// Validation
	IsVerified bool       `gorm:"default:false" json:"is_verified"`
	VerifiedBy string     `json:"verified_by"` // user_id
	VerifiedAt *time.Time `json:"verified_at"`

	// Relationships
	CollectionID *uint       `gorm:"index" json:"collection_id"` // References a Collection when value_type = "collection"
	Collection   *Collection `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;foreignKey:CollectionID" json:"collection,omitempty"`

	EvidenceRequestID *uint            `gorm:"index" json:"evidence_request_id"` // If created from a request
	EvidenceRequest   *EvidenceRequest `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;foreignKey:EvidenceRequestID" json:"evidence_request,omitempty"`
}
