package authz

import (
	"sync"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"gorm.io/gorm"
)

// HierarchyService handles all role hierarchy operations
type HierarchyService struct {
	db        *gorm.DB
	roleCache map[string]int
	mutex     sync.RWMutex
}

// Global hierarchy service instance
var hierarchyService *HierarchyService
var once sync.Once

// InitializeHierarchyService initializes the global hierarchy service
func InitializeHierarchyService(db *gorm.DB) {
	once.Do(func() {
		hierarchyService = &HierarchyService{
			db:        db,
			roleCache: make(map[string]int),
		}
	})
}

// GetHierarchyService returns the global hierarchy service instance
func GetHierarchyService() *HierarchyService {
	return hierarchyService
}

// GetRoleLevel returns the hierarchy level for a role name
func (h *HierarchyService) GetRoleLevel(roleName string) (int, error) {
	// Check cache first with read lock
	h.mutex.RLock()
	if level, exists := h.roleCache[roleName]; exists {
		h.mutex.RUnlock()
		return level, nil
	}
	h.mutex.RUnlock()

	// Upgrade to write lock for database query and cache update
	h.mutex.Lock()
	defer h.mutex.Unlock()

	// Double-check cache after acquiring write lock (another goroutine might have populated it)
	if level, exists := h.roleCache[roleName]; exists {
		return level, nil
	}

	// Query database
	var role models.Role
	err := h.db.Where("name = ? AND is_active = ?", roleName, true).
		Select("hierarchy_level").
		First(&role).Error

	if err != nil {
		return 0, err
	}

	// Cache the result (we already have write lock)
	h.roleCache[roleName] = role.HierarchyLevel

	return role.HierarchyLevel, nil
}

// CanModifyRole checks if actingRole can modify targetRole
func (h *HierarchyService) CanModifyRole(actingRole, targetRole string) (bool, error) {
	actingLevel, err := h.GetRoleLevel(actingRole)
	if err != nil {
		return false, err
	}

	targetLevel, err := h.GetRoleLevel(targetRole)
	if err != nil {
		return false, err
	}

	// Higher level (higher number) can modify lower level
	return actingLevel > targetLevel, nil
}

// GetRolesBelow returns all roles below the given role in hierarchy
func (h *HierarchyService) GetRolesBelow(roleName string) ([]string, error) {
	level, err := h.GetRoleLevel(roleName)
	if err != nil {
		return nil, err
	}

	var roles []models.Role
	err = h.db.Where("hierarchy_level < ? AND is_active = ?", level, true).
		Select("name").
		Order("hierarchy_level DESC"). // Higher levels first
		Find(&roles).Error

	if err != nil {
		return nil, err
	}

	roleNames := make([]string, len(roles))
	for i, role := range roles {
		roleNames[i] = role.Name
	}

	return roleNames, nil
}

// ClearCache clears the role cache (useful for testing)
func (h *HierarchyService) ClearCache() {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	h.roleCache = make(map[string]int)
}

// GetAllRoles returns all active roles ordered by hierarchy
func (h *HierarchyService) GetAllRoles() ([]models.Role, error) {
	var roles []models.Role
	err := h.db.Where("is_active = ?", true).
		Order("hierarchy_level ASC").
		Find(&roles).Error
	return roles, err
}
