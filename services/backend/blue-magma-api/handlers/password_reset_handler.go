package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/services"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	log "github.com/sirupsen/logrus"
)

// PasswordResetHandler handles password reset flows (request, validate, confirm).
type PasswordResetHandler struct {
	DB           *gorm.DB
	Redis        *redis.Client
	EmailService *services.EmailService
}

type PasswordResetRequest struct {
	Email string `json:"email"`
}

type PasswordResetConfirmRequest struct {
	Token           string `json:"token"`
	NewPassword     string `json:"new_password"`
	ConfirmPassword string `json:"confirm_password"`
}

type PasswordResetValidateResponse struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message,omitempty"`
}

const (
	passwordResetEmailLimit = 5
	passwordResetIPLimit    = 20
	passwordResetWindow     = time.Hour
)

func hashResetToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

// isRateLimited returns true if the request should be limited for this email/IP.
// It never changes the HTTP response shape; callers should still return generic success.
func (h *PasswordResetHandler) isRateLimited(c *fiber.Ctx, email string) bool {
	if h.Redis == nil {
		return false
	}

	ctx := context.Background()
	limited := false

	normalizedEmail := strings.ToLower(strings.TrimSpace(email))
	if normalizedEmail != "" {
		key := "pwdreset:email:" + normalizedEmail
		count, err := h.Redis.Incr(ctx, key).Result()
		if err != nil {
			log.Errorf("Failed to increment password reset email rate limit: %v", err)
		} else {
			if count == 1 {
				if err := h.Redis.Expire(ctx, key, passwordResetWindow).Err(); err != nil {
					log.Errorf("Failed to set password reset email rate limit TTL: %v", err)
				}
			}
			if count > passwordResetEmailLimit {
				limited = true
			}
		}
	}

	ip := c.IP()
	if ip != "" {
		key := "pwdreset:ip:" + ip
		count, err := h.Redis.Incr(ctx, key).Result()
		if err != nil {
			log.Errorf("Failed to increment password reset IP rate limit: %v", err)
			return limited
		}
		if count == 1 {
			if err := h.Redis.Expire(ctx, key, passwordResetWindow).Err(); err != nil {
				log.Errorf("Failed to set password reset IP rate limit TTL: %v", err)
			}
		}
		if count > passwordResetIPLimit {
			limited = true
		}
	}

	return limited
}

// @Summary Request password reset
// @Description Request a password reset email. Response is always 200 to avoid email enumeration.
// @Tags auth
// @Accept json
// @Produce json
// @Param body body PasswordResetRequest true "Password reset request"
// @Success 200 {object} fiber.Map
// @Router /auth/password-reset/request [post]
func (h *PasswordResetHandler) RequestPasswordReset(c *fiber.Ctx) error {
	var req PasswordResetRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse password reset request: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_request",
		})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "email_required",
		})
	}

	// Apply simple rate limiting by email and IP; always return generic success to callers.
	if h.isRateLimited(c, req.Email) {
		return c.JSON(fiber.Map{
			"success": true,
		})
	}

	// Look up user by email using email hash for fast lookup
	user, err := models.FindByEmail(h.DB, req.Email)
	if err != nil {
		if err != gorm.ErrRecordNotFound {
			log.Errorf("Failed to lookup user for password reset: %v", err)
		}
		// Always return generic success to avoid enumeration.
		return c.JSON(fiber.Map{
			"success": true,
		})
	}

	// Generate reset token sent to the user via email.
	rawToken, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate password reset token: %v", err)
		return c.JSON(fiber.Map{"success": true})
	}

	expiresAt := time.Now().Add(1 * time.Hour)
	user.TmpVerificationCode = hashResetToken(rawToken)
	user.TmpVerificationCodeExpiration = expiresAt.Format(time.RFC3339)

	if err := h.DB.Save(&user).Error; err != nil {
		log.Errorf("Failed to save password reset token: %v", err)
		return c.JSON(fiber.Map{"success": true})
	}

	// Send email with reset link.
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	resetURL := frontendURL + "/reset-password?token=" + rawToken

	// Use the original request email for sending the reset link.
	// At this point, user.Email has been re-encrypted by BeforeSave, so it no longer
	// contains a valid plaintext email address.
	normalizedEmail := strings.TrimSpace(strings.ToLower(req.Email))

	emailData := services.PasswordResetEmailData{
	UserEmail:     normalizedEmail,
	ResetURL:      resetURL,
	ExpirationRaw: expiresAt,
}

	if err := h.EmailService.SendPasswordResetEmail(emailData); err != nil {
		log.Errorf("Failed to send password reset email: %v", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
	})
}

