// @title Bluemagma API
// @version 1.0
// @description API for blue magma auth and data
// @host localhost:80
// @BasePath /
// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and your JWT token
package main

import (
	"context"
	"os"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/authz"
	"github.com/bluemagma-compliance/blue-magma-api/database"
	defaultdata "github.com/bluemagma-compliance/blue-magma-api/default-data"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/bluemagma-compliance/blue-magma-api/observability"
	rediscache "github.com/bluemagma-compliance/blue-magma-api/redis_cache"
	"github.com/bluemagma-compliance/blue-magma-api/routes"

	_ "github.com/bluemagma-compliance/blue-magma-api/docs" // import the docs package for Swagger
	fiberSwagger "github.com/swaggo/fiber-swagger"

	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
)

func configureLogging() {
	level := strings.ToLower(os.Getenv("LOG_LEVEL"))
	switch level {
	case "debug":
		log.SetLevel(log.DebugLevel)
	case "info":
		log.SetLevel(log.InfoLevel)
	case "warn":
		log.SetLevel(log.WarnLevel)
	case "error":
		log.SetLevel(log.ErrorLevel)
	case "fatal":
		log.SetLevel(log.FatalLevel)
	default:
		log.SetLevel(log.InfoLevel)
	}

	log.SetFormatter(&log.TextFormatter{
		FullTimestamp: true,
	})

	log.Infof("Log level set to %s", level)
}

var requiredEnvVars = []string{
	"DB_HOST",
	"DB_USER",
	"DB_PASSWORD",
	"DB_NAME",
	"DB_PORT",
	"DB_SSLMODE",
	"LOG_LEVEL",
	"INTERNAL_API_KEY",
	"ENCRYPTION_KEY",
	"GITHUB_INTEGRATION_URL",
	"JWT_SECRET",
	"JWT_REFRESH_SECRET",
	"SEED_DEFAULT_DATA",
	"REDIS_HOST",
	"REDIS_PORT",
	"REDIS_PASSWORD",
	"MAILGUN_API_KEY",
	"MAILGUN_DOMAIN",
	"GITHUB_APP_ID",
	"GITHUB_APP_PRIVATE_KEY",
	"GITHUB_WEBHOOK_SECRET",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
	"GITHUB_APP_SLUG",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"FRONTEND_URL",
}

func checkEnvVars(vars []string) {
	missing := []string{}
	for _, v := range vars {
		if os.Getenv(v) == "" {
			missing = append(missing, v)
		}
	}
	if len(missing) > 0 {
		log.Error("Missing required environment variables: ", missing)
		os.Exit(1)
	} else {
		log.Info("✅ All required environment variables are set")
	}
}

