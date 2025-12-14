package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

// These routes are for the rules API endpoints. /api/v1/org/{org_id}/...
func RegisterRuleRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	ruleHandler := handlers.NewRuleHandler(db)
	ruleGroup := apiOrgGroup.Group("/rule")

	ruleGroup.Get("/:rule_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), ruleHandler.GetRule)
	ruleGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), ruleHandler.GetRules)
	ruleGroup.Post("/", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), ruleHandler.CreateRule)
	ruleGroup.Put("/:rule_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), ruleHandler.UpdateRule)
	ruleGroup.Delete("/:rule_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), ruleHandler.DeleteRule)
}

// These routes are for the services API endpoints. /api/v1/org/{org_id}/...
func RegisterCodebaseRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	codebaseHandler := handlers.NewCodebaseHandler(db)
	serviceGroup := apiOrgGroup.Group("/codebase")

	serviceGroup.Get("/:service_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), codebaseHandler.GetCodebase)
	serviceGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), codebaseHandler.GetCodebases)
	serviceGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), codebaseHandler.CreateCodebase)
	serviceGroup.Put("/:service_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), codebaseHandler.UpdateCodebase)
	serviceGroup.Delete("/:service_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), codebaseHandler.DeleteCodebase)
}

// These routes are for the service versions API endpoints. /api/v1/org/{org_id}/...
func RegisterCodebaseVersionRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	codebaseVersionHandler := handlers.NewCodebaseVersionHandler(db)
	serviceVersionGroup := apiOrgGroup.Group("/codebase_version")

	serviceVersionGroup.Get("/:codebase_version_id/actionable_items", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), codebaseVersionHandler.GetCodebaseVersionActionableItems)
	serviceVersionGroup.Get("/:service_version_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), codebaseVersionHandler.GetCodebaseVersion)
	serviceVersionGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), codebaseVersionHandler.CreateCodebaseVersion)
	serviceVersionGroup.Delete("/:service_version_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), codebaseVersionHandler.DeleteCodebaseVersion)
	serviceVersionGroup.Put("/:service_version_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), codebaseVersionHandler.UpdateCodebaseVersion)
}

// These routes are for the rulings API endpoints. /api/v1/org/{org_id}/...
func RegisterRulingRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	rulingHandler := handlers.NewRulingHandler(db)
	rulingGroup := apiOrgGroup.Group("/ruling")

	rulingGroup.Get("/:ruling_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), rulingHandler.GetRuling)
	rulingGroup.Post("/", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), rulingHandler.CreateRuling)
	rulingGroup.Put("/:ruling_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), rulingHandler.UpdateRuling)
	rulingGroup.Delete("/:ruling_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), rulingHandler.DeleteRuling)
}

func RegisterRPCRoutes(apiOrgGroup *fiber.Group, db *gorm.DB, redis *redis.Client) {
	rpcHandler := handlers.NewRPCHandler(db, redis)
	rpcGroup := apiOrgGroup.Group("/rpc")
	rpcGroup.Post("/initiate-code-scan-report", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), rpcHandler.InitiateCodeScanReport)
	rpcGroup.Post("/generate-report", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), rpcHandler.GenerateReport)
	rpcGroup.Post("/generate-docs", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), rpcHandler.GenerateDocs)
	rpcGroup.Post("/ask-seeker-agent", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), rpcHandler.AskSeekerAgent)
	rpcGroup.Post("/get-last-commit-hash", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), rpcHandler.GetLastCommitHash)
	rpcGroup.Get("/initialize-chat/:user_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), rpcHandler.InitializeChat)

	// Comprehensive report generation endpoints
	rpcGroup.Get("/report-progress/:report_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), rpcHandler.GetReportProgress)
	rpcGroup.Get("/cache-stats/:report_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), rpcHandler.GetCacheStats)
	rpcGroup.Post("/cancel-report/:report_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), rpcHandler.CancelReport)
}

// These routes are for the API keys API endpoints. /api/v1/org/{org_id}/...
func RegisterAPIKeyRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	apiKeyHandler := handlers.NewAPIKeyHandler(db)
	apiKeyGroup := apiOrgGroup.Group("/api_key")

	apiKeyGroup.Get("/:api_key_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), apiKeyHandler.GetAPIKey)
	apiKeyGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), apiKeyHandler.CreateAPIKey)
	apiKeyGroup.Put("/:api_key_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), apiKeyHandler.UpdateAPIKey)
	apiKeyGroup.Delete("/:api_key_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), apiKeyHandler.DeleteAPIKey)

}

// These routes are for the questions API endpoints. /api/v1/org/{org_id}/...
func RegisterQuestionRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	questionHandler := handlers.NewQuestionHandler(db)
	questionGroup := apiOrgGroup.Group("/question")

	questionGroup.Get("/:question_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), questionHandler.GetQuestion)
	questionGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), questionHandler.CreateQuestion)
	questionGroup.Put("/:question_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), questionHandler.UpdateQuestion)
	questionGroup.Delete("/:question_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), questionHandler.DeleteQuestion)
	questionGroup.Post("/many", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), questionHandler.CreateManyQuestions)
}

// RegisterPropertyRoutes registers the routes for the CodebaseVersionProperty API endpoints.
func RegisterPropertyRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	propertyHandler := handlers.NewPropertyHandler(db)
	propertyGroup := apiOrgGroup.Group("/property")

	propertyGroup.Get("/code/:property_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), propertyHandler.GetProperty)
	propertyGroup.Get("/code/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), propertyHandler.GetProperties)
	propertyGroup.Post("/code/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), propertyHandler.CreateProperty)
	propertyGroup.Put("/code/:property_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), propertyHandler.EditProperty)
	propertyGroup.Delete("/code/:property_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), propertyHandler.DeleteProperty)
}

// Register subject type routes
func RegisterSubjectTypeRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	subjectTypeHandler := handlers.NewSubjectTypeHandler(db)
	subjectTypeGroup := apiOrgGroup.Group("/subject-types")

	subjectTypeGroup.Get("/", middleware.RequireRole("user"), subjectTypeHandler.GetAllSubjectTypes)

}

func RegisterFoundPropertyRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	foundPropertyHandler := handlers.NewFoundPropertiesHandler(db)
	foundPropertyGroup := apiOrgGroup.Group("/found-property")

	foundPropertyGroup.Get("/:object_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), foundPropertyHandler.GetFoundProperty)
	foundPropertyGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), foundPropertyHandler.CreateFoundProperty)
	foundPropertyGroup.Put("/:object_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), foundPropertyHandler.UpdateFoundProperty)
	foundPropertyGroup.Delete("/:object_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), foundPropertyHandler.DeleteFoundProperty)
	foundPropertyGroup.Post("/many", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), foundPropertyHandler.CreateManyFoundProperties)
}

func RegisterTemplateSectionRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	templateSectionHandler := handlers.NewTemplateSectionHandler(db)
	templateSectionGroup := apiOrgGroup.Group("/template-section")

	templateSectionGroup.Post("/", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), templateSectionHandler.CreateTemplateSection)
	templateSectionGroup.Put("/:section_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), templateSectionHandler.EditTemplateSection)
	templateSectionGroup.Delete("/:section_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), templateSectionHandler.DeleteTemplateSection)
}

func RegisterReportTemplateRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	reportTemplateHandler := handlers.NewReportTemplateHandler(db)
	reportTemplateGroup := apiOrgGroup.Group("/report-template")

	reportTemplateGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportTemplateHandler.GetReportTemplates)
	reportTemplateGroup.Get("/:report_template_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportTemplateHandler.GetReportTemplate)
	reportTemplateGroup.Post("/", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), reportTemplateHandler.CreateReportTemplate)
	reportTemplateGroup.Put("/:report_template_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), reportTemplateHandler.UpdateReportTemplate)
	reportTemplateGroup.Delete("/:report_template_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), reportTemplateHandler.DeleteReportTemplate)
}

func RegisterReportSectionRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	reportSectionHandler := handlers.NewReportSectionHandler(db)
	reportSectionGroup := apiOrgGroup.Group("/report-section")

	reportSectionGroup.Get("/:section_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportSectionHandler.GetReportSection)
	reportSectionGroup.Post("/", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), reportSectionHandler.CreateReportSection)
	reportSectionGroup.Put("/:section_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), reportSectionHandler.UpdateReportSection)
	reportSectionGroup.Delete("/:section_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), reportSectionHandler.DeleteReportSection)
}

// RegisterReportRoutes registers the routes for the report API endpoints.
func RegisterReportRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	reportHandler := handlers.NewReportHandler(db)
	reportGroup := apiOrgGroup.Group("/report")

	reportGroup.Get("/:report_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportHandler.GetReport)
	reportGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportHandler.GetAllReports)
	reportGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), reportHandler.CreateReport)
	reportGroup.Put("/:report_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), reportHandler.UpdateReport)
	reportGroup.Delete("/:report_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), reportHandler.DeleteReport)

	// Summary endpoints
	reportGroup.Get("/:report_id/summary", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), reportHandler.GetReportSummary)
	reportGroup.Post("/:report_id/regenerate-summary", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), reportHandler.RegenerateSummary)
}

// RegisterComplianceTemplateRoutes registers the routes for the compliance template API endpoints.
func RegisterComplianceTemplateRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	complianceTemplateHandler := handlers.NewComplianceTemplateHandler(db)
	complianceTemplateGroup := apiOrgGroup.Group("/compliance-template")

	complianceTemplateGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), complianceTemplateHandler.GetComplianceTemplates)
	complianceTemplateGroup.Get("/:template_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), complianceTemplateHandler.GetComplianceTemplate)
	complianceTemplateGroup.Get("/:template_id/export", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), complianceTemplateHandler.ExportComplianceTemplate)
	complianceTemplateGroup.Post("/import", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), complianceTemplateHandler.CreateFromJSON)
	complianceTemplateGroup.Delete("/:template_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), complianceTemplateHandler.DeleteComplianceTemplate)
}

