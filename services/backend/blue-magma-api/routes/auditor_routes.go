package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAuditorRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	auditorHandler := handlers.NewAuditorHandler(db)
	reportHandler := handlers.NewAuditReportHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/auditor
	auditorGroup := apiOrgGroup.Group("/project/:project_id/auditor")

	// Auditor CRUD endpoints
	auditorGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), auditorHandler.GetAuditors)
	auditorGroup.Get("/:auditor_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), auditorHandler.GetAuditor)
	auditorGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), auditorHandler.CreateAuditor)
	auditorGroup.Put("/:auditor_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), auditorHandler.UpdateAuditor)
	auditorGroup.Delete("/:auditor_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), auditorHandler.DeleteAuditor)

	// Audit Report endpoints
	auditorGroup.Get("/:auditor_id/report", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportHandler.GetAuditReports)
	auditorGroup.Get("/:auditor_id/report/:report_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportHandler.GetAuditReport)
	auditorGroup.Post("/:auditor_id/report/run", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), reportHandler.RunAudit)

	// Document-specific auditors
	documentAuditorGroup := apiOrgGroup.Group("/project/:project_id/document/:document_id/auditor")
	documentAuditorGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), auditorHandler.GetDocumentAuditors)
}
