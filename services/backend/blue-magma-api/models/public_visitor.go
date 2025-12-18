package models

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// PublicVisitor tracks anonymous public agent usage for a single browser/device.
//
// This is intentionally minimal and only used for the unauthenticated public
// agent. It allows us to enforce simple quotas and keep a tiny rolling window
// of recent messages per visitor.
type PublicVisitor struct {
	gorm.Model

	// VisitorID is a stable, anonymous identifier derived from a first-party
	// cookie set by the agent service (e.g. "public_<uuid>").
	VisitorID string `gorm:"not null;unique" json:"visitor_id"`

	// TotalPublicTokens accumulates estimated LLM tokens used by the public
	// agent for this visitor across all sessions.
	TotalPublicTokens int64 `json:"total_public_tokens" gorm:"default:0"`

	// LastMessages stores a JSON array of up to the last 10 messages exchanged
	// with the public agent. Each element is a small object with {role, content,
	// timestamp}. This is primarily for UX/analytics and light context.
	LastMessages datatypes.JSON `json:"last_messages"`
}
