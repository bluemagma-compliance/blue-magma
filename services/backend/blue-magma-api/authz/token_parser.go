package authz

import (
	"errors"
	"os"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2/log"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

var secret = os.Getenv("JWT_SECRET")
var jwtSecret = []byte(secret) // must match signer
var refreshSecret = []byte(os.Getenv("JWT_REFRESH_SECRET"))

type TokenService struct{}

// ParseUserToken validates the JWT and extracts the user claims
func (a TokenService) ParseUserToken(tokenString string) (userID string, err error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return "0", errors.New("invalid user token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "0", errors.New("invalid claims structure")
	}

	userId, ok := claims["user_id"]
	if !ok {
		return "0", errors.New("user_id claim missing or invalid")
	}

	userIdStr, ok := userId.(string)
	if !ok {
		return "0", errors.New("user_id claim is not a string")
	}
	return userIdStr, nil
}

// ParseUserClaims validates the JWT and extracts all user claims including role
func (a TokenService) ParseUserClaims(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid user token")
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok {
		return nil, errors.New("invalid claims structure")
	}

	return claims, nil
}

// ParseRefreshToken validates the refresh token and extracts the user ID
func (a TokenService) ParseRefreshToken(tokenString string) (userID string, err error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return refreshSecret, nil
	})

	if err != nil || !token.Valid {
		return "0", errors.New("invalid refresh token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "0", errors.New("invalid claims structure")
	}

	id, ok := claims["user_id"]
	if !ok {
		return "0", errors.New("user_id claim missing or invalid")
	}

	idStr, ok := id.(string)
	if !ok {
		return "0", errors.New("user_id claim is not a string")
	}
	return idStr, nil
}

// find the refresh token in the user's refresh tokens
func (a TokenService) FindRefreshToken(userID string, refreshToken string, db *gorm.DB) (bool, error) {
	var user models.User
	if err := db.Where("object_id = ?", userID).First(&user).Error; err != nil {
		return false, err
	}

	refreshTokensList := strings.Split(user.RefreshTokens, ",")
	for _, token := range refreshTokensList {
		if token == refreshToken {
			return true, nil
		}
	}

	log.Warnf("Refresh token not found for user %d", userID)
	return false, nil
}
