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

type SCFEvidenceRequestHandler struct {
	DB *gorm.DB
}

func NewSCFEvidenceRequestHandler(db *gorm.DB) *SCFEvidenceRequestHandler {
	return &SCFEvidenceRequestHandler{DB: db}
}

// SCFEvidenceRequestView is the public shape returned by the API (excludes the raw data blob).
type SCFEvidenceRequestView struct {
	ID             uint   `json:"id"`
	ObjectID       string `json:"object_id"`
	AreaOfFocus    string `json:"area_of_focus"`
	Artifact       string `json:"artifact"`
	Description    string `json:"description"`
	ControlMapping string `json:"control_mappings"`
}

func toSCFEvidenceRequestView(m models.SCFEvidenceRequest) SCFEvidenceRequestView {
	return SCFEvidenceRequestView{
		ID:             m.ID,
		ObjectID:       m.ObjectID,
		AreaOfFocus:    m.AreaOfFocus,
		Artifact:       m.Artifact,
		Description:    m.Description,
		ControlMapping: m.ControlMappings,
	}
}

// List returns public SCF Evidence Request List entries with optional filters.
// Filters: area_of_focus, control (by SCF control id), q (search), limit, offset.
func (h *SCFEvidenceRequestHandler) List(c *fiber.Ctx) error {
	var items []models.SCFEvidenceRequest

	db := h.DB.Model(&models.SCFEvidenceRequest{})

	if aof := strings.TrimSpace(c.Query("area_of_focus")); aof != "" {
		db = db.Where("area_of_focus = ?", aof)
	}
	if control := strings.TrimSpace(c.Query("control")); control != "" {
		pattern := "%" + control + "%"
		db = db.Where("control_mappings LIKE ?", pattern)
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		db = db.Where("LOWER(object_id) LIKE ? OR LOWER(artifact) LIKE ? OR LOWER(description) LIKE ?", pattern, pattern, pattern)
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
		logrus.Errorf("failed to count SCF Evidence Request entries: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF evidence requests"})
	}

	if err := db.Order("object_id ASC").Limit(limit).Offset(offset).Find(&items).Error; err != nil {
		logrus.Errorf("failed to list SCF Evidence Request entries: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF evidence requests"})
	}

	views := make([]SCFEvidenceRequestView, 0, len(items))
	for _, it := range items {
		views = append(views, toSCFEvidenceRequestView(it))
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

// GetByID returns a single SCF Evidence Request List entry by its object_id (e.g., E-GOV-01).
func (h *SCFEvidenceRequestHandler) GetByID(c *fiber.Ctx) error {
	idParam, _ := url.PathUnescape(c.Params("erl_id"))
	id := strings.TrimSpace(idParam)
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing erl_id"})
	}

	var item models.SCFEvidenceRequest
	if err := h.DB.Where("object_id = ?", id).First(&item).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "SCF evidence request not found"})
		}
		logrus.Errorf("failed to get SCF Evidence Request entry: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF evidence request"})
	}

	return c.JSON(toSCFEvidenceRequestView(item))
}

