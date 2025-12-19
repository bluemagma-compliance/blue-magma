package models

import "gorm.io/gorm"

// DocumentRelation represents a typed relationship between two documents
// within the same organization and project (for example, control ↔ risk or
// control ↔ threat).
type DocumentRelation struct {
	gorm.Model

	OrganizationID uint       `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	ProjectID uint   `json:"project_id"`
	Project   Project `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:ProjectID" json:"-"`

	// Document is the "source" in the relation (e.g., the risk document in a
	// risk_to_control relation).
	DocumentID uint     `json:"document_id"`
	Document   Document `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:DocumentID" json:"-"`

	// RelatedDocument is the "target" in the relation (e.g., the control
	// document in a risk_to_control relation).
	RelatedDocumentID uint     `json:"related_document_id"`
	RelatedDocument   Document `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:RelatedDocumentID" json:"-"`

	// RelationType encodes the semantics and direction, e.g.:
	// - "risk_to_control" / "control_to_risk"
	// - "threat_to_control" / "control_to_threat".
	RelationType string `json:"relation_type"`
}
