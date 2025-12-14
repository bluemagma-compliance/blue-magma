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

type SCFAssessmentObjectiveHandler struct {
	DB *gorm.DB
}

func NewSCFAssessmentObjectiveHandler(db *gorm.DB) *SCFAssessmentObjectiveHandler {
	return &SCFAssessmentObjectiveHandler{DB: db}
}

// SCFAssessmentObjectiveView is the public shape returned by the API (excludes the raw data blob).
type SCFAssessmentObjectiveView struct {
	ID              uint   `json:"id"`
	ObjectID        string `json:"object_id"`
	ControlMappings string `json:"control_mappings"`
	Statement       string `json:"statement"`
	Origin          string `json:"origin"`
	IsSCFBaseline   bool   `json:"is_scf_baseline"`
}

func toSCFAssessmentObjectiveView(m models.SCFAssessmentObjective) SCFAssessmentObjectiveView {
	return SCFAssessmentObjectiveView{
		ID:              m.ID,
		ObjectID:        m.ObjectID,
		ControlMappings: m.ControlMappings,
		Statement:       m.Statement,
		Origin:          m.Origin,
		IsSCFBaseline:   m.IsSCFBaseline,
	}
}

// List returns public SCF Assessment Objectives with optional filters.
// Filters: control (by SCF control id), baseline (true/false), origin, q (search), limit, offset.
func (h *SCFAssessmentObjectiveHandler) List(c *fiber.Ctx) error {
	var items []models.SCFAssessmentObjective

	db := h.DB.Model(&models.SCFAssessmentObjective{})

	if control := strings.TrimSpace(c.Query("control")); control != "" {
		pattern := "%" + control + "%"
		db = db.Where("control_mappings LIKE ?", pattern)
	}

	if baselineParam := strings.TrimSpace(c.Query("baseline")); baselineParam != "" {
		v := strings.ToLower(baselineParam)
		switch v {
		case "true", "1", "yes", "y":
			db = db.Where("is_scf_baseline = ?", true)
		case "false", "0", "no", "n":
			db = db.Where("is_scf_baseline = ?", false)
		}
	}

	if origin := strings.TrimSpace(c.Query("origin")); origin != "" {
		db = db.Where("LOWER(origin) = ?", strings.ToLower(origin))
	}

	if q := strings.TrimSpace(c.Query("q")); q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		db = db.Where("LOWER(object_id) LIKE ? OR LOWER(statement) LIKE ?", pattern, pattern)
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
		logrus.Errorf("failed to count SCF Assessment Objectives: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF assessment objectives"})
	}

	if err := db.Order("object_id ASC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		logrus.Errorf("failed to list SCF Assessment Objectives: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF assessment objectives"})
	}

	views := make([]SCFAssessmentObjectiveView, 0, len(items))
	for _, it := range items {
		views = append(views, toSCFAssessmentObjectiveView(it))
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

// GetByID returns a single SCF Assessment Objective by its object_id (e.g., AAT-01_A01).
func (h *SCFAssessmentObjectiveHandler) GetByID(c *fiber.Ctx) error {
	idParam, _ := url.PathUnescape(c.Params("ao_id"))
	id := strings.TrimSpace(idParam)
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing ao_id"})
	}

	var item models.SCFAssessmentObjective
	if err := h.DB.Where("object_id = ?", id).First(&item).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "SCF assessment objective not found"})
		}
		logrus.Errorf("failed to get SCF Assessment Objective: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF assessment objective"})
	}

	return c.JSON(toSCFAssessmentObjectiveView(item))
}

