package authz

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	log "github.com/sirupsen/logrus"
)

// SuperAdminClaims represents the JWT claims for super admin tokens
type SuperAdminClaims struct {
	LoginIdentifier string `json:"login_identifier"` // Super admin login identifier
	OriginIP        string `json:"origin_ip"`         // IP address that initiated the login
	jwt.RegisteredClaims
}

var SuperAdminTokenSecret = []byte(os.Getenv("SUPER_ADMIN_JWT_SECRET"))

const SuperAdminTokenExpiry = time.Minute * 20 // 20 minutes

// GenerateSuperAdminToken generates a JWT token for super admin with origin IP embedded
func GenerateSuperAdminToken(loginIdentifier string, originIP string) (string, error) {
	log.Debugf("Generating super admin token for: %s from IP: %s", loginIdentifier, originIP)

	// Validate inputs
	if loginIdentifier == "" {
		return "", errors.New("login identifier cannot be empty")
	}
	if originIP == "" {
		return "", errors.New("origin IP cannot be empty")
	}

	// Check if secret is configured
	if len(SuperAdminTokenSecret) == 0 {
		log.Error("SUPER_ADMIN_JWT_SECRET not configured")
		return "", errors.New("super admin JWT secret not configured")
	}

	claims := SuperAdminClaims{
		LoginIdentifier: loginIdentifier,
		OriginIP:        originIP,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(SuperAdminTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "blue-magma-super-admin",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(SuperAdminTokenSecret)
	if err != nil {
		log.Errorf("Failed to sign super admin token: %v", err)
		return "", err
	}

	log.Infof("Super admin token generated successfully for: %s", loginIdentifier)
	return signedToken, nil
}

// ParseSuperAdminToken validates and parses a super admin JWT token
func ParseSuperAdminToken(tokenString string) (*SuperAdminClaims, error) {
	if len(SuperAdminTokenSecret) == 0 {
		log.Error("SUPER_ADMIN_JWT_SECRET not configured")
		return nil, errors.New("super admin JWT secret not configured")
	}

	token, err := jwt.ParseWithClaims(tokenString, &SuperAdminClaims{}, func(t *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return SuperAdminTokenSecret, nil
	})

	if err != nil {
		log.Warnf("Failed to parse super admin token: %v", err)
		return nil, errors.New("invalid super admin token")
	}

	if !token.Valid {
		log.Warn("Super admin token is invalid")
		return nil, errors.New("invalid super admin token")
	}

	claims, ok := token.Claims.(*SuperAdminClaims)
	if !ok {
		log.Warn("Invalid super admin token claims structure")
		return nil, errors.New("invalid token claims structure")
	}

	// Validate required fields
	if claims.LoginIdentifier == "" {
		log.Warn("Super admin token missing login identifier")
		return nil, errors.New("token missing login identifier")
	}

	if claims.OriginIP == "" {
		log.Warn("Super admin token missing origin IP")
		return nil, errors.New("token missing origin IP")
	}

	return claims, nil
}

// ValidateSuperAdminTokenOrigin validates that the request origin matches the token's origin IP
func ValidateSuperAdminTokenOrigin(claims *SuperAdminClaims, requestIP string) error {
	if claims.OriginIP != requestIP {
		log.Warnf("Super admin token origin IP mismatch: token=%s, request=%s", claims.OriginIP, requestIP)
		return errors.New("origin IP mismatch")
	}
	return nil
}

