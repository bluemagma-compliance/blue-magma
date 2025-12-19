package models

import (
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	ObjectID string `json:"object_id" gorm:"unique;not null"`

	FirstName    string `json:"name"`    //must be encrypted
	LastName     string `json:"surname"` //must be encrypted
	Username     string `json:"username" gorm:"unique"`
	PasswordHash string `json:"-" gorm:"column:password_hash"` // private + hidden from JSON
	Phone        *string `json:"phone" gorm:"unique"`          //must be encrypted (nullable)
	Email        string `json:"email" gorm:"unique"`           //must be encrypted
	EmailHash    string `json:"-" gorm:"index"`                // SHA256 hash of email for fast lookups

	Organization   Organization `gorm:"foreignKey:OrganizationID"` // No cascade delete - we don't want users to delete organizations
	OrganizationID uint         `json:"organization_id"`           // Foreign key to Organization

	// RBAC Relationships - Cascade delete UserRoles when User is deleted
	UserRoles []UserRole `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:UserID" json:"user_roles,omitempty"`

	Address    string `json:"address"`     //must be encrypted
	City       string `json:"city"`        //must be encrypted
	State      string `json:"state"`       //must be encrypted
	PostalCode string `json:"postal_code"` //must be encrypted
	Country    string `json:"country"`     //must be encrypted

	Verified                      bool   `json:"verified"`
	TmpVerificationCode           string `json:"tmp_verification_code"`
	TmpVerificationCodeExpiration string `json:"tmp_verification_code_expiration"`

	RefreshTokens string `json:"refresh_tokens"`

	// GitHub OAuth fields
	GitHubUserID    *int64 `json:"github_user_id" gorm:"index"`
	GitHubUsername  string `json:"github_username"`
	GitHubAvatarURL string `json:"github_avatar_url"`

	// Google OAuth fields
	GoogleUserID  string `json:"google_user_id" gorm:"index"`
	GoogleEmail   string `json:"google_email"`
	GoogleName    string `json:"google_name"`
	GooglePicture string `json:"google_picture"`

	ChatMemory string `json:"chat_memory"` // JSON string for storing chat history

	// User profile fields
	UserTitle     string `json:"user_title"`     // User's job title
	UserRole      string `json:"user_role"`      // User's role in the organization
	UserKnowledge string `json:"user_knowledge"` // User's knowledge/expertise areas

	// Invitation fields
	InvitationToken      string     `json:"-" gorm:"index"` // Hidden from JSON for security
	InvitationExpiresAt  *time.Time `json:"invitation_expires_at,omitempty"`
	InvitedByUserID      *uint      `json:"invited_by_user_id,omitempty"`
	InvitationAcceptedAt *time.Time `json:"invitation_accepted_at,omitempty"`
	InvitationStatus     string     `json:"invitation_status" gorm:"default:'pending'"` // pending, accepted, expired
}

func (u *User) SetPasswordHash(hash string) {
	u.PasswordHash = hash
}

// GetPasswordHash returns the password hash
func (u *User) GetPasswordHash() string {
	return u.PasswordHash
}

// GetPrimaryRole returns the user's primary role name for the given organization
// Returns the role with the lowest hierarchy level (highest privilege)
func (u *User) GetPrimaryRole(organizationID uint) string {
	if len(u.UserRoles) == 0 {
		return ""
	}

	var primaryRole string
	lowestHierarchy := 999 // Start with high number

	for _, userRole := range u.UserRoles {
		if userRole.OrganizationID == organizationID && userRole.IsActive {
			if userRole.Role.HierarchyLevel < lowestHierarchy {
				lowestHierarchy = userRole.Role.HierarchyLevel
				primaryRole = userRole.Role.Name
			}
		}
	}

	return primaryRole
}

// IsOwner checks if the user has the owner role in the given organization
func (u *User) IsOwner(organizationID uint) bool {
	return u.GetPrimaryRole(organizationID) == "owner"
}

// IsAdmin checks if the user has the admin role in the given organization
func (u *User) IsAdmin(organizationID uint) bool {
	return u.GetPrimaryRole(organizationID) == "admin"
}

// GetRoleHierarchyLevel is deprecated - use authz.GetHierarchyService().GetRoleLevel() instead
// This method is kept for backward compatibility but returns 0 to prevent import cycles
func (u *User) GetRoleHierarchyLevel(organizationID uint) (int, error) {
	// To get hierarchy level, use: authz.GetHierarchyService().GetRoleLevel(user.GetPrimaryRole(orgID))
	return 0, nil
}

// CanModifyUser is deprecated - use authz.CanUserModifyUser() instead
// This method is kept for backward compatibility but always returns false to prevent import cycles
func (u *User) CanModifyUser(targetUser *User, organizationID uint) bool {
	// To check modification permissions, use: authz.CanUserModifyUser(db, actingUserID, targetUserID, orgID)
	return false
}

