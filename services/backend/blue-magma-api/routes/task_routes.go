package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterTaskRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	h := handlers.NewProjectTaskHandler(db)

	group := apiOrgGroup.Group("/project/:project_id/task")

	group.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetProjectTasks)
	group.Get("/:task_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.GetProjectTask)
	group.Post("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.CreateProjectTask)
	group.Put("/:task_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.UpdateProjectTask)
	group.Delete("/:task_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), h.DeleteProjectTask)
}
