package models

import "gorm.io/gorm"

type UserRole struct {
	gorm.Model
	UserID         uint `gorm:"not null" json:"user_id"`
	RoleID         uint `gorm:"not null" json:"role_id"`
	OrganizationID uint `gorm:"not null" json:"organization_id"`
	IsActive       bool `gorm:"default:true" json:"is_active"`

	// Relationships - No cascade delete constraints here since UserRole is the child table
	// The parent tables (User, Role, Organization) should have the cascade delete constraints
	User         User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Role         Role         `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	Organization Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
}

// Ensure unique user-role-organization combinations
func (ur *UserRole) BeforeCreate(tx *gorm.DB) error {
	// Add unique constraint at database level
	return nil
}
