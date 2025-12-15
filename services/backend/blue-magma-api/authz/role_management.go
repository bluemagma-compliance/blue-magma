package authz

import (
	"errors"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

var (
	ErrCannotModifySelf        = errors.New("users cannot modify their own roles")
	ErrInsufficientHierarchy   = errors.New("insufficient hierarchy level to perform this action")
	ErrInsufficientPermissions = errors.New("insufficient permissions to perform this action")
)

// CanUserModifyUser checks if the acting user can modify the target user
func CanUserModifyUser(db *gorm.DB, actingUserID, targetUserID, organizationID uint) error {
	// Users cannot modify themselves
	if actingUserID == targetUserID {
		return ErrCannotModifySelf
	}

	// Get both users' roles efficiently
	actingRole, err := getUserPrimaryRole(db, actingUserID, organizationID)
	if err != nil {
		return err
	}

	targetRole, err := getUserPrimaryRole(db, targetUserID, organizationID)
	if err != nil {
		return err
	}

	// Check hierarchy first
	canModify, err := GetHierarchyService().CanModifyRole(actingRole, targetRole)
	if err != nil {
		return err
	}
	if !canModify {
		return ErrInsufficientHierarchy
	}

	// Check if acting user has sufficient role level (admin or above)
	actingLevel, err := GetHierarchyService().GetRoleLevel(actingRole)
	if err != nil {
		return err
	}
	if actingLevel < 3 { // admin level
		return ErrInsufficientPermissions
	}

	return nil
}

// CanUserAssignRole checks if the acting user can assign a specific role
func CanUserAssignRole(db *gorm.DB, actingUserID, organizationID uint, targetRole string) error {
	actingRole, err := getUserPrimaryRole(db, actingUserID, organizationID)
	if err != nil {
		return err
	}

	// Check hierarchy
	canAssign, err := GetHierarchyService().CanModifyRole(actingRole, targetRole)
	if err != nil {
		return err
	}
	if !canAssign {
		return ErrInsufficientHierarchy
	}

	// Check if acting user has sufficient role level for assignment
	actingLevel, err := GetHierarchyService().GetRoleLevel(actingRole)
	if err != nil {
		return err
	}

	// Admin can assign roles below admin, owner can assign any role
	targetLevel, err := GetHierarchyService().GetRoleLevel(targetRole)
	if err != nil {
		return err
	}

	if actingLevel < 3 { // Below admin level
		return ErrInsufficientPermissions
	}

	if actingLevel == 3 && targetLevel >= 3 { // Admin trying to assign admin/owner
		return ErrInsufficientPermissions
	}

	return nil
}

// CanUserInviteWithRole checks if the acting user can invite someone with a specific role
func CanUserInviteWithRole(db *gorm.DB, actingUserID, organizationID uint, inviteRole string) error {
	actingRole, err := getUserPrimaryRole(db, actingUserID, organizationID)
	if err != nil {
		return err
	}

	// Check if user has sufficient role level to create users (admin or above)
	actingLevel, err := GetHierarchyService().GetRoleLevel(actingRole)
	if err != nil {
		return err
	}
	if actingLevel < 3 { // Below admin level
		return ErrInsufficientPermissions
	}

	// Check if user can assign the specified role
	return CanUserAssignRole(db, actingUserID, organizationID, inviteRole)
}

// GetAssignableRoles returns the list of roles that the acting user can assign
func GetAssignableRoles(db *gorm.DB, actingUserID, organizationID uint) ([]string, error) {
	actingRole, err := getUserPrimaryRole(db, actingUserID, organizationID)
	if err != nil {
		return nil, err
	}

	// Check if user has sufficient role level for assignment (admin or above)
	actingLevel, err := GetHierarchyService().GetRoleLevel(actingRole)
	if err != nil {
		return nil, err
	}
	if actingLevel < 3 { // Below admin level
		return []string{}, nil
	}

	// Get all roles below this user's role
	return GetHierarchyService().GetRolesBelow(actingRole)
}

// ValidateRoleExists checks if a role exists and is active
func ValidateRoleExists(db *gorm.DB, roleName string) error {
	if roleName == "" {
		return errors.New("role name cannot be empty")
	}

	// Check if role exists using Count to avoid "record not found" logs
	var count int64
	db.Model(&models.Role{}).Where("name = ? AND is_active = ?", roleName, true).Count(&count)

	if count == 0 {
		log.Warnf("Attempt to use non-existent or inactive role: %s", roleName)
		return errors.New("role does not exist or is inactive")
	}

	return nil
}

// ValidateUserExists checks if a user exists in the specified organization
func ValidateUserExists(db *gorm.DB, userID, organizationID uint) error {
	// Check if user exists using Count to avoid "record not found" logs
	var count int64
	db.Model(&models.User{}).Where("id = ? AND organization_id = ?", userID, organizationID).Count(&count)

	if count == 0 {
		log.Warnf("Attempt to access non-existent user %d in org %d", userID, organizationID)
		return errors.New("user does not exist in this organization")
	}

	return nil
}

// Helper function to get user's primary role efficiently
func getUserPrimaryRole(db *gorm.DB, userID, organizationID uint) (string, error) {
	var result struct {
		Name string
	}

	err := db.Table("user_roles").
		Select("roles.name").
		Joins("JOIN roles ON user_roles.role_id = roles.id").
		Where("user_roles.user_id = ? AND user_roles.organization_id = ? AND user_roles.is_active = ?",
			userID, organizationID, true).
		Limit(1).
		Scan(&result).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Warnf("No active role found for user %d in org %d", userID, organizationID)
			return "", errors.New("user has no active role")
		}
		log.Errorf("Database error getting role for user %d: %v", userID, err)
		return "", err
	}

	return result.Name, nil
}
