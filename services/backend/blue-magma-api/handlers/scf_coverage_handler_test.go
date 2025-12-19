package handlers

import (
    "encoding/json"
    "net/http"
    "testing"

    "github.com/bluemagma-compliance/blue-magma-api/models"
    "github.com/gofiber/fiber/v2"
    "github.com/stretchr/testify/assert"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

func setupSCFCoverageTestEnv(t *testing.T) (*gorm.DB, *SCFCoverageHandler, *fiber.App) {
    t.Helper()

    db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
    if err != nil {
        t.Fatalf("failed to open test database: %v", err)
    }

    if err := db.AutoMigrate(&models.SCFControl{}, &models.SCFRisk{}, &models.SCFThreat{}); err != nil {
        t.Fatalf("failed to migrate models: %v", err)
    }

    handler := NewSCFCoverageHandler(db)
    app := fiber.New()

    app.Get("/api/v1/public/frameworks/scf/coverage/overlap", handler.GetOverlap)
    app.Get("/api/v1/public/frameworks/scf/coverage/risks-threats", handler.GetRiskThreatCoverage)

    return db, handler, app
}

func TestSCFCoverageOverlap(t *testing.T) {
    db, _, app := setupSCFCoverageTestEnv(t)

    // Seed a few controls with SOC2 and ISO27001 overlap
    controls := []models.SCFControl{
        {ObjectID: "GOV-01", CoversSOC2: true, CoversISO27001: true},
        {ObjectID: "GOV-02", CoversSOC2: true},
        {ObjectID: "GOV-03", CoversISO27001: true},
    }
    for _, c := range controls {
        assert.NoError(t, db.Create(&c).Error)
    }

    req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/coverage/overlap?subject_a_type=framework&subject_a_key=soc2&subject_b_type=framework&subject_b_key=iso27001", nil)
    resp, err := app.Test(req)
    assert.NoError(t, err)
    assert.Equal(t, fiber.StatusOK, resp.StatusCode)

    var payload CoverageOverlapResponse
    assert.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))

    assert.Equal(t, 2, payload.Data.SubjectAControls) // GOV-01, GOV-02
    assert.Equal(t, 2, payload.Data.SubjectBControls) // GOV-01, GOV-03
    assert.Equal(t, 1, payload.Data.IntersectionCount)
    assert.InDelta(t, 50.0, payload.Data.ACoversBPercent, 0.01) // 1 of 2 ISO controls
    assert.InDelta(t, 50.0, payload.Data.BCoversAPercent, 0.01) // 1 of 2 SOC2 controls

    assert.NotEmpty(t, payload.LLMSummary.SummaryText)
}

func TestSCFRiskThreatCoverage(t *testing.T) {
    db, _, app := setupSCFCoverageTestEnv(t)

    // Seed controls with SOC2 coverage and risk/threat summaries
    controls := []models.SCFControl{
        {ObjectID: "GOV-01", CoversSOC2: true, RiskThreatSummary: "Risk A", ControlThreatSummary: "Threat A"},
        {ObjectID: "GOV-02", CoversSOC2: true, RiskThreatSummary: "Risk B"},
        {ObjectID: "GOV-03", CoversISO27001: true, RiskThreatSummary: "Risk C", ControlThreatSummary: "Threat C"},
    }
    for _, c := range controls {
        assert.NoError(t, db.Create(&c).Error)
    }

    // Seed some risks and threats (counts only used)
    risks := []models.SCFRisk{{ObjectID: "R-1"}, {ObjectID: "R-2"}}
    for _, r := range risks {
        assert.NoError(t, db.Create(&r).Error)
    }
    threats := []models.SCFThreat{{ObjectID: "T-1"}}
    for _, th := range threats {
        assert.NoError(t, db.Create(&th).Error)
    }

    req, _ := http.NewRequest("GET", "/api/v1/public/frameworks/scf/coverage/risks-threats?subject_type=framework&subject_key=soc2", nil)
    resp, err := app.Test(req)
    assert.NoError(t, err)
    assert.Equal(t, fiber.StatusOK, resp.StatusCode)

    var payload RiskThreatCoverageResponse
    assert.NoError(t, json.NewDecoder(resp.Body).Decode(&payload))

    // SOC2 uses 2 controls here
    assert.Equal(t, 2, payload.Data.ControlStats.SubjectControls)
    // Of those, GOV-01 and GOV-02 have risk summaries (2)
    assert.Equal(t, 2, payload.Data.RiskCoverage.SubjectControlsWithRiskSummary)
    // Only GOV-01 has a threat summary
    assert.Equal(t, 1, payload.Data.ThreatCoverage.SubjectControlsWithThreatSummary)

    assert.EqualValues(t, 3, payload.Data.ControlStats.TotalControls)
    assert.EqualValues(t, 2, payload.Data.RiskCoverage.TotalRisks)
    assert.EqualValues(t, 1, payload.Data.ThreatCoverage.TotalThreats)

    assert.NotEmpty(t, payload.LLMSummary.SummaryText)
}

