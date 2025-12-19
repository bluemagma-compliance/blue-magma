package handlers

import (
    "fmt"
    "net/url"
    "strings"

    "github.com/gofiber/fiber/v2"
    "github.com/sirupsen/logrus"
    "gorm.io/gorm"

    "github.com/bluemagma-compliance/blue-magma-api/models"
)

// SCFCoverageHandler exposes public SCF coverage utilities for frameworks and core levels.
type SCFCoverageHandler struct {
    DB *gorm.DB
}

func NewSCFCoverageHandler(db *gorm.DB) *SCFCoverageHandler { return &SCFCoverageHandler{DB: db} }

// scfSubject describes a framework or core level used in coverage calculations.
type scfSubject struct {
    Type  string `json:"type"`
    Key   string `json:"key"`
    Label string `json:"label"`
}

// subjectFromQuery parses subject_type and subject_key query params into an scfSubject.
func subjectFromQuery(prefix string, c *fiber.Ctx) (scfSubject, error) {
    st := strings.TrimSpace(strings.ToLower(c.Query(prefix + "_type")))
    skRaw := c.Query(prefix + "_key")
    skDecoded, _ := url.PathUnescape(skRaw)
    sk := strings.TrimSpace(strings.ToLower(skDecoded))

    if st == "" || sk == "" {
        return scfSubject{}, fmt.Errorf("missing %s_type or %s_key", prefix, prefix)
    }

    switch st {
    case "framework":
        switch sk {
        case "soc2":
            return scfSubject{Type: st, Key: sk, Label: "AICPA TSC / SOC 2"}, nil
        case "iso27001":
            return scfSubject{Type: st, Key: sk, Label: "ISO/IEC 27001"}, nil
        case "hipaa":
            return scfSubject{Type: st, Key: sk, Label: "US HIPAA"}, nil
        case "gdpr":
            return scfSubject{Type: st, Key: sk, Label: "EU GDPR"}, nil
        case "iso42001":
            return scfSubject{Type: st, Key: sk, Label: "ISO/IEC 42001"}, nil
        case "nist_csf":
            return scfSubject{Type: st, Key: sk, Label: "NIST Cybersecurity Framework"}, nil
        case "nist_ai_rmf":
            return scfSubject{Type: st, Key: sk, Label: "NIST AI RMF"}, nil
        default:
            return scfSubject{}, fmt.Errorf("unsupported framework key: %s", sk)
        }
    case "core_level":
        switch sk {
        case "core_lvl0":
            return scfSubject{Type: st, Key: sk, Label: "SCF CORE Level 0 Fundamentals"}, nil
        case "core_lvl1":
            return scfSubject{Type: st, Key: sk, Label: "SCF CORE Level 1 Foundational"}, nil
        case "core_lvl2":
            return scfSubject{Type: st, Key: sk, Label: "SCF CORE Level 2 Critical Infrastructure"}, nil
        case "core_ai_ops":
            return scfSubject{Type: st, Key: sk, Label: "SCF CORE AI-Enabled Operations"}, nil
        case "mcr":
            return scfSubject{Type: st, Key: sk, Label: "SCF Minimum Control Requirements (MCR)"}, nil
        case "dsr":
            return scfSubject{Type: st, Key: sk, Label: "SCF Data Security Requirements (DSR)"}, nil
        default:
            return scfSubject{}, fmt.Errorf("unsupported core level key: %s", sk)
        }
    default:
        return scfSubject{}, fmt.Errorf("unsupported subject_type: %s", st)
    }
}

// getControlsForSubject returns SCF control IDs for a given subject based on coverage flags.
func getControlsForSubject(db *gorm.DB, s scfSubject) ([]string, error) {
    var ids []string

    query := db.Model(&models.SCFControl{}).Select("object_id")

    switch s.Type {
    case "framework":
        switch s.Key {
        case "soc2":
            query = query.Where("covers_soc2 = ?", true)
        case "iso27001":
            query = query.Where("covers_iso27001 = ?", true)
        case "hipaa":
            query = query.Where("covers_hipaa = ?", true)
        case "gdpr":
            query = query.Where("covers_gdpr = ?", true)
        case "iso42001":
            query = query.Where("covers_iso42001 = ?", true)
        case "nist_csf":
            query = query.Where("covers_nist_csf = ?", true)
        case "nist_ai_rmf":
            query = query.Where("covers_nist_ai_rmf = ?", true)
        default:
            return nil, fmt.Errorf("unsupported framework key: %s", s.Key)
        }
    case "core_level":
        switch s.Key {
        case "core_lvl0":
            query = query.Where("is_core_lvl0 = ?", true)
        case "core_lvl1":
            query = query.Where("is_core_lvl1 = ?", true)
        case "core_lvl2":
            query = query.Where("is_core_lvl2 = ?", true)
        case "core_ai_ops":
            query = query.Where("is_core_ai_ops = ?", true)
        case "mcr":
            query = query.Where("is_mcr = ?", true)
        case "dsr":
            query = query.Where("is_dsr = ?", true)
        default:
            return nil, fmt.Errorf("unsupported core level key: %s", s.Key)
        }
    default:
        return nil, fmt.Errorf("unsupported subject type: %s", s.Type)
    }

    if err := query.Order("object_id ASC").Pluck("object_id", &ids).Error; err != nil {
        return nil, err
    }
    return ids, nil
}

