package models

import (
	"time"

	"gorm.io/gorm"
)

type GithubWebhookDelivery struct {
	gorm.Model
	ObjectID string `gorm:"not null;unique" json:"object_id"`

	DeliveryGUID   string     `gorm:"uniqueIndex;not null" json:"delivery_guid"`
	Event          string     `json:"event"`
	Action         string     `json:"action"`
	InstallationID *int64     `json:"installation_id"`
	RepositoryID   *int64     `json:"repository_id"`
	ProcessedAt    *time.Time `json:"processed_at"`
	Status         string     `json:"status"` // "pending"|"processed"|"error"
	PayloadJSON    string     `gorm:"type:text" json:"payload_json"`
}
