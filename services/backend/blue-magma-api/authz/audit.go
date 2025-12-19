package authz

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
	log "github.com/sirupsen/logrus"
)

// AuditEvent represents a security-relevant event
type AuditEvent struct {
	gorm.Model
	EventType      string    `gorm:"not null" json:"event_type"`           // e.g., "role_change", "role_check", "user_modification"
	ActorType      string    `gorm:"not null" json:"actor_type"`           // "user" or "service"
	ActorID        string    `gorm:"not null" json:"actor_id"`             // User ID or Service ID
	TargetType     string    `json:"target_type"`                          // "user", "role", etc.
	TargetID       string    `json:"target_id"`                            // Target resource ID
	OrganizationID uint      `gorm:"not null" json:"organization_id"`      // Organization context
	Action         string    `gorm:"not null" json:"action"`               // Specific action taken
	Result         string    `gorm:"not null" json:"result"`               // "success", "denied", "error"
	Details        string    `gorm:"type:text" json:"details"`             // JSON details
	IPAddress      string    `json:"ip_address"`                           // Source IP
	UserAgent      string    `json:"user_agent"`                           // User agent
	Timestamp      time.Time `gorm:"autoCreateTime" json:"timestamp"`      // Event timestamp
}

// AuditLogger handles security audit logging
type AuditLogger struct {
	db *gorm.DB
}

// NewAuditLogger creates a new audit logger
func NewAuditLogger(db *gorm.DB) *AuditLogger {
	return &AuditLogger{db: db}
}

// LogRoleCheck logs role authorization check events
func (a *AuditLogger) LogRoleCheck(actorType, actorID string, organizationID uint, requiredRole, userRole string, result bool, endpoint string) {
	resultStr := "denied"
	if result {
		resultStr = "granted"
	}

	details := map[string]interface{}{
		"required_role": requiredRole,
		"user_role":     userRole,
		"endpoint":      endpoint,
	}
	detailsJSON, _ := json.Marshal(details)

	event := AuditEvent{
		EventType:      "role_check",
		ActorType:      actorType,
		ActorID:        actorID,
		OrganizationID: organizationID,
		Action:         "role_authorization",
		Result:         resultStr,
		Details:        string(detailsJSON),
		Timestamp:      time.Now(),
	}

	if err := a.db.Create(&event).Error; err != nil {
		log.Errorf("Failed to log role check audit event: %v", err)
	}
}

// LogRoleChange logs role modification events
func (a *AuditLogger) LogRoleChange(actorType, actorID string, organizationID uint, targetUserID string, oldRole, newRole string, result bool, ipAddress, userAgent string) {
	resultStr := "success"
	if !result {
		resultStr = "failed"
	}

	details := map[string]interface{}{
		"old_role": oldRole,
		"new_role": newRole,
	}
	detailsJSON, _ := json.Marshal(details)

	event := AuditEvent{
		EventType:      "role_change",
		ActorType:      actorType,
		ActorID:        actorID,
		TargetType:     "user",
		TargetID:       targetUserID,
		OrganizationID: organizationID,
		Action:         "change_role",
		Result:         resultStr,
		Details:        string(detailsJSON),
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
		Timestamp:      time.Now(),
	}

	if err := a.db.Create(&event).Error; err != nil {
		log.Errorf("Failed to log role change audit event: %v", err)
	}
}

// LogUserModification logs user modification events
func (a *AuditLogger) LogUserModification(actorType, actorID string, organizationID uint, targetUserID, action string, result bool, ipAddress, userAgent string) {
	resultStr := "success"
	if !result {
		resultStr = "failed"
	}

	event := AuditEvent{
		EventType:      "user_modification",
		ActorType:      actorType,
		ActorID:        actorID,
		TargetType:     "user",
		TargetID:       targetUserID,
		OrganizationID: organizationID,
		Action:         action,
		Result:         resultStr,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
		Timestamp:      time.Now(),
	}

	if err := a.db.Create(&event).Error; err != nil {
		log.Errorf("Failed to log user modification audit event: %v", err)
	}
}

// LogSecurityViolation logs security violation attempts
func (a *AuditLogger) LogSecurityViolation(actorType, actorID string, organizationID uint, violation, details string, ipAddress, userAgent string) {
	event := AuditEvent{
		EventType:      "security_violation",
		ActorType:      actorType,
		ActorID:        actorID,
		OrganizationID: organizationID,
		Action:         violation,
		Result:         "blocked",
		Details:        details,
		IPAddress:      ipAddress,
		UserAgent:      userAgent,
		Timestamp:      time.Now(),
	}

	if err := a.db.Create(&event).Error; err != nil {
		log.Errorf("Failed to log security violation audit event: %v", err)
	}
}

// Global audit logger instance
var auditLogger *AuditLogger

// InitializeAuditLogger initializes the global audit logger
func InitializeAuditLogger(db *gorm.DB) {
	auditLogger = NewAuditLogger(db)
}

// GetAuditLogger returns the global audit logger instance
func GetAuditLogger() *AuditLogger {
	return auditLogger
}