// calculateOverlapMetrics returns intersection size and coverage percentages.
func calculateOverlapMetrics(a, b []string) (intersection int, aCoversB float64, bCoversA float64) {
    setA := make(map[string]struct{}, len(a))
    for _, id := range a {
        setA[id] = struct{}{}
    }

    setB := make(map[string]struct{}, len(b))
    for _, id := range b {
        setB[id] = struct{}{}
    }

    for id := range setA {
        if _, ok := setB[id]; ok {
            intersection++
        }
    }

    if len(b) > 0 {
        aCoversB = float64(intersection) / float64(len(b)) * 100
    }
    if len(a) > 0 {
        bCoversA = float64(intersection) / float64(len(a)) * 100
    }
    return
}

// CoverageOverlapResponse is the response shape for the overlap endpoint.
type CoverageOverlapResponse struct {
    Data struct {
        SubjectA           scfSubject `json:"subject_a"`
        SubjectB           scfSubject `json:"subject_b"`
        SubjectAControls   int        `json:"subject_a_controls"`
        SubjectBControls   int        `json:"subject_b_controls"`
        IntersectionCount  int        `json:"intersection_controls"`
        ACoversBPercent    float64    `json:"a_covers_b_percent"`
        BCoversAPercent    float64    `json:"b_covers_a_percent"`
    } `json:"data"`
    LLMSummary struct {
        SummaryText string  `json:"summary_text"`
        ACoversB    float64 `json:"a_covers_b_percent"`
        BCoversA    float64 `json:"b_covers_a_percent"`
    } `json:"llm_summary"`
}

// GetOverlap provides coverage overlap between two SCF subjects (frameworks or core levels).
func (h *SCFCoverageHandler) GetOverlap(c *fiber.Ctx) error {
    subjA, err := subjectFromQuery("subject_a", c)
    if err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
    }
    subjB, err := subjectFromQuery("subject_b", c)
    if err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
    }

    aControls, err := getControlsForSubject(h.DB, subjA)
    if err != nil {
        logrus.Errorf("failed to load controls for subject A: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load controls for subject_a"})
    }
    bControls, err := getControlsForSubject(h.DB, subjB)
    if err != nil {
        logrus.Errorf("failed to load controls for subject B: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load controls for subject_b"})
    }

    intersection, aCoversB, bCoversA := calculateOverlapMetrics(aControls, bControls)

    var resp CoverageOverlapResponse
    resp.Data.SubjectA = subjA
    resp.Data.SubjectB = subjB
    resp.Data.SubjectAControls = len(aControls)
    resp.Data.SubjectBControls = len(bControls)
    resp.Data.IntersectionCount = intersection
    resp.Data.ACoversBPercent = aCoversB
    resp.Data.BCoversAPercent = bCoversA

    resp.LLMSummary.ACoversB = aCoversB
    resp.LLMSummary.BCoversA = bCoversA
    resp.LLMSummary.SummaryText = fmt.Sprintf("%s covers %.1f%% of %s controls; %s covers %.1f%% of %s controls.", subjA.Label, aCoversB, subjB.Label, subjB.Label, bCoversA, subjA.Label)

    return c.JSON(resp)
}

