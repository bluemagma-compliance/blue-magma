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

type SCFRiskHandler struct {
	DB *gorm.DB
}

func NewSCFRiskHandler(db *gorm.DB) *SCFRiskHandler { return &SCFRiskHandler{DB: db} }

// SCFRiskView is the public shape returned by the API (excludes the raw data blob).
type SCFRiskView struct {
	ID           uint   `json:"id"`
	ObjectID     string `json:"object_id"`
	Grouping     string `json:"grouping"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	NISTFunction string `json:"nist_function"`
	Materiality  string `json:"materiality"`
}

func toSCFRiskView(m models.SCFRisk) SCFRiskView {
	return SCFRiskView{
		ID:           m.ID,
		ObjectID:     m.ObjectID,
		Grouping:     m.Grouping,
		Title:        m.Title,
		Description:  m.Description,
		NISTFunction: m.NISTFunction,
		Materiality:  m.Materiality,
	}
}

// List returns public SCF risks with optional filters: grouping, function, q (search), limit, offset.
// Response includes pagination metadata: items, total, pages, limit, offset.
func (h *SCFRiskHandler) List(c *fiber.Ctx) error {
	var risks []models.SCFRisk

	db := h.DB.Model(&models.SCFRisk{})

	if g := strings.TrimSpace(c.Query("grouping")); g != "" {
		db = db.Where("grouping = ?", g)
	}
	if f := strings.TrimSpace(c.Query("function")); f != "" {
		db = db.Where("nist_function = ?", f)
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
		logrus.Errorf("failed to count SCF risks: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF risks"})
	}

	if err := db.Order("object_id ASC").Limit(limit).Offset(offset).Find(&risks).Error; err != nil {
		logrus.Errorf("failed to list SCF risks: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF risks"})
	}

	views := make([]SCFRiskView, 0, len(risks))
	for _, r := range risks {
		views = append(views, toSCFRiskView(r))
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

// GetByID returns a single SCF risk by its object_id (e.g., R-AC-1). Response excludes raw data blob.
func (h *SCFRiskHandler) GetByID(c *fiber.Ctx) error {
	idParam, _ := url.PathUnescape(c.Params("risk_id"))
	id := strings.TrimSpace(idParam)
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing risk_id"})
	}

	var risk models.SCFRisk
	if err := h.DB.Where("object_id = ?", id).First(&risk).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "SCF risk not found"})
		}
		logrus.Errorf("failed to get SCF risk: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF risk"})
	}
	return c.JSON(toSCFRiskView(risk))
}

