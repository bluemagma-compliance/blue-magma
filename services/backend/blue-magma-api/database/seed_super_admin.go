package database

import (
	"fmt"
	"os"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// SeedSuperAdmin creates or updates the super admin user from environment variables
// This function validates all required environment variables and returns an error if any are missing
func SeedSuperAdmin(db *gorm.DB) error {
	log.Info("Seeding super admin...")

	// Required environment variables
	loginIdentifier := os.Getenv("SUPER_ADMIN_LOGIN")
	password := os.Getenv("SUPER_ADMIN_PASSWORD")
	allowedIPs := os.Getenv("SUPER_ADMIN_ALLOWED_IPS")
	twoFactorEmails := os.Getenv("SUPER_ADMIN_2FA_EMAILS")

	// Validate all required variables are present
	var missingVars []string
	if loginIdentifier == "" {
		missingVars = append(missingVars, "SUPER_ADMIN_LOGIN")
	}
	if password == "" {
		missingVars = append(missingVars, "SUPER_ADMIN_PASSWORD")
	}
	if allowedIPs == "" {
		missingVars = append(missingVars, "SUPER_ADMIN_ALLOWED_IPS")
	}
	if twoFactorEmails == "" {
		missingVars = append(missingVars, "SUPER_ADMIN_2FA_EMAILS")
	}

	if len(missingVars) > 0 {
		errMsg := fmt.Sprintf("Missing required super admin environment variables: %s", strings.Join(missingVars, ", "))
		log.Error(errMsg)
		return fmt.Errorf(errMsg)
	}

	// Validate IP addresses format (basic validation)
	if err := validateIPList(allowedIPs); err != nil {
		log.Errorf("Invalid SUPER_ADMIN_ALLOWED_IPS format: %v", err)
		return fmt.Errorf("invalid SUPER_ADMIN_ALLOWED_IPS format: %w", err)
	}

	// Validate email addresses format (basic validation)
	if err := validateEmailList(twoFactorEmails); err != nil {
		log.Errorf("Invalid SUPER_ADMIN_2FA_EMAILS format: %v", err)
		return fmt.Errorf("invalid SUPER_ADMIN_2FA_EMAILS format: %w", err)
	}

	// Hash the password
	passwordHash, err := crypto.HashPassword(password)
	if err != nil {
		log.Errorf("Failed to hash super admin password: %v", err)
		return fmt.Errorf("failed to hash super admin password: %w", err)
	}

	// Check if super admin already exists
	var existingSuperAdmin models.SuperAdmin
	err = db.Where("login_identifier = ?", loginIdentifier).First(&existingSuperAdmin).Error

	if err == gorm.ErrRecordNotFound {
		// Create new super admin
		superAdmin := models.SuperAdmin{
			LoginIdentifier: loginIdentifier,
			PasswordHash:    passwordHash,
			AllowedIPs:      allowedIPs,
			TwoFactorEmails: twoFactorEmails,
			IsActive:        true,
		}

		if err := db.Create(&superAdmin).Error; err != nil {
			log.Errorf("Failed to create super admin: %v", err)
			return fmt.Errorf("failed to create super admin: %w", err)
		}

		log.Infof("✅ Super admin created successfully: %s", loginIdentifier)
		log.Infof("   Allowed IPs: %s", allowedIPs)
		log.Infof("   2FA Emails: %s", twoFactorEmails)
	} else if err != nil {
		log.Errorf("Database error checking for existing super admin: %v", err)
		return fmt.Errorf("database error: %w", err)
	} else {
		// Update existing super admin
		existingSuperAdmin.PasswordHash = passwordHash
		existingSuperAdmin.AllowedIPs = allowedIPs
		existingSuperAdmin.TwoFactorEmails = twoFactorEmails
		existingSuperAdmin.IsActive = true

		if err := db.Save(&existingSuperAdmin).Error; err != nil {
			log.Errorf("Failed to update super admin: %v", err)
			return fmt.Errorf("failed to update super admin: %w", err)
		}

		log.Infof("✅ Super admin updated successfully: %s", loginIdentifier)
		log.Infof("   Allowed IPs: %s", allowedIPs)
		log.Infof("   2FA Emails: %s", twoFactorEmails)
	}

	return nil
}

// validateIPList validates a CSV list of IP addresses or CIDR ranges
func validateIPList(ipList string) error {
	if ipList == "" {
		return fmt.Errorf("IP list cannot be empty")
	}

	ips := strings.Split(ipList, ",")
	if len(ips) == 0 {
		return fmt.Errorf("IP list must contain at least one IP address")
	}

	for _, ip := range ips {
		ip = strings.TrimSpace(ip)
		if ip == "" {
			return fmt.Errorf("IP list contains empty entries")
		}
		// Basic validation - just check it's not empty
		// More thorough validation will be done in the IP matching logic
	}

	return nil
}

// validateEmailList validates a CSV list of email addresses
func validateEmailList(emailList string) error {
	if emailList == "" {
		return fmt.Errorf("email list cannot be empty")
	}

	emails := strings.Split(emailList, ",")
	if len(emails) == 0 {
		return fmt.Errorf("email list must contain at least one email address")
	}

	for _, email := range emails {
		email = strings.TrimSpace(email)
		if email == "" {
			return fmt.Errorf("email list contains empty entries")
		}
		if !strings.Contains(email, "@") {
			return fmt.Errorf("invalid email format: %s", email)
		}
	}

	return nil
}

