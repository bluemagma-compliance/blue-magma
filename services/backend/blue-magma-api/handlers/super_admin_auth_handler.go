package handlers

import (
	"context"
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
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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
	// Use the request-scoped context from Fiber so that any span events we emit
	// are attached to the HTTP span created by the otelfiber middleware.
	ctx := c.UserContext()
	// Bind the GORM session to this request context so that database spans
	// become children of the HTTP span instead of separate root traces.
	db := h.DB.WithContext(ctx)

	var req SuperAdminLoginRequest
	if err := c.BodyParser(&req); err != nil {
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_login_request_parse_error", "Failed to parse super admin login request", log.Fields{
			"error": err.Error(),
		})
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

	logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_login_attempt", "Super admin login attempt", log.Fields{
		"client_ip":        clientIP,
		"login_identifier": req.LoginIdentifier,
	})

	// Find super admin
	var superAdmin models.SuperAdmin
	if err := db.Where("login_identifier = ?", req.LoginIdentifier).First(&superAdmin).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_not_found", "Super admin not found", log.Fields{
				"login_identifier": req.LoginIdentifier,
			})
			return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminLoginResponse{
				Success: false,
				Message: "Invalid credentials",
			})
		}
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_lookup_error", "Database error finding super admin", log.Fields{
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Check if account is active
	if !superAdmin.IsActive {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_inactive", "Inactive super admin login attempt", log.Fields{
			"login_identifier": req.LoginIdentifier,
		})
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Account is disabled",
		})
	}

	// Check if account is locked
	if superAdmin.IsLocked() {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_locked", "Locked super admin login attempt", log.Fields{
			"login_identifier": req.LoginIdentifier,
		})
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Account is temporarily locked due to too many failed attempts",
		})
	}

	// Check IP whitelist
	allowed, err := utils.IsIPInWhitelist(clientIP, superAdmin.AllowedIPs)
	if err != nil {
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_ip_whitelist_check_error", "Error checking IP whitelist for super admin login", log.Fields{
			"client_ip":        clientIP,
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Record whether the origin IP matched the configured whitelist. This is both
	// logged and attached as a span event so that traces and logs stay aligned.
	logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_ip_whitelist_check", "Super admin IP whitelist check", log.Fields{
		"client_ip":        clientIP,
		"login_identifier": req.LoginIdentifier,
		"ip_allowed":       allowed,
	})

	if !allowed {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_ip_not_whitelisted", "Super admin login from non-whitelisted IP", log.Fields{
			"client_ip":        clientIP,
			"login_identifier": req.LoginIdentifier,
		})
		superAdmin.RecordFailedLogin()
		db.Save(&superAdmin)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Access denied: IP address not whitelisted",
		})
	}

	// Verify password
	if !crypto.CheckPasswordHash(req.Password, superAdmin.GetPasswordHash()) {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_invalid_password", "Invalid password for super admin", log.Fields{
			"login_identifier": req.LoginIdentifier,
		})
		superAdmin.RecordFailedLogin()
		db.Save(&superAdmin)
		return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Invalid credentials",
		})
	}

	// Generate 2FA code (6 digits)
	code, err := generate2FACode()
	if err != nil {
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_2fa_generate_error", "Failed to generate 2FA code", log.Fields{
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// NOTE: We deliberately do not log or attach the actual 2FA code to avoid
	// leaking sensitive information. We only record that a code was generated.
	logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_2fa_code_generated", "2FA code generated for super admin", log.Fields{
		"login_identifier": req.LoginIdentifier,
	})

	// Store 2FA code with 5-minute expiration
	expiresAt := time.Now().Add(5 * time.Minute)
	superAdmin.TwoFactorCode = code
	superAdmin.TwoFactorCodeExpiration = &expiresAt
	superAdmin.TwoFactorCodeAttempts = 0

	if err := db.Save(&superAdmin).Error; err != nil {
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_2fa_persist_error", "Failed to save 2FA code", log.Fields{
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminLoginResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Send 2FA code to all configured emails
	if err := h.send2FAEmails(ctx, &superAdmin, code); err != nil {
		// Don't fail the request, but record the failure for observability.
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_2fa_email_send_error", "Failed to send 2FA emails", log.Fields{
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
	}

	logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_2fa_code_sent", "2FA code sent for super admin", log.Fields{
		"login_identifier": req.LoginIdentifier,
	})

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
	// Use the request-scoped context from Fiber so that any span events we emit
	// are attached to the HTTP span created by the otelfiber middleware.
	ctx := c.UserContext()
	// Bind the GORM session to this request context so that database spans
	// become children of the HTTP span instead of separate root traces.
	db := h.DB.WithContext(ctx)

	var req SuperAdminVerify2FARequest
	if err := c.BodyParser(&req); err != nil {
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_2fa_request_parse_error", "Failed to parse 2FA verification request", log.Fields{
			"error": err.Error(),
		})
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

	logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_2fa_verify_attempt", "Super admin 2FA verification attempt", log.Fields{
		"client_ip":        clientIP,
		"login_identifier": req.LoginIdentifier,
	})

	// Find super admin
	var superAdmin models.SuperAdmin
	if err := db.Where("login_identifier = ?", req.LoginIdentifier).First(&superAdmin).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_not_found_2fa", "Super admin not found during 2FA", log.Fields{
				"login_identifier": req.LoginIdentifier,
			})
			return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminVerify2FAResponse{
				Success: false,
				Message: "Invalid credentials",
			})
		}
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_lookup_error_2fa", "Database error finding super admin during 2FA", log.Fields{
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Check if account is active
	if !superAdmin.IsActive {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_inactive_2fa", "Inactive super admin 2FA attempt", log.Fields{
			"login_identifier": req.LoginIdentifier,
		})
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Account is disabled",
		})
	}

	// Check IP whitelist again
	allowed, err := utils.IsIPInWhitelist(clientIP, superAdmin.AllowedIPs)
	// Record whether the origin IP matched the configured whitelist. This is both
	// logged and attached as a span event so that traces and logs stay aligned.
	ipAllowed := err == nil && allowed
	logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_2fa_ip_whitelist_check", "Super admin 2FA IP whitelist check", log.Fields{
		"client_ip":        clientIP,
		"login_identifier": req.LoginIdentifier,
		"ip_allowed":       ipAllowed,
		"ip_check_error":   err != nil,
	})
	if err != nil || !allowed {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_2fa_ip_not_whitelisted", "Super admin 2FA from non-whitelisted IP", log.Fields{
			"client_ip":        clientIP,
			"login_identifier": req.LoginIdentifier,
		})
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Access denied: IP address not whitelisted",
		})
	}

	// Check if 2FA code exists and is valid
	if !superAdmin.Is2FACodeValid() {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_2fa_code_invalid_state", "Expired or missing 2FA code for super admin", log.Fields{
			"login_identifier": req.LoginIdentifier,
		})
		return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "2FA code expired or not found. Please login again.",
		})
	}

	// Check if too many attempts
	if superAdmin.IsTwoFactorAttemptsExceeded() {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_2fa_attempts_exceeded", "Too many 2FA attempts for super admin", log.Fields{
			"login_identifier": req.LoginIdentifier,
		})
		superAdmin.ResetTwoFactorCode()
		db.Save(&superAdmin)
		return c.Status(fiber.StatusForbidden).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Too many failed attempts. Please login again.",
		})
	}

	// Verify 2FA code
	if superAdmin.TwoFactorCode != req.Code {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_2fa_code_invalid", "Invalid 2FA code for super admin", log.Fields{
			"login_identifier": req.LoginIdentifier,
		})
		superAdmin.IncrementTwoFactorAttempts()
		db.Save(&superAdmin)
		return c.Status(fiber.StatusUnauthorized).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Invalid 2FA code",
		})
	}

	// 2FA successful - generate JWT token
	token, err := authz.GenerateSuperAdminToken(superAdmin.LoginIdentifier, clientIP)
	if err != nil {
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_token_generate_error", "Failed to generate super admin token", log.Fields{
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
		return c.Status(fiber.StatusInternalServerError).JSON(SuperAdminVerify2FAResponse{
			Success: false,
			Message: "Internal server error",
		})
	}

	// Clear 2FA code and record successful login.
	//
	// NOTE: We use Updates() with an explicit map here to guarantee that
	// pointer fields like TwoFactorCodeExpiration are actually persisted as
	// NULL in the database when cleared. Using struct-based Save/Updates can
	// sometimes skip zero-value fields, which would leave a stale expiration
	// timestamp even though the in-memory struct has been reset.
	superAdmin.ResetTwoFactorCode()
	superAdmin.RecordSuccessfulLogin(clientIP)
	if err := db.Model(&superAdmin).Updates(map[string]interface{}{
		"two_factor_code":            superAdmin.TwoFactorCode,
		"two_factor_code_expiration": gorm.Expr("NULL"),
		"two_factor_code_attempts":   superAdmin.TwoFactorCodeAttempts,
		"failed_login_count":         superAdmin.FailedLoginCount,
		"last_failed_login_at":       superAdmin.LastFailedLoginAt,
		"locked_until":               superAdmin.LockedUntil,
		"last_login_at":              superAdmin.LastLoginAt,
		"last_login_ip":              superAdmin.LastLoginIP,
	}).Error; err != nil {
		// Don't fail the request, token is already generated, but record the error.
		logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_post_login_update_error", "Failed to update super admin after successful login", log.Fields{
			"login_identifier": req.LoginIdentifier,
			"error":            err.Error(),
		})
	}

	logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_login_success", "Super admin login successful", log.Fields{
		"login_identifier": req.LoginIdentifier,
		"client_ip":        clientIP,
	})

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
func (h *SuperAdminAuthHandler) send2FAEmails(ctx context.Context, superAdmin *models.SuperAdmin, code string) error {
	if h.EmailService == nil {
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_2fa_email_service_missing", "Email service not configured, cannot send 2FA emails", log.Fields{
			"login_identifier": superAdmin.LoginIdentifier,
		})
		return fmt.Errorf("email service not configured")
	}

	emails := parseEmailList(superAdmin.TwoFactorEmails)
	if len(emails) == 0 {
		// Nothing to send; record this as an event so traces and logs show why.
		logAndAddSpanEvent(ctx, log.WarnLevel, "super_admin_2fa_no_emails_configured", "No email addresses configured for 2FA", log.Fields{
			"login_identifier": superAdmin.LoginIdentifier,
		})
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
			// Continue sending to other emails, but record each failure as a log and span event.
			logAndAddSpanEvent(ctx, log.ErrorLevel, "super_admin_2fa_email_send_failed", "Failed to send 2FA email", log.Fields{
				"login_identifier": superAdmin.LoginIdentifier,
				"email":            email,
				"error":            err.Error(),
			})
		} else {
			logAndAddSpanEvent(ctx, log.InfoLevel, "super_admin_2fa_email_sent", "2FA code sent", log.Fields{
				"login_identifier": superAdmin.LoginIdentifier,
				"email":            email,
			})
		}
	}

	return nil
}

