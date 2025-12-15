package models

import (
	"time"

	"gorm.io/gorm"
)

type GithubInstallation struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"`

	InstallationID  int64      `gorm:"uniqueIndex;not null" json:"installation_id"`
	AppSlug         string     `gorm:"not null" json:"app_slug"`
	AccountType     string     `json:"account_type"` // "Organization"|"User"
	AccountID       int64      `json:"account_id"`
	AccountLogin    string     `gorm:"index" json:"account_login"`
	RepoSelection   string     `json:"repo_selection"` // "all"|"selected"
	PermissionsJSON string     `gorm:"type:text" json:"permissions_json"`
	SuspendedAt     *time.Time `json:"suspended_at"`
	LastBaselineAt  *time.Time `json:"last_baseline_at"`
}