func main() {
	app := fiber.New()

	// Instrument HTTP server with OpenTelemetry (traces per request).
	observability.InstrumentFiber(app)

	// Check required environment variables
	checkEnvVars(requiredEnvVars)

	// Configure logging
	configureLogging()

	// Initialize vendor-neutral observability (OpenTelemetry).
	ctx := context.Background()
	shutdown, err := observability.Init(ctx)
	if err != nil {
		log.WithError(err).Warn("failed to initialize OpenTelemetry; continuing without tracing exporter")
	} else {
		defer func() {
			if err := shutdown(ctx); err != nil {
				log.WithError(err).Warn("error shutting down OpenTelemetry provider")
			}
		}()
	}

	// Connect to DB
	database.Connect()

	database.DB.Exec("CREATE EXTENSION IF NOT EXISTS vector")

	// Migrate models
	database.DB.AutoMigrate(
		&models.Organization{},
		&models.User{},
		&models.Role{},
		&models.UserRole{},
		&authz.AuditEvent{}, // Add audit event table
		&models.ReportTemplate{},
		&models.TemplateSection{},
		&models.Report{},
		&models.ReportSection{},
		&models.Rule{},
		&models.SubjectType{},
		&models.Codebase{},
		&models.CodebaseVersion{},
		&models.Ruling{},
		&models.Question{},
		&models.CodebaseVersionProperty{},
		&models.APIKey{},
		&models.FoundProperty{},
		&models.ActionableItem{}, // Add actionable item table
		&models.GithubInstallation{},
		&models.GithubRepository{},
		&models.GithubWebhookDelivery{},
		&models.Project{},                // Add project table
		&models.DocumentationTemplate{},  // Add documentation template table
		&models.ProjectTemplate{},        // Add project template table
		&models.PolicyTemplate{},         // Add policy template table
		&models.Auditor{},                // Add auditor table
		&models.AuditReport{},            // Add audit report table
		&models.Agent{},                  // Add agent table
		&models.Document{},               // Add document table (must be before Evidence)
		&models.DocumentRelation{},       // Add document relation table
		&models.Collection{},             // Add collection table (must be before Evidence)
		&models.Evidence{},               // Add evidence table (must be before EvidenceRequest due to FK)
		&models.EvidenceRequest{},        // Add evidence request table (has FK to Evidence)
		&models.ProjectTask{},            // Add project task table
		&models.SCFControl{},             // Add SCF control table
		&models.SCFFrameworkMap{},        // Add SCF framework mapping table
		&models.SCFRisk{},                // Add SCF risk table
		&models.SCFThreat{},              // Add SCF threat table
		&models.SCFEvidenceRequest{},     // Add SCF evidence request catalog table
		&models.SCFAssessmentObjective{}, // Add SCF assessment objective catalog table
		&models.PublicVisitor{},          // Add public visitor tracking table
		&models.SuperAdmin{},             // Add super admin table

	)

	log.Info("✅ Models migrated")

	// Seed RBAC data (always run to ensure roles and permissions exist)
	log.Info("Seeding RBAC data...")
	if err := database.SeedRBAC(database.DB); err != nil {
		log.Fatalf("Failed to seed RBAC data: %v", err)
	}
	log.Info("✅ RBAC data seeded")

	// Seed Super Admin (always run to ensure super admin exists with latest config)
	log.Info("Seeding super admin...")
	if err := database.SeedSuperAdmin(database.DB); err != nil {
		log.Fatalf("Failed to seed super admin: %v", err)
	}
	log.Info("✅ Super admin seeded")

	// Initialize hierarchy service after RBAC seeding
	authz.InitializeHierarchyService(database.DB)
	log.Info("✅ Hierarchy service initialized")

	// Initialize audit logger
	authz.InitializeAuditLogger(database.DB)
	log.Info("✅ Audit logger initialized")

	// NOTE: Heavy default data seeding (from JSON files in ./default-data) has been
	// moved to a dedicated seeder command in cmd/seeder. This keeps API startup
	// fast and avoids surprising long-running work on each container restart.
	//
	// To seed default data, build the seeder binary and run it once per
	// environment instead of relying on SEED_DEFAULT_DATA at API startup.
	if os.Getenv("SEED_DEFAULT_DATA") == "true" {
		log.Info("Seeding default data...")
		defaultdata.SeedDefaultProjectTemplates(database.DB)
		defaultdata.SeedSCFControls(database.DB)
		defaultdata.SeedSCFFrameworkMaps(database.DB)
		defaultdata.SeedSCFRisks(database.DB)
		defaultdata.SeedSCFThreats(database.DB)
		defaultdata.SeedSCFEvidenceRequests(database.DB)
		defaultdata.SeedSCFAssessmentObjectives(database.DB)
		log.Info("✅ Default data seeded")
	} else {
		log.Info("Skipping default data seeding at API startup (handled by seeder command)")
	}

	// Instrument GORM with OpenTelemetry. Use logical DB name for context.
	observability.InstrumentGorm(database.DB, os.Getenv("DB_NAME"))

	// Connect to Redis (client is instrumented inside ConnectToRedis).
	redisClient := rediscache.ConnectToRedis()
	defer func() {
		if err := redisClient.Close(); err != nil {
			log.Errorf("Error closing Redis client: %v", err)
		}
	}()

	app.Use(middleware.RequestTimingMiddleware())

	// Register routes
	routes.RegisterAuthRoutes(app, database.DB, redisClient)

	// Register super admin routes (separate authentication system)
	routes.RegisterSuperAdminRoutes(app, database.DB)

	// Register GitHub webhook routes BEFORE authenticated group to avoid auth middleware
	routes.RegisterGitHubWebhookRoutes(app, database.DB, redisClient)

	api_group := app.Group("/api/v1")

	// Register GitHub auth routes (some endpoints need to be public)
	routes.RegisterGitHubAuthRoutes(app, api_group, database.DB, redisClient)

	// Register Google auth routes (some endpoints need to be public)
	routes.RegisterGoogleAuthRoutes(app, api_group, database.DB, redisClient)

	// Public health endpoint (no auth)
	routes.RegisterHealthRoutes(app, api_group, database.DB, redisClient)
	routes.RegisterSCFRoutes(app, database.DB)
	routes.RegisterCommitmentPublicRoutes(app, database.DB)

	api_group.Use(middleware.AuthenticateRequest(database.DB, authz.TokenService{}))

	// Access code routes (admin-only)
	routes.RegisterAccessCodeRoutes(api_group.(*fiber.Group), database.DB, redisClient)

	// Admin routes (super-admin only)
	routes.RegisterAdminRoutes(api_group.(*fiber.Group), database.DB)

	// Public project template routes (all authenticated users)
	routes.RegisterProjectTemplateRoutes(api_group.(*fiber.Group), database.DB)
	// Internal-only public visitor usage tracking routes (service token auth)
	routes.RegisterPublicVisitorRoutes(api_group.(*fiber.Group), database.DB)

	org_group := api_group.Group("/org/:org_id")
	org_group.Use(middleware.RestOrgCheckMiddleware(database.DB))

	routes.RegisterRuleRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterCodebaseRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterCodebaseVersionRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterRulingRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterRPCRoutes(org_group.(*fiber.Group), database.DB, redisClient)
	routes.RegisterAPIKeyRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterQuestionRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterPropertyRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterSubjectTypeRoutes(api_group.(*fiber.Group), database.DB)
	routes.RegisterFoundPropertyRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterTemplateSectionRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterReportTemplateRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterComplianceTemplateRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterReportSectionRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterReportRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterActionableItemRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterRoleManagementRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterInvitationRoutes(app, org_group.(*fiber.Group), database.DB)
	routes.RegisterUserRoutes(api_group.(*fiber.Group), database.DB)
	routes.RegisterOrganizationRoutes(api_group.(*fiber.Group), database.DB)
	routes.RegisterGitHubIntegrationRoutes(org_group.(*fiber.Group), database.DB, redisClient)
	routes.RegisterConfluenceIntegrationRoutes(api_group.(*fiber.Group), org_group.(*fiber.Group), database.DB, redisClient)
	routes.RegisterProjectRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterDocumentationTemplateRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterPolicyTemplateRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterDataSourcesRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterAuditorRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterAgentRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterDocumentRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterCollectionRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterEvidenceRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterEvidenceRequestRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterTaskRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterCommitmentRoutes(org_group.(*fiber.Group), database.DB)
	routes.RegisterAwsIntegrationRoutes(org_group.(*fiber.Group))

	// After app setup:
	app.Get("/*", fiberSwagger.WrapHandler)

	app.Listen(":8080")
}