// RegisterActionableItemRoutes registers the routes for actionable item management
func RegisterActionableItemRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	actionableItemHandler := handlers.NewActionableItemHandler(db)
	actionableItemGroup := apiOrgGroup.Group("/actionable-item")

	actionableItemGroup.Get("/:item_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), actionableItemHandler.GetActionableItem)
	actionableItemGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), actionableItemHandler.GetActionableItems)
	actionableItemGroup.Get("/report/:report_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), actionableItemHandler.GetActionableItemsByReport)
	actionableItemGroup.Post("/", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), actionableItemHandler.CreateActionableItem)
	actionableItemGroup.Put("/:item_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), actionableItemHandler.UpdateActionableItem)
	actionableItemGroup.Delete("/:item_id", middleware.RequireRole("legal"), middleware.RestOrgCheckMiddleware(db), actionableItemHandler.DeleteActionableItem)
}

// RegisterUserRoutes registers the routes for user management
func RegisterUserRoutes(apiGroup *fiber.Group, db *gorm.DB) {
	userHandler := handlers.NewUserHandler(db)

	// User routes - note these are at /api/v1/users level
	apiGroup.Get("/users/me", middleware.RequireRole("user"), userHandler.GetCurrentUser)
	apiGroup.Patch("/users/me/chat-memory", middleware.RequireRole("user"), userHandler.UpdateCurrentUserChatMemory)
}

