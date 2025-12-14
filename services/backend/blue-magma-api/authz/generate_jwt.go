package authz

import (
	"errors"
	"os"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"

	log "github.com/sirupsen/logrus"
)

type UserClaims struct {
	UserID         string `json:"user_id"`
	OrganizationID uint   `json:"organization_id"`
	Role           string `json:"role"`
	jwt.RegisteredClaims
}

var AccessTokenSecret = []byte(os.Getenv("JWT_SECRET"))
var RefreshTokenSecret = []byte(os.Getenv("JWT_REFRESH_SECRET"))

const AccessTokenExpiry = time.Minute * 120
const RefreshTokenExpiry = time.Hour * 24 * 7 // 7 days

func GenerateAccessToken(userID string, db *gorm.DB) (string, error) {
	log.Debugf("Generating access token for user ID: %s", userID)

	// Get user with role information
	var user models.User
	if err := db.Preload("UserRoles.Role").Where("object_id = ?", userID).First(&user).Error; err != nil {
		log.Errorf("Failed to get user for token generation: %v", err)
		return "", err
	}

	// Get user's primary role
	role := user.GetPrimaryRole(user.OrganizationID)
	if role == "" {
		log.Errorf("User %s has no active role", userID)
		return "", errors.New("user has no active role")
	}

	claims := UserClaims{
		UserID:         userID,
		OrganizationID: user.OrganizationID,
		Role:           role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(AccessTokenSecret)
}

func GenerateRefreshToken(userID string) (string, error) {
	log.Debugf("Generating refresh token for user ID: %s", userID)
	// Refresh tokens don't need role info, just user ID for renewal
	claims := UserClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(RefreshTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(RefreshTokenSecret)
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

func UpdateUserRefreshTokens(userID string, db *gorm.DB, newToken string, oldToken string) error {

	// find the user in the db
	var user models.User
	if err := db.Where("object_id = ?", userID).First(&user).Error; err != nil {
		return err
	}

	validRefreshTokens := []string{}
	if newToken != "" {
		validRefreshTokens = append(validRefreshTokens, newToken)
	}

	// csv string
	refreshTokens := user.RefreshTokens
	refreshTokensList := strings.Split(refreshTokens, ",")

	auth := TokenService{}
	for _, refreshToken := range refreshTokensList {
		if refreshToken == oldToken {
			continue
		}
		// parse the refresh token
		userID, err := auth.ParseRefreshToken(refreshToken)
		if err != nil {
			// skip the token
			continue
		}

		if userID == user.ObjectID {
			validRefreshTokens = append(validRefreshTokens, refreshToken)
		}
	}

	user.RefreshTokens = strings.Join(validRefreshTokens, ",")

	// save the user
	if err := db.Save(&user).Error; err != nil {
		return err
	}

	return nil
}
