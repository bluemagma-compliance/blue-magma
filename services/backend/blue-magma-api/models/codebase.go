package models

import (
	"fmt"

	"gorm.io/gorm"
)

// Codebase is the actual instance of a service
type Codebase struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`                                                                  // Foreign key to Organization
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID;" json:"-"` // Foreign key to Organization

	// Service information
	ServiceName        string `json:"service_name"`
	ServiceRepoURL     string `json:"service_repo_url"`
	ServiceDescription string `json:"service_description"`

	//API KEY
	APIKeyID uint   `json:"api_key_id"` // Foreign key to APIKey
	APIKey   APIKey `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;foreignKey:APIKeyID" json:"-"`

	SubjectTypeID uint        `json:"subject_type_id"`                                                                // Foreign key to SubjectType
	SubjectType   SubjectType `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:SubjectTypeID" json:"-"` // Foreign key to Subject

	// GitHub integration fields
	SourceType           string `json:"source_type" gorm:"default:'manual'"` // "manual"|"github"
}

// Before delete hook to delete all associated CodebaseVersions
func (c *Codebase) BeforeDelete(tx *gorm.DB) (err error) {
	// Get all associated CodebaseVersions
	var versions []CodebaseVersion
	if err := tx.Where("codebase_id = ?", c.ID).Find(&versions).Error; err != nil {
		return fmt.Errorf("failed to find associated CodebaseVersions: %w", err)
	}
	// Delete each CodebaseVersion
	for _, version := range versions {
		if err := tx.Unscoped().Delete(&version).Error; err != nil {
			return fmt.Errorf("failed to delete CodebaseVersion ID %d: %w", version.ID, err)
		}
	}
	return nil
}
