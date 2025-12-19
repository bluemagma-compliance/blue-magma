package handlers

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/bluemagma-compliance/blue-magma-api/models"
)

type SCFMapHandler struct{ DB *gorm.DB }

func NewSCFMapHandler(db *gorm.DB) *SCFMapHandler { return &SCFMapHandler{DB: db} }

// List returns public SCF framework mappings with filters and pagination.
// Filters: framework, external_id, scf_id, q (search across names/descriptions)
func (h *SCFMapHandler) List(c *fiber.Ctx) error {
	var rows []models.SCFFrameworkMap
	qdb := h.DB.Model(&models.SCFFrameworkMap{})

	if fw := strings.TrimSpace(c.Query("framework")); fw != "" {
		qdb = qdb.Where("framework = ?", fw)
	}
	if ext := strings.TrimSpace(c.Query("external_id")); ext != "" {
		qdb = qdb.Where("external_id = ?", ext)
	}
	if scf := strings.TrimSpace(c.Query("scf_id")); scf != "" {
		qdb = qdb.Where("scf_object_id = ?", scf)
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		qdb = qdb.Where("LOWER(external_name) LIKE ? OR LOWER(external_description) LIKE ? OR LOWER(scf_control_title) LIKE ?", pattern, pattern, pattern)
	}

	limit := 50
	if lStr := c.Query("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 500 { limit = l }
	}
	offset := 0
	if oStr := c.Query("offset"); oStr != "" {
		if o, err := strconv.Atoi(oStr); err == nil && o >= 0 { offset = o }
	}

	var total int64
	if err := qdb.Count(&total).Error; err != nil {
		logrus.Errorf("failed to count SCF maps: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF maps"})
	}

	if err := qdb.Order("framework ASC, external_id ASC, scf_object_id ASC").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		logrus.Errorf("failed to list SCF maps: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF maps"})
	}

	pages := 0
	if limit > 0 { pages = int((total + int64(limit) - 1) / int64(limit)) }

	return c.JSON(fiber.Map{
		"items":  rows,
		"total":  total,
		"pages":  pages,
		"limit":  limit,
		"offset": offset,
	})
}

