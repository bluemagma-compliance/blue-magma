package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterProjectRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	projectHandler := handlers.NewProjectHandler(db)
	projectGroup := apiOrgGroup.Group("/project")

	projectGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), projectHandler.GetProjects)
	projectGroup.Get("/:project_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), projectHandler.GetProject)
	projectGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), projectHandler.CreateProject)
	projectGroup.Post("/from-scf-config", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), projectHandler.CreateProjectFromSCFConfig)
	projectGroup.Put("/:project_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), projectHandler.UpdateProject)
	projectGroup.Delete("/:project_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), projectHandler.DeleteProject)
}