// RegisterOrganizationRoutes registers the routes for organization management
func RegisterOrganizationRoutes(apiGroup *fiber.Group, db *gorm.DB) {
	organizationHandler := handlers.NewOrganizationHandler(db)

	// Organization routes - note these are at /api/v1/org/{org_id} level, not nested
	apiGroup.Get("/org/:org_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), organizationHandler.GetOrganization)
	apiGroup.Put("/org/:org_id", middleware.RequireRole("owner"), middleware.RestOrgCheckMiddleware(db), organizationHandler.UpdateOrganization)
	apiGroup.Patch("/org/:org_id", middleware.RequireRole("owner"), middleware.RestOrgCheckMiddleware(db), organizationHandler.PatchOrganization)
	apiGroup.Patch("/org/:org_id/credits", middleware.RequireRole("owner"), middleware.RestOrgCheckMiddleware(db), organizationHandler.UpdateOrganizationCredits)
	apiGroup.Patch("/org/:org_id/credits/add", middleware.RequireRole("owner"), middleware.RestOrgCheckMiddleware(db), organizationHandler.AddOrganizationCredits)
	apiGroup.Patch("/org/:org_id/credits/subtract", middleware.RequireRole("owner"), middleware.RestOrgCheckMiddleware(db), organizationHandler.SubtractOrganizationCredits)
	apiGroup.Delete("/org/:org_id", middleware.RequireRole("owner"), middleware.RestOrgCheckMiddleware(db), organizationHandler.DeleteOrganization)
}

func RegisterAwsIntegrationRoutes(apiOrgGroup *fiber.Group) {
	group := apiOrgGroup.Group("/aws")
	group.Post("/installations", middleware.RequireRole("owner"), middleware.AwsIntegrationProxy)
	group.Patch("/installations", middleware.RequireRole("owner"), middleware.AwsIntegrationProxy)
	group.Delete("/installations", middleware.RequireRole("owner"), middleware.AwsIntegrationProxy)
	group.Get("/installations", middleware.RequireRole("user"), middleware.AwsIntegrationProxy)
	group.Post("/data/sync", middleware.RequireRole("user"), middleware.AwsIntegrationProxy)
	// NOTE: data getter endpoint is not proxied due to sensitivity of AWS data
	// group.Get("/data", middleware.RequireRole("user"), middleware.AwsIntegrationProxy)
}