// RiskThreatCoverageResponse is the response shape for risk/threat coverage.
type RiskThreatCoverageResponse struct {
    Data struct {
        Subject scfSubject `json:"subject"`

        ControlStats struct {
            SubjectControls        int     `json:"subject_controls"`
            TotalControls          int64   `json:"total_controls"`
            SubjectControlsPercent float64 `json:"subject_controls_percent_of_all"`
        } `json:"control_stats"`

        RiskCoverage struct {
            SubjectControlsWithRiskSummary int     `json:"subject_controls_with_risk_summary"`
            TotalControlsWithRiskSummary   int64   `json:"total_controls_with_risk_summary"`
            SubjectPctOfAllRiskSummaries   float64 `json:"subject_percent_of_all_risk_summaries"`
            SubjectPctWithRiskSummary      float64 `json:"subject_percent_with_risk_summary"`
            TotalRisks                     int64   `json:"total_risks"`
        } `json:"risk_coverage"`

        ThreatCoverage struct {
            SubjectControlsWithThreatSummary int     `json:"subject_controls_with_threat_summary"`
            TotalControlsWithThreatSummary   int64   `json:"total_controls_with_threat_summary"`
            SubjectPctOfAllThreatSummaries   float64 `json:"subject_percent_of_all_threat_summaries"`
            SubjectPctWithThreatSummary      float64 `json:"subject_percent_with_threat_summary"`
            TotalThreats                     int64   `json:"total_threats"`
        } `json:"threat_coverage"`
    } `json:"data"`

    LLMSummary struct {
        SummaryText string `json:"summary_text"`

        Subject scfSubject `json:"subject"`

        ControlStats struct {
            SubjectControls        int     `json:"subject_controls"`
            TotalControls          int64   `json:"total_controls"`
            SubjectControlsPercent float64 `json:"subject_controls_percent_of_all"`
        } `json:"control_stats"`

        Risk struct {
            SubjectPctWithRiskSummary    float64 `json:"subject_percent_with_risk_summary"`
            SubjectPctOfAllRiskSummaries float64 `json:"subject_percent_of_all_risk_summaries"`
        } `json:"risk"`

        Threat struct {
            SubjectPctWithThreatSummary    float64 `json:"subject_percent_with_threat_summary"`
            SubjectPctOfAllThreatSummaries float64 `json:"subject_percent_of_all_threat_summaries"`
        } `json:"threat"`
    } `json:"llm_summary"`
}