// @Summary Validate password reset token
// @Description Validate a password reset token and return whether it is still valid.
// @Tags auth
// @Produce json
// @Param token query string true "Password reset token"
// @Success 200 {object} PasswordResetValidateResponse
// @Router /auth/password-reset/validate [get]
func (h *PasswordResetHandler) ValidatePasswordReset(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.JSON(PasswordResetValidateResponse{
			Valid:   false,
			Message: "token is required",
		})
	}

	hashedToken := hashResetToken(token)

	var user models.User
	if err := h.DB.Where("tmp_verification_code = ?", hashedToken).First(&user).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			log.Errorf("Failed to validate password reset token: %v", err)
		}
		return c.JSON(PasswordResetValidateResponse{
			Valid:   false,
			Message: "invalid or expired token",
		})
	}

	if user.TmpVerificationCodeExpiration == "" {
		return c.JSON(PasswordResetValidateResponse{Valid: false, Message: "invalid or expired token"})
	}

	expiresAt, err := time.Parse(time.RFC3339, user.TmpVerificationCodeExpiration)
	if err != nil || time.Now().After(expiresAt) {
		// Clear expired token.
		user.TmpVerificationCode = ""
		user.TmpVerificationCodeExpiration = ""
		_ = h.DB.Save(&user).Error
		return c.JSON(PasswordResetValidateResponse{Valid: false, Message: "invalid or expired token"})
	}

	return c.JSON(PasswordResetValidateResponse{Valid: true})
}

// @Summary Confirm password reset
// @Description Reset password using a valid token.
// @Tags auth
// @Accept json
// @Produce json
// @Param body body PasswordResetConfirmRequest true "Password reset confirm request"
// @Success 200 {object} fiber.Map
// @Failure 400 {object} fiber.Map
// @Router /auth/password-reset/confirm [post]
func (h *PasswordResetHandler) ConfirmPasswordReset(c *fiber.Ctx) error {
	var req PasswordResetConfirmRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse password reset confirm request: %v", err)
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_request",
		})
	}

	if req.Token == "" || req.NewPassword == "" || req.ConfirmPassword == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "missing_fields",
		})
	}

	if req.NewPassword != req.ConfirmPassword {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "password_mismatch",
		})
	}

	// Basic password length rule; frontend will likely enforce stronger ones.
	if len(req.NewPassword) < 8 {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "password_too_short",
		})
	}

	hashedToken := hashResetToken(req.Token)

	var user models.User
	if err := h.DB.Where("tmp_verification_code = ?", hashedToken).First(&user).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			log.Errorf("Failed to load user for password reset: %v", err)
		}
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_or_expired_token",
		})
	}

	if user.TmpVerificationCodeExpiration == "" {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_or_expired_token"})
	}

	expiresAt, err := time.Parse(time.RFC3339, user.TmpVerificationCodeExpiration)
	if err != nil || time.Now().After(expiresAt) {
		user.TmpVerificationCode = ""
		user.TmpVerificationCodeExpiration = ""
		_ = h.DB.Save(&user).Error
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_or_expired_token"})
	}

	// Hash and set new password.
	hash, err := crypto.HashPassword(req.NewPassword)
	if err != nil {
		log.Errorf("Failed to hash new password: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "server_error",
		})
	}

	user.SetPasswordHash(hash)
	user.TmpVerificationCode = ""
	user.TmpVerificationCodeExpiration = ""

	if err := h.DB.Save(&user).Error; err != nil {
		log.Errorf("Failed to save new password: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "server_error",
		})
	}

	// Revoke all existing refresh tokens for this user so that old sessions are logged out.
	if err := authz.UpdateUserRefreshTokens(user.ObjectID, h.DB, "", ""); err != nil {
		log.Errorf("Failed to revoke user refresh tokens after password reset: %v", err)
	}

	return c.JSON(fiber.Map{
		"success": true,
	})
}

