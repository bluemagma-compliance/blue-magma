package handlers

import (
	"encoding/json"
	"errors"

	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type PublicVisitorHandler struct {
	DB *gorm.DB
}

func NewPublicVisitorHandler(db *gorm.DB) *PublicVisitorHandler {
	return &PublicVisitorHandler{DB: db}
}

// VisitorMessage is the shape we persist in PublicVisitor.LastMessages.
type VisitorMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

type TrackPublicVisitorRequest struct {
	TokensUsed int64            `json:"tokens_used"`
	Messages   []VisitorMessage `json:"messages"`
}

type PublicVisitorResponse struct {
	VisitorID        string           `json:"visitor_id"`
	TotalPublicTokens int64           `json:"total_public_tokens"`
	LastMessages     []VisitorMessage `json:"last_messages"`
}

// ensureServiceOnly enforces that the caller is the internal service using
// the INTERNAL_API_KEY bearer token (not a user JWT or per-org API key).
func ensureServiceOnly(c *fiber.Ctx) (*middleware.AuthContext, error) {
	authCtx, ok := c.Locals("auth").(*middleware.AuthContext)
	if !ok || authCtx == nil {
		return nil, fiber.ErrUnauthorized
	}
	if !authCtx.IsService || authCtx.ServiceID != "service" {
		return nil, fiber.ErrForbidden
	}
	return authCtx, nil
}

// GetVisitor returns the current state for a public visitor.
//
// Method: GET /api/v1/public-visitors/:visitor_id
func (h *PublicVisitorHandler) GetVisitor(c *fiber.Ctx) error {
	if _, err := ensureServiceOnly(c); err != nil {
		if errors.Is(err, fiber.ErrUnauthorized) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}

	visitorID := c.Params("visitor_id")
	if visitorID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "visitor_id is required"})
	}

	var visitor models.PublicVisitor
	if err := h.DB.Where("visitor_id = ?", visitorID).First(&visitor).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "visitor not found"})
		}
		log.Errorf("Failed to load public visitor %s: %v", visitorID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load visitor"})
	}

	var messages []VisitorMessage
	if len(visitor.LastMessages) > 0 {
		if err := json.Unmarshal(visitor.LastMessages, &messages); err != nil {
			// If decoding fails, log and fall back to empty slice.
			log.Warnf("Failed to decode LastMessages for visitor %s: %v", visitorID, err)
			messages = []VisitorMessage{}
		}
	}

	resp := PublicVisitorResponse{
		VisitorID:        visitor.VisitorID,
		TotalPublicTokens: visitor.TotalPublicTokens,
		LastMessages:     messages,
	}

	return c.JSON(resp)
}

// TrackVisitor increments token usage and updates the rolling last-messages
// window for a public visitor.
//
// Method: POST /api/v1/public-visitors/:visitor_id/track
func (h *PublicVisitorHandler) TrackVisitor(c *fiber.Ctx) error {
	if _, err := ensureServiceOnly(c); err != nil {
		if errors.Is(err, fiber.ErrUnauthorized) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "forbidden"})
	}

	visitorID := c.Params("visitor_id")
	if visitorID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "visitor_id is required"})
	}

	var req TrackPublicVisitorRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Ensure non-negative token accounting.
	if req.TokensUsed < 0 {
		req.TokensUsed = 0
	}

	var visitor models.PublicVisitor
	if err := h.DB.Where("visitor_id = ?", visitorID).
		FirstOrCreate(&visitor, models.PublicVisitor{VisitorID: visitorID}).Error; err != nil {
		log.Errorf("Failed to create or load public visitor %s: %v", visitorID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to upsert visitor"})
	}

	visitor.TotalPublicTokens += req.TokensUsed

	// Merge existing last messages with the new ones and trim to last 10.
	var existing []VisitorMessage
	if len(visitor.LastMessages) > 0 {
		if err := json.Unmarshal(visitor.LastMessages, &existing); err != nil {
			log.Warnf("Failed to decode LastMessages for visitor %s: %v", visitorID, err)
			existing = []VisitorMessage{}
		}
	}

	combined := append(existing, req.Messages...)
	if len(combined) > 10 {
		combined = combined[len(combined)-10:]
	}

	bytes, err := json.Marshal(combined)
	if err != nil {
		log.Errorf("Failed to encode LastMessages for visitor %s: %v", visitorID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to encode messages"})
	}
	visitor.LastMessages = datatypes.JSON(bytes)

	if err := h.DB.Save(&visitor).Error; err != nil {
		log.Errorf("Failed to save public visitor %s: %v", visitorID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to save visitor"})
	}

	resp := PublicVisitorResponse{
		VisitorID:        visitor.VisitorID,
		TotalPublicTokens: visitor.TotalPublicTokens,
		LastMessages:     combined,
	}

	return c.JSON(resp)
}
