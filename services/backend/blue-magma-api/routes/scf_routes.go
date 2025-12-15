package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterSCFRoutes registers public, unauthenticated routes for serving SCF controls, mappings and risks.
// These should be registered BEFORE auth middleware is applied to /api/v1.
func RegisterSCFRoutes(app *fiber.App, db *gorm.DB) {
	h := handlers.NewSCFHandler(db)
	mh := handlers.NewSCFMapHandler(db)
	rh := handlers.NewSCFRiskHandler(db)
	th := handlers.NewSCFThreatHandler(db)
	erh := handlers.NewSCFEvidenceRequestHandler(db)
	aoh := handlers.NewSCFAssessmentObjectiveHandler(db)
	ch := handlers.NewSCFCoverageHandler(db)

	app.Get("/api/v1/public/frameworks/scf", h.List)
	app.Get("/api/v1/public/frameworks/scf/maps", mh.List)
	app.Get("/api/v1/public/frameworks/scf/risks", rh.List)
	app.Get("/api/v1/public/frameworks/scf/risks/:risk_id", rh.GetByID)
	app.Get("/api/v1/public/frameworks/scf/threats", th.List)
	app.Get("/api/v1/public/frameworks/scf/threats/:threat_id", th.GetByID)
	app.Get("/api/v1/public/frameworks/scf/evidence-requests", erh.List)
	app.Get("/api/v1/public/frameworks/scf/evidence-requests/:erl_id", erh.GetByID)
	app.Get("/api/v1/public/frameworks/scf/assessment-objectives", aoh.List)
	app.Get("/api/v1/public/frameworks/scf/assessment-objectives/:ao_id", aoh.GetByID)

	// Coverage utilities
	app.Get("/api/v1/public/frameworks/scf/coverage/overlap", ch.GetOverlap)
	app.Get("/api/v1/public/frameworks/scf/coverage/risks-threats", ch.GetRiskThreatCoverage)

	app.Get("/api/v1/public/frameworks/scf/:scf_id", h.GetByID)
}
