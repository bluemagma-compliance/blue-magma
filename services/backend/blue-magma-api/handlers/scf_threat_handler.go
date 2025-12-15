package handlers

import (
	"net/url"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/bluemagma-compliance/blue-magma-api/models"
)

type SCFThreatHandler struct {
	DB *gorm.DB
}

func NewSCFThreatHandler(db *gorm.DB) *SCFThreatHandler { return &SCFThreatHandler{DB: db} }

// SCFThreatView is the public shape returned by the API (excludes the raw data blob).
type SCFThreatView struct {
	ID          uint   `json:"id"`
	ObjectID    string `json:"object_id"`
	Grouping    string `json:"grouping"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Materiality string `json:"materiality"`
}

func toSCFThreatView(m models.SCFThreat) SCFThreatView {
	return SCFThreatView{
		ID:          m.ID,
		ObjectID:    m.ObjectID,
		Grouping:    m.Grouping,
		Title:       m.Title,
		Description: m.Description,
		Materiality: m.Materiality,
	}
}

// List returns public SCF threats with optional filters: grouping, q (search), limit, offset.
// Response includes pagination metadata: items, total, pages, limit, offset.
func (h *SCFThreatHandler) List(c *fiber.Ctx) error {
	var threats []models.SCFThreat

	db := h.DB.Model(&models.SCFThreat{})

	if g := strings.TrimSpace(c.Query("grouping")); g != "" {
		db = db.Where("grouping = ?", g)
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		db = db.Where("LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(object_id) LIKE ?", pattern, pattern, pattern)
	}

	limit := 50
	if lStr := c.Query("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 500 {
			limit = l
		}
	}
	offset := 0
	if oStr := c.Query("offset"); oStr != "" {
		if o, err := strconv.Atoi(oStr); err == nil && o >= 0 {
			offset = o
		}
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		logrus.Errorf("failed to count SCF threats: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF threats"})
	}

	if err := db.Order("object_id ASC").Limit(limit).Offset(offset).Find(&threats).Error; err != nil {
		logrus.Errorf("failed to list SCF threats: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF threats"})
	}

	views := make([]SCFThreatView, 0, len(threats))
	for _, t := range threats {
		views = append(views, toSCFThreatView(t))
	}

	pages := 0
	if limit > 0 {
		pages = int((total + int64(limit) - 1) / int64(limit))
	}

	return c.JSON(fiber.Map{
		"items":  views,
		"total":  total,
		"pages":  pages,
		"limit":  limit,
		"offset": offset,
	})
}

// GetByID returns a single SCF threat by its object_id (e.g., NT-1). Response excludes raw data blob.
func (h *SCFThreatHandler) GetByID(c *fiber.Ctx) error {
	idParam, _ := url.PathUnescape(c.Params("threat_id"))
	id := strings.TrimSpace(idParam)
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing threat_id"})
	}

	var threat models.SCFThreat
	if err := h.DB.Where("object_id = ?", id).First(&threat).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "SCF threat not found"})
		}
		logrus.Errorf("failed to get SCF threat: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF threat"})
	}
	return c.JSON(toSCFThreatView(threat))
}

