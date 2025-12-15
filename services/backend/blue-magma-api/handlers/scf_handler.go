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

type SCFHandler struct {
	DB *gorm.DB
}

func NewSCFHandler(db *gorm.DB) *SCFHandler { return &SCFHandler{DB: db} }


// SCFControlView is the public shape returned by the API (excludes the raw data blob).
type SCFControlView struct {
	ID                   uint   `json:"id"`
	ObjectID             string `json:"object_id"`
	Domain               string `json:"domain"`
	Title                string `json:"title"`
	Cadence              string `json:"cadence"`
	Weight               int    `json:"weight"`

	CoversHIPAA          bool   `json:"covers_hipaa"`
	CoversSOC2           bool   `json:"covers_soc2"`
	CoversGDPR           bool   `json:"covers_gdpr"`
	CoversISO27001       bool   `json:"covers_iso27001"`
	CoversISO42001       bool   `json:"covers_iso42001"`
	CoversNISTCSF        bool   `json:"covers_nist_csf"`
	CoversNISTAIRMF      bool   `json:"covers_nist_ai_rmf"`

	IsCoreLvl0           bool   `json:"is_core_lvl0"`
	IsCoreLvl1           bool   `json:"is_core_lvl1"`
	IsCoreLvl2           bool   `json:"is_core_lvl2"`
	IsCoreAIOps          bool   `json:"is_core_ai_ops"`

	IsMCR                bool   `json:"is_mcr"`
	IsDSR                bool   `json:"is_dsr"`

	RiskThreatSummary    string `json:"risk_threat_summary"`
	ControlThreatSummary string `json:"control_threat_summary"`

	ControlDescription   string `json:"control_description"`
	MicroSmallSolutions  string `json:"micro_small_solutions"`
}

func toSCFView(m models.SCFControl) SCFControlView {
	return SCFControlView{
		ID:                   m.ID,
		ObjectID:             m.ObjectID,
		Domain:               m.Domain,
		Title:                m.Title,
		Cadence:              m.Cadence,
		Weight:               m.Weight,
		CoversHIPAA:          m.CoversHIPAA,
		CoversSOC2:           m.CoversSOC2,
		CoversGDPR:           m.CoversGDPR,
		CoversISO27001:       m.CoversISO27001,
		CoversISO42001:       m.CoversISO42001,
		CoversNISTCSF:        m.CoversNISTCSF,
		CoversNISTAIRMF:      m.CoversNISTAIRMF,
		IsCoreLvl0:           m.IsCoreLvl0,
		IsCoreLvl1:           m.IsCoreLvl1,
		IsCoreLvl2:           m.IsCoreLvl2,
		IsCoreAIOps:          m.IsCoreAIOps,
		IsMCR:                m.IsMCR,
		IsDSR:                m.IsDSR,
		RiskThreatSummary:    m.RiskThreatSummary,
		ControlThreatSummary: m.ControlThreatSummary,
		ControlDescription:   m.ControlDescription,
		MicroSmallSolutions:  m.MicroSmallSolutions,
	}
}

// List returns public SCF controls with optional filters: domain, cadence, q (search), limit, offset.
// Response now includes pagination metadata: items, total, pages, limit, offset.
func (h *SCFHandler) List(c *fiber.Ctx) error {
	var controls []models.SCFControl

	db := h.DB.Model(&models.SCFControl{})

	if d := strings.TrimSpace(c.Query("domain")); d != "" {
		db = db.Where("domain = ?", d)
	}
	if cad := strings.TrimSpace(c.Query("cadence")); cad != "" {
		db = db.Where("cadence = ?", cad)
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		db = db.Where("LOWER(title) LIKE ? OR LOWER(domain) LIKE ? OR LOWER(object_id) LIKE ?", pattern, pattern, pattern)
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

	// Count total BEFORE pagination
	var total int64
	if err := db.Count(&total).Error; err != nil {
		logrus.Errorf("failed to count SCF controls: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF controls"})
	}

	if err := db.Order("object_id ASC").Limit(limit).Offset(offset).Find(&controls).Error; err != nil {
		logrus.Errorf("failed to list SCF controls: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF controls"})
	}

	// Map to public view (exclude raw data)
	views := make([]SCFControlView, 0, len(controls))
	for _, m := range controls {
		views = append(views, toSCFView(m))
	}

	// Compute total pages (ceil)
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

// GetByID returns a single SCF control by its object_id (e.g., GOV-01). Response excludes raw data blob.
func (h *SCFHandler) GetByID(c *fiber.Ctx) error {
	idParam, _ := url.PathUnescape(c.Params("scf_id"))
	id := strings.TrimSpace(idParam)
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing scf_id"})
	}

	var control models.SCFControl
	if err := h.DB.Where("object_id = ?", id).First(&control).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "SCF control not found"})
		}
		logrus.Errorf("failed to get SCF control: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to fetch SCF control"})
	}
	return c.JSON(toSCFView(control))
}