// logAndAddSpanEvent is a small helper that keeps logs and traces aligned for
// important security events. It writes a structured log entry and, if there is
// an active OpenTelemetry span in the provided context, it also adds a span
// event with matching attributes so that the same story appears in both logs
// and traces.
//
// Typical usage from HTTP handlers is to pass the framework's request context
// (e.g. Fiber's c.UserContext()), which already carries the span created by
// the OTel middleware. Outside of request handlers (e.g. in seeders or
// background jobs), you can pass context.Background() or a context that you
// created with tracer.Start; in that case, if no span is present, this helper
// will still log but will simply skip adding span events.
func logAndAddSpanEvent(ctx context.Context, level log.Level, eventName, msg string, fields log.Fields) {
	if fields == nil {
		fields = log.Fields{}
	}

	entry := log.WithFields(fields).WithField("event", eventName)

	// If there's an active span, enrich the log with trace/span IDs and add a
	// corresponding event to the span for end-to-end observability.
	span := trace.SpanFromContext(ctx)
	if span != nil {
		sc := span.SpanContext()
		if sc.IsValid() {
			entry = entry.WithFields(log.Fields{
				"trace_id": sc.TraceID().String(),
				"span_id":  sc.SpanID().String(),
			})
		}

		var attrs []attribute.KeyValue
		for k, v := range fields {
			switch val := v.(type) {
			case string:
				attrs = append(attrs, attribute.String(k, val))
			case bool:
				attrs = append(attrs, attribute.Bool(k, val))
			case int:
				attrs = append(attrs, attribute.Int(k, val))
			case int64:
				attrs = append(attrs, attribute.Int64(k, val))
			case float64:
				attrs = append(attrs, attribute.Float64(k, val))
			default:
				attrs = append(attrs, attribute.String(k, fmt.Sprint(val)))
			}
		}
		attrs = append(attrs, attribute.String("log.message", msg))

		span.AddEvent(eventName, trace.WithAttributes(attrs...))
	}

	switch level {
	case log.DebugLevel:
		entry.Debug(msg)
	case log.WarnLevel:
		entry.Warn(msg)
	case log.ErrorLevel:
		entry.Error(msg)
	default:
		entry.Info(msg)
	}
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
