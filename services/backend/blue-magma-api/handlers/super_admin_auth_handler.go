package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/bluemagma-compliance/blue-magma-api/utils"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// SuperAdminAuthHandler handles super admin authentication
type SuperAdminAuthHandler struct {
	DB           *gorm.DB
	EmailService *services.EmailService
}

// SuperAdminLoginRequest represents the login request payload
type SuperAdminLoginRequest struct {
	LoginIdentifier string `json:"login_identifier"`
	Password        string `json:"password"`
}

// SuperAdminLoginResponse represents the login response
type SuperAdminLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// SuperAdminVerify2FARequest represents the 2FA verification request
type SuperAdminVerify2FARequest struct {
	LoginIdentifier string `json:"login_identifier"`
	Code            string `json:"code"`
}

// SuperAdminVerify2FAResponse represents the 2FA verification response
type SuperAdminVerify2FAResponse struct {
	Success     bool   `json:"success"`
	Message     string `json:"message"`
	AccessToken string `json:"access_token,omitempty"`
	TokenType   string `json:"token_type,omitempty"`
	ExpiresIn   int    `json:"expires_in,omitempty"`
}

// HandleSuperAdminLogin handles the initial login request
// It validates credentials, checks IP whitelist, and sends 2FA code
// @Summary Super admin login (step 1)
// @Description Validates credentials and IP, sends 2FA code to configured emails
// @Tags super-admin
// @Accept json
// @Produce json
// @Param body body SuperAdminLoginRequest true "Login credentials"
// @Success 200 {object} SuperAdminLoginResponse
// @Failure 400 {object} SuperAdminLoginResponse
// @Failure 401 {object} SuperAdminLoginResponse
// @Failure 403 {object} SuperAdminLoginResponse
// @Router /super-admin/auth/login [post]
func (h *SuperAdminAuthHandler) HandleSuperAdminLogin(c *fiber.Ctx) error {
	var req SuperAdminLoginRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse super admin login request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Invalid request format",
		})
	}

	// Validate required fields
	if req.LoginIdentifier == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Login identifier and password are required",
		})
	}

	// Get client IP
	clientIP := utils.GetClientIP(
		c.Get("X-Forwarded-For"),
		c.Get("X-Real-IP"),
		c.Context().RemoteAddr().String(),
	)

	log.Infof("Super admin login attempt from IP: %s for user: %s", clientIP, req.LoginIdentifier)

	// Find super admin
	var superAdmin models.SuperAdmin
	if err := h.DB.Where("login_identifier = ?", req.LoginIdentifier).First(&superAdmin).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Warnf("Super admin not found: %s", req.LoginIdentifier)
			return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminLoginResponse{
				Success: false,
				Message: "Invalid credentials",
			})
		}
		log.Errorf("Database error finding super admin: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Check if account is active
	if !superAdmin.IsActive {
		log.Warnf("Inactive super admin login attempt: %s", req.LoginIdentifier)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Account is disabled",
		})
	}

	// Check if account is locked
	if superAdmin.IsLocked() {
		log.Warnf("Locked super admin login attempt: %s", req.LoginIdentifier)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Account is temporarily locked due to too many failed attempts",
		})
	}

	// Check IP whitelist
	allowed, err := utils.IsIPInWhitelist(clientIP, superAdmin.AllowedIPs)
	if err != nil {
		log.Errorf("Error checking IP whitelist: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	if !allowed {
		log.Warnf("Super admin login from non-whitelisted IP: %s for user: %s", clientIP, req.LoginIdentifier)
		superAdmin.RecordFailedLogin()
		h.DB.Save(&superAdmin)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Access denied: IP address not whitelisted",
		})
	}

	// Verify password
	if !crypto.CheckPasswordHash(req.Password, superAdmin.GetPasswordHash()) {
		log.Warnf("Invalid password for super admin: %s", req.LoginIdentifier)
		superAdmin.RecordFailedLogin()
		h.DB.Save(&superAdmin)
		return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Invalid credentials",
		})
	}

	// Generate 2FA code (6 digits)
	code, err := generate2FACode()
	if err != nil {
		log.Errorf("Failed to generate 2FA code: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Store 2FA code with 5-minute expiration
	expiresAt := time.Now().Add(5 * time.Minute)
	superAdmin.TwoFactorCode = code
	superAdmin.TwoFactorCodeExpiration = &expiresAt
	superAdmin.TwoFactorCodeAttempts = 0

	if err := h.DB.Save(&superAdmin).Error; err != nil {
		log.Errorf("Failed to save 2FA code: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Send 2FA code to all configured emails
	if err := h.send2FAEmails(&superAdmin, code); err != nil {
		log.Errorf("Failed to send 2FA emails: %v", err)
		// Don't fail the request, but log the error
	}

	log.Infof("2FA code sent for super admin: %s", req.LoginIdentifier)

	return c.JSON(SuperAdminLoginResponse{
		Success: true,
		Message: "2FA code sent to configured email addresses",
	})
}

// HandleSuperAdminVerify2FA handles the 2FA verification and issues JWT token
// @Summary Super admin 2FA verification (step 2)
// @Description Verifies 2FA code and issues super admin JWT token
// @Tags super-admin
// @Accept json
// @Produce json
// @Param body body SuperAdminVerify2FARequest true "2FA verification"
// @Success 200 {object} SuperAdminVerify2FAResponse
// @Failure 400 {object} SuperAdminVerify2FAResponse
// @Failure 401 {object} SuperAdminVerify2FAResponse
// @Failure 403 {object} SuperAdminVerify2FAResponse
// @Router /super-admin/auth/verify-2fa [post]
func (h *SuperAdminAuthHandler) HandleSuperAdminVerify2FA(c *fiber.Ctx) error {
	var req SuperAdminVerify2FARequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse 2FA verification request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Invalid request format",
		})
	}

	// Validate required fields
	if req.LoginIdentifier == "" || req.Code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Login identifier and code are required",
		})
	}

	// Get client IP
	clientIP := utils.GetClientIP(
		c.Get("X-Forwarded-For"),
		c.Get("X-Real-IP"),
		c.Context().RemoteAddr().String(),
	)

	log.Infof("Super admin 2FA verification attempt from IP: %s for user: %s", clientIP, req.LoginIdentifier)

	// Find super admin
	var superAdmin models.SuperAdmin
	if err := h.DB.Where("login_identifier = ?", req.LoginIdentifier).First(&superAdmin).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Warnf("Super admin not found during 2FA: %s", req.LoginIdentifier)
			return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminVerify2FAResponse{
				Success: false,
				Message: "Invalid credentials",
			})
		}
		log.Errorf("Database error finding super admin: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Check if account is active
	if !superAdmin.IsActive {
		log.Warnf("Inactive super admin 2FA attempt: %s", req.LoginIdentifier)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Account is disabled",
		})
	}

	// Check IP whitelist again
	allowed, err := utils.IsIPInWhitelist(clientIP, superAdmin.AllowedIPs)
	if err != nil || !allowed {
		log.Warnf("Super admin 2FA from non-whitelisted IP: %s for user: %s", clientIP, req.LoginIdentifier)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Access denied: IP address not whitelisted",
		})
	}

	// Check if 2FA code exists and is valid
	if !superAdmin.Is2FACodeValid() {
		log.Warnf("Expired or missing 2FA code for super admin: %s", req.LoginIdentifier)
		return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "2FA code expired or not found. Please login again.",
		})
	}

	// Check if too many attempts
	if superAdmin.IsTwoFactorAttemptsExceeded() {
		log.Warnf("Too many 2FA attempts for super admin: %s", req.LoginIdentifier)
		superAdmin.ResetTwoFactorCode()
		h.DB.Save(&superAdmin)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Too many failed attempts. Please login again.",
		})
	}

	// Verify 2FA code
	if superAdmin.TwoFactorCode != req.Code {
		log.Warnf("Invalid 2FA code for super admin: %s", req.LoginIdentifier)
		superAdmin.IncrementTwoFactorAttempts()
		h.DB.Save(&superAdmin)
		return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Invalid 2FA code",
		})
	}

	// 2FA successful - generate JWT token
	token, err := authz.GenerateSuperAdminToken(superAdmin.LoginIdentifier, clientIP)
	if err != nil {
		log.Errorf("Failed to generate super admin token: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Clear 2FA code and record successful login
	superAdmin.ResetTwoFactorCode()
	superAdmin.RecordSuccessfulLogin(clientIP)
	if err := h.DB.Save(&superAdmin).Error; err != nil {
		log.Errorf("Failed to update super admin after successful login: %v", err)
		// Don't fail the request, token is already generated
	}

	log.Infof("Super admin login successful: %s from IP: %s", req.LoginIdentifier, clientIP)

	return c.JSON(SuperAdminVerify2FAResponse{
		Success:     true,
		Message:     "Authentication successful",
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresIn:   int(authz.SuperAdminTokenExpiry.Seconds()),
	})
}

// generate2FACode generates a random 6-digit code
func generate2FACode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// send2FAEmails sends the 2FA code to all configured email addresses
func (h *SuperAdminAuthHandler) send2FAEmails(superAdmin *models.SuperAdmin, code string) error {
	if h.EmailService == nil {
		log.Warn("Email service not configured, cannot send 2FA emails")
		return fmt.Errorf("email service not configured")
	}

	emails := parseEmailList(superAdmin.TwoFactorEmails)
	if len(emails) == 0 {
		return fmt.Errorf("no email addresses configured for 2FA")
	}

	subject := "Blue Magma Super Admin 2FA Code"
	body := fmt.Sprintf(`
		<h2>Super Admin Login Verification</h2>
		<p>Your 2FA verification code is:</p>
		<h1 style="font-size: 32px; letter-spacing: 5px; font-family: monospace;">%s</h1>
		<p>This code will expire in 5 minutes.</p>
		<p>If you did not attempt to login, please contact your system administrator immediately.</p>
	`, code)

	// Send to all configured emails
	for _, email := range emails {
		if err := h.EmailService.SendEmail(email, subject, body); err != nil {
			log.Errorf("Failed to send 2FA email to %s: %v", email, err)
			// Continue sending to other emails
		} else {
			log.Infof("2FA code sent to: %s", email)
		}
	}

	return nil
}

// parseEmailList parses a CSV string of email addresses
func parseEmailList(emailList string) []string {
	if emailList == "" {
		return []string{}
	}

	emails := []string{}
	for _, email := range strings.Split(emailList, ",") {
		email = strings.TrimSpace(email)
		if email != "" {
			emails = append(emails, email)
		}
	}
	return emails
}