// FindByEmail finds a user by email using the email hash for fast lookup
// Returns the user with decrypted fields via AfterFind hook
func FindByEmail(db *gorm.DB, email string) (*User, error) {
	emailHash := crypto.HashString(email)
	var user User
	if err := db.Where("email_hash = ?", emailHash).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// FindByEmailWithPreload finds a user by email with preloaded associations
func FindByEmailWithPreload(db *gorm.DB, email string, preloads ...string) (*User, error) {
	emailHash := crypto.HashString(email)
	query := db.Where("email_hash = ?", emailHash)
	for _, preload := range preloads {
		query = query.Preload(preload)
	}
	var user User
	if err := query.First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// encrypts the fields before saving to the database
func (a *User) BeforeSave(tx *gorm.DB) error {
	var err error

	if a.FirstName != "" {
		a.FirstName, err = crypto.EncryptField(a.FirstName)
		if err != nil {
			return err
		}
	}

	if a.LastName != "" {
		a.LastName, err = crypto.EncryptField(a.LastName)
		if err != nil {
			return err
		}
	}

	if a.Phone != nil && *a.Phone != "" {
		encrypted, err := crypto.EncryptField(*a.Phone)
		if err != nil {
			return err
		}
		*a.Phone = encrypted
	}

	if a.Email != "" {
		// Set email hash before encrypting (for fast lookups)
		a.EmailHash = crypto.HashString(a.Email)

		a.Email, err = crypto.EncryptField(a.Email)
		if err != nil {
			return err
		}
	}

	// Encrypt Google SSO profile fields (email/name)
	if a.GoogleEmail != "" {
		a.GoogleEmail, err = crypto.EncryptField(a.GoogleEmail)
		if err != nil {
			return err
		}
	}

	if a.GoogleName != "" {
		a.GoogleName, err = crypto.EncryptField(a.GoogleName)
		if err != nil {
			return err
		}
	}

	// Encrypt GitHub profile username (avatar URL is left in plaintext)
	if a.GitHubUsername != "" {
		a.GitHubUsername, err = crypto.EncryptField(a.GitHubUsername)
		if err != nil {
			return err
		}
	}

	if a.Address != "" {
		a.Address, err = crypto.EncryptField(a.Address)
		if err != nil {
			return err
		}
	}

	if a.City != "" {
		a.City, err = crypto.EncryptField(a.City)
		if err != nil {
			return err
		}
	}

	if a.State != "" {
		a.State, err = crypto.EncryptField(a.State)
		if err != nil {
			return err
		}
	}

	if a.PostalCode != "" {
		a.PostalCode, err = crypto.EncryptField(a.PostalCode)
		if err != nil {
			return err
		}
	}

	if a.Country != "" {
		a.Country, err = crypto.EncryptField(a.Country)
		if err != nil {
			return err
		}
	}

	return nil
}

func (a *User) AfterFind(tx *gorm.DB) error {
	var err error

	if a.FirstName != "" {
		a.FirstName, err = crypto.DecryptField(a.FirstName)
		if err != nil {
			return err
		}
	}

	if a.LastName != "" {
		a.LastName, err = crypto.DecryptField(a.LastName)
		if err != nil {
			return err
		}
	}

	if a.Phone != nil && *a.Phone != "" {
		decrypted, err := crypto.DecryptField(*a.Phone)
		if err != nil {
			return err
		}
		*a.Phone = decrypted
	}

	if a.Email != "" {
		a.Email, err = crypto.DecryptField(a.Email)
		if err != nil {
			return err
		}
	}

	// Decrypt Google SSO profile fields
	if a.GoogleEmail != "" {
		if decrypted, err := crypto.DecryptField(a.GoogleEmail); err == nil {
			a.GoogleEmail = decrypted
		}
		// If decryption fails, assume value is from before we started encrypting and leave as-is.
	}

	if a.GoogleName != "" {
		if decrypted, err := crypto.DecryptField(a.GoogleName); err == nil {
			a.GoogleName = decrypted
		}
		// If decryption fails, assume value is from before we started encrypting and leave as-is.
	}

	// Decrypt GitHub profile username
	if a.GitHubUsername != "" {
		if decrypted, err := crypto.DecryptField(a.GitHubUsername); err == nil {
			a.GitHubUsername = decrypted
		}
		// If decryption fails, assume value is from before we started encrypting and leave as-is.
	}

	if a.Address != "" {
		a.Address, err = crypto.DecryptField(a.Address)
		if err != nil {
			return err
		}
	}

	if a.City != "" {
		a.City, err = crypto.DecryptField(a.City)
		if err != nil {
			return err
		}
	}

	if a.State != "" {
		a.State, err = crypto.DecryptField(a.State)
		if err != nil {
			return err
		}
	}

	if a.PostalCode != "" {
		a.PostalCode, err = crypto.DecryptField(a.PostalCode)
		if err != nil {
			return err
		}
	}

	if a.Country != "" {
		a.Country, err = crypto.DecryptField(a.Country)
		if err != nil {
			return err
		}
	}

	return nil
}
