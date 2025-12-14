package routes

import (
	"github.com/bluemagma-compliance/blue-magma-api/handlers"
	"github.com/bluemagma-compliance/blue-magma-api/middleware"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterRoleManagementRoutes(router fiber.Router, db *gorm.DB) {
	roleHandler := &handlers.RoleManagementHandler{DB: db}
	userHandler := &handlers.UserManagementHandler{DB: db}

	// Role management routes
	roleGroup := router.Group("/roles")

	// Get assignable roles for current user
	roleGroup.Get("/assignable",
		middleware.RequireRole("admin"), // Only admins and above can create users
		middleware.RestOrgCheckMiddleware(db),
		roleHandler.GetAssignableRoles)

	// Get current user's role management permissions
	roleGroup.Get("/permissions",
		middleware.RequireRole("user"), // All users can see their own permissions
		middleware.RestOrgCheckMiddleware(db),
		roleHandler.GetUserPermissions)

	// User management routes
	userGroup := router.Group("/users")

	// List all users in organization
	userGroup.Get("/",
		middleware.RequireRole("admin"), // Admins and above can view users
		middleware.RestOrgCheckMiddleware(db),
		userHandler.ListUsers)

	// Change user role (with comprehensive security checks)
	userGroup.Put("/:user_id/role",
		middleware.RequireUserModificationPermission(db),  // Check if can modify target user
		middleware.RequireRoleAssignmentPermission(db),    // Check if can assign the role
		middleware.RestOrgCheckMiddleware(db),
		userHandler.ChangeUserRole)

	// Remove user from organization
	userGroup.Delete("/:user_id",
		middleware.RequireUserModificationPermission(db),  // Check if can modify target user
		middleware.RequireRole("admin"),                   // Admins and above can delete users
		middleware.RestOrgCheckMiddleware(db),
		userHandler.RemoveUser)
}
