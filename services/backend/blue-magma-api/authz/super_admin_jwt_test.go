package authz

import (
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func setupJWTTest() {
	os.Setenv("SUPER_ADMIN_JWT_SECRET", "test-super-admin-secret-key-32bytes!")
	SuperAdminTokenSecret = []byte(os.Getenv("SUPER_ADMIN_JWT_SECRET"))
}

func TestGenerateSuperAdminToken_Success(t *testing.T) {
	setupJWTTest()

	token, err := GenerateSuperAdminToken("test-admin", "192.168.1.1")
	assert.NoError(t, err)
	assert.NotEmpty(t, token)

	// Verify token can be parsed
	claims, err := ParseSuperAdminToken(token)
	assert.NoError(t, err)
	assert.Equal(t, "test-admin", claims.LoginIdentifier)
	assert.Equal(t, "192.168.1.1", claims.OriginIP)
	assert.Equal(t, "blue-magma-super-admin", claims.Issuer)
}

func TestGenerateSuperAdminToken_EmptyLoginIdentifier(t *testing.T) {
	setupJWTTest()

	token, err := GenerateSuperAdminToken("", "192.168.1.1")
	assert.Error(t, err)
	assert.Empty(t, token)
	assert.Contains(t, err.Error(), "login identifier cannot be empty")
}

func TestGenerateSuperAdminToken_EmptyOriginIP(t *testing.T) {
	setupJWTTest()

	token, err := GenerateSuperAdminToken("test-admin", "")
	assert.Error(t, err)
	assert.Empty(t, token)
	assert.Contains(t, err.Error(), "origin IP cannot be empty")
}

func TestGenerateSuperAdminToken_NoSecret(t *testing.T) {
	os.Setenv("SUPER_ADMIN_JWT_SECRET", "")
	SuperAdminTokenSecret = []byte(os.Getenv("SUPER_ADMIN_JWT_SECRET"))

	token, err := GenerateSuperAdminToken("test-admin", "192.168.1.1")
	assert.Error(t, err)
	assert.Empty(t, token)
	assert.Contains(t, err.Error(), "super admin JWT secret not configured")
}

func TestParseSuperAdminToken_Success(t *testing.T) {
	setupJWTTest()

	// Generate a valid token
	token, err := GenerateSuperAdminToken("test-admin", "192.168.1.1")
	assert.NoError(t, err)

	// Parse it
	claims, err := ParseSuperAdminToken(token)
	assert.NoError(t, err)
	assert.NotNil(t, claims)
	assert.Equal(t, "test-admin", claims.LoginIdentifier)
	assert.Equal(t, "192.168.1.1", claims.OriginIP)
}

func TestParseSuperAdminToken_InvalidToken(t *testing.T) {
	setupJWTTest()

	claims, err := ParseSuperAdminToken("invalid.token.here")
	assert.Error(t, err)
	assert.Nil(t, claims)
}

func TestParseSuperAdminToken_ExpiredToken(t *testing.T) {
	setupJWTTest()

	// Create an expired token
	claims := SuperAdminClaims{
		LoginIdentifier: "test-admin",
		OriginIP:        "192.168.1.1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)), // Expired 1 hour ago
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Issuer:    "blue-magma-super-admin",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(SuperAdminTokenSecret)
	assert.NoError(t, err)

	// Try to parse expired token
	parsedClaims, err := ParseSuperAdminToken(signedToken)
	assert.Error(t, err)
	assert.Nil(t, parsedClaims)
}

func TestParseSuperAdminToken_WrongSecret(t *testing.T) {
	setupJWTTest()

	// Generate token with one secret
	token, err := GenerateSuperAdminToken("test-admin", "192.168.1.1")
	assert.NoError(t, err)

	// Change the secret
	SuperAdminTokenSecret = []byte("different-secret-key-32bytes!!!!")

	// Try to parse with different secret
	claims, err := ParseSuperAdminToken(token)
	assert.Error(t, err)
	assert.Nil(t, claims)
}

func TestParseSuperAdminToken_MissingLoginIdentifier(t *testing.T) {
	setupJWTTest()

	// Create token without login identifier
	claims := SuperAdminClaims{
		LoginIdentifier: "", // Empty
		OriginIP:        "192.168.1.1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(SuperAdminTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "blue-magma-super-admin",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(SuperAdminTokenSecret)
	assert.NoError(t, err)

	// Try to parse
	parsedClaims, err := ParseSuperAdminToken(signedToken)
	assert.Error(t, err)
	assert.Nil(t, parsedClaims)
	assert.Contains(t, err.Error(), "missing login identifier")
}

func TestParseSuperAdminToken_MissingOriginIP(t *testing.T) {
	setupJWTTest()

	// Create token without origin IP
	claims := SuperAdminClaims{
		LoginIdentifier: "test-admin",
		OriginIP:        "", // Empty
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(SuperAdminTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "blue-magma-super-admin",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(SuperAdminTokenSecret)
	assert.NoError(t, err)

	// Try to parse
	parsedClaims, err := ParseSuperAdminToken(signedToken)
	assert.Error(t, err)
	assert.Nil(t, parsedClaims)
	assert.Contains(t, err.Error(), "missing origin IP")
}

func TestValidateSuperAdminTokenOrigin_Success(t *testing.T) {
	setupJWTTest()

	claims := &SuperAdminClaims{
		LoginIdentifier: "test-admin",
		OriginIP:        "192.168.1.1",
	}

	err := ValidateSuperAdminTokenOrigin(claims, "192.168.1.1")
	assert.NoError(t, err)
}

func TestValidateSuperAdminTokenOrigin_Mismatch(t *testing.T) {
	setupJWTTest()

	claims := &SuperAdminClaims{
		LoginIdentifier: "test-admin",
		OriginIP:        "192.168.1.1",
	}

	err := ValidateSuperAdminTokenOrigin(claims, "10.0.0.1")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "origin IP mismatch")
}

func TestSuperAdminTokenExpiry(t *testing.T) {
	// Verify the token expiry is set to 20 minutes
	assert.Equal(t, 20*time.Minute, SuperAdminTokenExpiry)
}

