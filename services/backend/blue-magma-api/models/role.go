package models

import "gorm.io/gorm"

type Role struct {
	gorm.Model
	Name           string `gorm:"not null;unique" json:"name"`
	Description    string `json:"description"`
	HierarchyLevel int    `gorm:"not null" json:"hierarchy_level"` // Higher numbers = Higher privileges
	IsActive       bool   `gorm:"default:true" json:"is_active"`

	// Relationships
	UserRoles []UserRole `gorm:"foreignKey:RoleID" json:"user_roles,omitempty"` // No cascade delete - we don't want to delete users when role is deleted
}
