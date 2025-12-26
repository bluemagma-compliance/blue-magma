package models

import (
	"time"

	"gorm.io/gorm"
)

// SuperAdmin represents a system-level administrator with elevated privileges
// This is completely separate from regular users and organizations
type SuperAdmin struct {
	gorm.Model
	LoginIdentifier string `gorm:"unique;not null" json:"login_identifier"` // Username/email for login
	PasswordHash    string `json:"-" gorm:"not null"`                       // Bcrypt hash, hidden from JSON
	AllowedIPs      string `gorm:"type:text" json:"-"`                      // CSV of allowed IP addresses/CIDR ranges
	TwoFactorEmails string `gorm:"type:text" json:"-"`                      // CSV of email addresses for 2FA codes
	IsActive        bool   `gorm:"default:true" json:"is_active"`           // Can be disabled without deletion

	// 2FA fields
	TwoFactorCode           string     `json:"-"` // Current 2FA code (6 digits)
	TwoFactorCodeExpiration *time.Time `json:"-"` // When the 2FA code expires
	TwoFactorCodeAttempts   int        `json:"-"` // Number of failed attempts (rate limiting)

	// Audit fields
	LastLoginAt       *time.Time `json:"last_login_at,omitempty"`
	LastLoginIP       string     `json:"-"`                       // Last successful login IP
	FailedLoginCount  int        `json:"-" gorm:"default:0"`      // Failed login attempts
	LastFailedLoginAt *time.Time `json:"-"`                       // Last failed login timestamp
	LockedUntil       *time.Time `json:"-"`                       // Account lock expiration (after too many failures)
}

// SetPasswordHash sets the password hash
func (sa *SuperAdmin) SetPasswordHash(hash string) {
	sa.PasswordHash = hash
}

// GetPasswordHash returns the password hash
func (sa *SuperAdmin) GetPasswordHash() string {
	return sa.PasswordHash
}

// IsLocked checks if the account is currently locked
func (sa *SuperAdmin) IsLocked() bool {
	if sa.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*sa.LockedUntil)
}

// Is2FACodeValid checks if the 2FA code is still valid
func (sa *SuperAdmin) Is2FACodeValid() bool {
	if sa.TwoFactorCodeExpiration == nil {
		return false
	}
	return time.Now().Before(*sa.TwoFactorCodeExpiration)
}

// RecordFailedLogin increments failed login counter and locks account if threshold exceeded
func (sa *SuperAdmin) RecordFailedLogin() {
	sa.FailedLoginCount++
	now := time.Now()
	sa.LastFailedLoginAt = &now

	// Lock account for 30 minutes after 5 failed attempts
	if sa.FailedLoginCount >= 5 {
		lockUntil := now.Add(30 * time.Minute)
		sa.LockedUntil = &lockUntil
	}
}

// RecordSuccessfulLogin resets failed login counter and updates last login info
func (sa *SuperAdmin) RecordSuccessfulLogin(ip string) {
	sa.FailedLoginCount = 0
	sa.LastFailedLoginAt = nil
	sa.LockedUntil = nil
	now := time.Now()
	sa.LastLoginAt = &now
	sa.LastLoginIP = ip
}

// ResetTwoFactorCode clears the 2FA code and related fields
func (sa *SuperAdmin) ResetTwoFactorCode() {
	sa.TwoFactorCode = ""
	sa.TwoFactorCodeExpiration = nil
	sa.TwoFactorCodeAttempts = 0
}

// IncrementTwoFactorAttempts increments the 2FA attempt counter
func (sa *SuperAdmin) IncrementTwoFactorAttempts() {
	sa.TwoFactorCodeAttempts++
}

// IsTwoFactorAttemptsExceeded checks if too many 2FA attempts have been made
func (sa *SuperAdmin) IsTwoFactorAttemptsExceeded() bool {
	return sa.TwoFactorCodeAttempts >= 3
}

