package models

import (
	"time"

	"gorm.io/gorm"
)

type APIKey struct {
	gorm.Model
	ObjectID       string       `json:"object_id" gorm:"not null;uniqueIndex"`                                           // UUID
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"` // Foreign key to Organization
	OrganizationID uint         `json:"organization_id"`                                                                 // Foreign key to Organization                               // UUID
	CreatedAt      time.Time    `json:"created_at" gorm:"autoCreateTime"`                                                // Timestamp
	Name           string       `json:"name" gorm:"type:varchar(255)"`                                                   // Name of the API key
	Key            string       `json:"key" gorm:"type:varchar(255);unique"`                                             // API key
	Enabled        bool         `json:"enabled" gorm:"default:true"`                                                     // Whether the API key is enabled
}
