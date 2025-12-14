package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterAgentRoutes(apiOrgGroup *fiber.Group, db *gorm.DB) {
	agentHandler := handlers.NewAgentHandler(db)

	// Base: /api/v1/org/:org_id/project/:project_id/agent
	agentGroup := apiOrgGroup.Group("/project/:project_id/agent")

	// GET endpoints - require "user" role
	agentGroup.Get("/", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), agentHandler.GetAgents)
	agentGroup.Get("/:agent_id", middleware.RequireRole("user"), middleware.RestOrgCheckMiddleware(db), agentHandler.GetAgent)

	// POST, PUT, DELETE endpoints - require "admin" role
	agentGroup.Post("/", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), agentHandler.CreateAgent)
	agentGroup.Put("/:agent_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), agentHandler.UpdateAgent)
	agentGroup.Delete("/:agent_id", middleware.RequireRole("admin"), middleware.RestOrgCheckMiddleware(db), agentHandler.DeleteAgent)
}