// GetRiskThreatCoverage summarizes risk/threat coverage for a single SCF subject.
func (h *SCFCoverageHandler) GetRiskThreatCoverage(c *fiber.Ctx) error {
    subj, err := subjectFromQuery("subject", c)
    if err != nil {
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
    }

    // Total controls
    var totalControls int64
    if err := h.DB.Model(&models.SCFControl{}).Count(&totalControls).Error; err != nil {
        logrus.Errorf("failed to count SCF controls: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF controls"})
    }

    // Subject controls (IDs and summaries)
    var controls []models.SCFControl
    query := h.DB.Model(&models.SCFControl{})

    switch subj.Type {
    case "framework":
        switch subj.Key {
        case "soc2":
            query = query.Where("covers_soc2 = ?", true)
        case "iso27001":
            query = query.Where("covers_iso27001 = ?", true)
        case "hipaa":
            query = query.Where("covers_hipaa = ?", true)
        case "gdpr":
            query = query.Where("covers_gdpr = ?", true)
        case "iso42001":
            query = query.Where("covers_iso42001 = ?", true)
        case "nist_csf":
            query = query.Where("covers_nist_csf = ?", true)
        case "nist_ai_rmf":
            query = query.Where("covers_nist_ai_rmf = ?", true)
        default:
            return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unsupported framework key"})
        }
    case "core_level":
        switch subj.Key {
        case "core_lvl0":
            query = query.Where("is_core_lvl0 = ?", true)
        case "core_lvl1":
            query = query.Where("is_core_lvl1 = ?", true)
        case "core_lvl2":
            query = query.Where("is_core_lvl2 = ?", true)
        case "core_ai_ops":
            query = query.Where("is_core_ai_ops = ?", true)
        case "mcr":
            query = query.Where("is_mcr = ?", true)
        case "dsr":
            query = query.Where("is_dsr = ?", true)
        default:
            return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unsupported core level key"})
        }
    default:
        return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "unsupported subject_type"})
    }

    if err := query.Order("object_id ASC").Find(&controls).Error; err != nil {
        logrus.Errorf("failed to load subject controls: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to load subject controls"})
    }

    subjectCount := len(controls)

    // Count risk/threat summaries for subject controls and globally.
    var totalWithRiskSummary int64
    var totalWithThreatSummary int64
    if err := h.DB.Model(&models.SCFControl{}).
        Where("risk_threat_summary IS NOT NULL AND TRIM(risk_threat_summary) != ''").
        Count(&totalWithRiskSummary).Error; err != nil {
        logrus.Errorf("failed to count risk summaries: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count risk summaries"})
    }
    if err := h.DB.Model(&models.SCFControl{}).
        Where("control_threat_summary IS NOT NULL AND TRIM(control_threat_summary) != ''").
        Count(&totalWithThreatSummary).Error; err != nil {
        logrus.Errorf("failed to count threat summaries: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count threat summaries"})
    }

    subjectWithRiskSummary := 0
    subjectWithThreatSummary := 0
    for _, ctl := range controls {
        if strings.TrimSpace(ctl.RiskThreatSummary) != "" {
            subjectWithRiskSummary++
        }
        if strings.TrimSpace(ctl.ControlThreatSummary) != "" {
            subjectWithThreatSummary++
        }
    }

    // Total risks and threats in catalogs.
    var totalRisks int64
    var totalThreats int64
    if err := h.DB.Model(&models.SCFRisk{}).Count(&totalRisks).Error; err != nil {
        logrus.Errorf("failed to count SCF risks: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF risks"})
    }
    if err := h.DB.Model(&models.SCFThreat{}).Count(&totalThreats).Error; err != nil {
        logrus.Errorf("failed to count SCF threats: %v", err)
        return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to count SCF threats"})
    }

    var resp RiskThreatCoverageResponse
    resp.Data.Subject = subj

    resp.Data.ControlStats.SubjectControls = subjectCount
    resp.Data.ControlStats.TotalControls = totalControls
    if totalControls > 0 {
        resp.Data.ControlStats.SubjectControlsPercent = float64(subjectCount) / float64(totalControls) * 100
    }

    resp.Data.RiskCoverage.SubjectControlsWithRiskSummary = subjectWithRiskSummary
    resp.Data.RiskCoverage.TotalControlsWithRiskSummary = totalWithRiskSummary
    resp.Data.RiskCoverage.TotalRisks = totalRisks
    if totalWithRiskSummary > 0 {
        resp.Data.RiskCoverage.SubjectPctOfAllRiskSummaries = float64(subjectWithRiskSummary) / float64(totalWithRiskSummary) * 100
    }
    if subjectCount > 0 {
        resp.Data.RiskCoverage.SubjectPctWithRiskSummary = float64(subjectWithRiskSummary) / float64(subjectCount) * 100
    }

    resp.Data.ThreatCoverage.SubjectControlsWithThreatSummary = subjectWithThreatSummary
    resp.Data.ThreatCoverage.TotalControlsWithThreatSummary = totalWithThreatSummary
    resp.Data.ThreatCoverage.TotalThreats = totalThreats
    if totalWithThreatSummary > 0 {
        resp.Data.ThreatCoverage.SubjectPctOfAllThreatSummaries = float64(subjectWithThreatSummary) / float64(totalWithThreatSummary) * 100
    }
    if subjectCount > 0 {
        resp.Data.ThreatCoverage.SubjectPctWithThreatSummary = float64(subjectWithThreatSummary) / float64(subjectCount) * 100
    }

    // llm_summary (no large lists)
    resp.LLMSummary.Subject = subj
    resp.LLMSummary.ControlStats = resp.Data.ControlStats
    resp.LLMSummary.Risk.SubjectPctWithRiskSummary = resp.Data.RiskCoverage.SubjectPctWithRiskSummary
    resp.LLMSummary.Risk.SubjectPctOfAllRiskSummaries = resp.Data.RiskCoverage.SubjectPctOfAllRiskSummaries
    resp.LLMSummary.Threat.SubjectPctWithThreatSummary = resp.Data.ThreatCoverage.SubjectPctWithThreatSummary
    resp.LLMSummary.Threat.SubjectPctOfAllThreatSummaries = resp.Data.ThreatCoverage.SubjectPctOfAllThreatSummaries

    resp.LLMSummary.SummaryText = fmt.Sprintf(
        "%s uses %d controls (%.1f%% of all SCF controls). %.1f%% of its controls have explicit risk summaries covering %.1f%% of all SCF risk-summarized controls; %.1f%% of its controls have explicit threat summaries covering %.1f%% of all SCF threat-summarized controls.",
        subj.Label,
        resp.LLMSummary.ControlStats.SubjectControls,
        resp.LLMSummary.ControlStats.SubjectControlsPercent,
        resp.LLMSummary.Risk.SubjectPctWithRiskSummary,
        resp.LLMSummary.Risk.SubjectPctOfAllRiskSummaries,
        resp.LLMSummary.Threat.SubjectPctWithThreatSummary,
        resp.LLMSummary.Threat.SubjectPctOfAllThreatSummaries,
    )

    return c.JSON(resp)
}

