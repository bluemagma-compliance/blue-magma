package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
)

type AccessCodeHandler struct {
	Redis *redis.Client
}

type GenerateAccessCodeRequest struct {
	MaxUses    int    `json:"max_uses"`
	TTLSeconds int    `json:"ttl_seconds"`
	Note       string `json:"note"`
}

type GenerateAccessCodeResponse struct {
	Code      string `json:"code"`
	ExpiresAt int64  `json:"expires_at"`
	MaxUses   int    `json:"max_uses"`
}

// GenerateAccessCode creates a temporary access code stored in Redis with a TTL and max-uses counter.
// Defaults: max_uses=1, ttl=7 days.
func (h *AccessCodeHandler) GenerateAccessCode(c *fiber.Ctx) error {
	var req GenerateAccessCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Invalid JSON body",
		})
	}

	if req.MaxUses <= 0 {
		req.MaxUses = 1
	}
	if req.TTLSeconds <= 0 {
		req.TTLSeconds = 30 * 24 * 60 * 60 // 30 days (long-lived default)
	}

	code, err := generateCode(6)
	if err != nil {
		log.Errorf("failed generating access code: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "server_error"})
	}

	key := "access_code:" + code
	ctx := context.Background()

	// Set initial uses counter with TTL
	if err := h.Redis.Set(ctx, key, req.MaxUses, time.Duration(req.TTLSeconds)*time.Second).Err(); err != nil {
		log.Errorf("failed saving access code: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "server_error"})
	}

	expiresAt := time.Now().Add(time.Duration(req.TTLSeconds) * time.Second).Unix()
	return c.Status(fiber.StatusCreated).JSON(GenerateAccessCodeResponse{
		Code:      code,
		ExpiresAt: expiresAt,
		MaxUses:   req.MaxUses,
	})
}

func generateCode(bytesLen int) (string, error) {
	b := make([]byte, bytesLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	// Hex gives 2*bytesLen characters, uppercase for readability
	return strings.ToUpper(hex.EncodeToString(b)), nil
}
