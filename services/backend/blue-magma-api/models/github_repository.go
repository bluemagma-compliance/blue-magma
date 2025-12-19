package models

import (
	"time"

	"gorm.io/gorm"
)

type GithubRepository struct {
	gorm.Model
	ObjectID string `gorm:"not null;unique" json:"object_id"`

	RepoID         int64      `gorm:"uniqueIndex;not null" json:"repo_id"`
	InstallationID int64      `gorm:"index;not null" json:"installation_id"`
	Owner          string     `json:"owner"`
	Name           string     `json:"name"`
	FullName       string     `gorm:"index" json:"full_name"`
	DefaultBranch  string     `json:"default_branch"`
	Private        bool       `json:"private"`
	Visibility     string     `json:"visibility"`
	Archived       bool       `json:"archived"`
	Disabled       bool       `json:"disabled"`
	ETag           string     `json:"etag"`
	LastSyncedAt   *time.Time `json:"last_synced_at"`
}
