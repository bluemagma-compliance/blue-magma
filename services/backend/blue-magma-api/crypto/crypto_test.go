package crypto

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"gorm.io/datatypes"
)

func TestEncryptDecryptField(t *testing.T) {
	// Set up the encryption key
	encryptionKey := "thisis32bitlongpassphraseimusing"
	os.Setenv("ENCRYPTION_KEY", encryptionKey)

	plainText := "Hello, Blue Magma!"

	// Test encryption
	encryptedText, err := EncryptField(plainText)
	assert.NoError(t, err, "EncryptField should not return an error")
	assert.NotEmpty(t, encryptedText, "Encrypted text should not be empty")

	// Test decryption
	decryptedText, err := DecryptField(encryptedText)
	assert.NoError(t, err, "DecryptField should not return an error")
	assert.Equal(t, plainText, decryptedText, "Decrypted text should match the original plain text")
}

func TestEncryptFieldInvalidKey(t *testing.T) {
	// Set up an invalid encryption key
	os.Setenv("ENCRYPTION_KEY", "shortkey")

	plainText := "Hello, Blue Magma!"

	// Test encryption with invalid key
	_, err := EncryptField(plainText)
	assert.Error(t, err, "EncryptField should return an error for an invalid key")
}

func TestDecryptFieldInvalidKey(t *testing.T) {
	// Set up a valid encryption key for encryption
	encryptionKey := "thisis32bitlongpassphraseimusing"
	os.Setenv("ENCRYPTION_KEY", encryptionKey)

	plainText := "Hello, Blue Magma!"
	encryptedText, err := EncryptField(plainText)
	assert.NoError(t, err, "EncryptField should not return an error")

	// Set up an invalid encryption key for decryption
	os.Setenv("ENCRYPTION_KEY", "shortkey")

	// Test decryption with invalid key
	_, err = DecryptField(encryptedText)
	assert.Error(t, err, "DecryptField should return an error for an invalid key")
}

func TestHashPasswordAndCheckPasswordHash(t *testing.T) {
	password := "securepassword123"

	// Test password hashing
	hashedPassword, err := HashPassword(password)
	assert.NoError(t, err, "HashPassword should not return an error")
	assert.NotEmpty(t, hashedPassword, "Hashed password should not be empty")

	// Test password hash verification
	isValid := CheckPasswordHash(password, hashedPassword)
	assert.True(t, isValid, "CheckPasswordHash should return true for a valid password and hash")

	// Test invalid password
	isValid = CheckPasswordHash("wrongpassword", hashedPassword)
	assert.False(t, isValid, "CheckPasswordHash should return false for an invalid password")
}

func TestCheckPasswordHash(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		password      string
		hash          string
		expectedValid bool
	}{
		{
			name:          "Valid password and hash",
			password:      "securepassword123",
			hash:          "$2a$10$TIsivaAwStn3Mntd5W4tXeZ2hy2e9fh6xTzPZCuJFvasHqCuG41tS", // bcrypt hash for "securepassword123"
			expectedValid: true,
		},
		{
			name:          "Invalid password with valid hash",
			password:      "wrongpassword",
			hash:          "$2a$10$TIsivaAwStn3Mntd5W4tXeZ2hy2e9fh6xTzPZCuJFvasHqCuG41tS", // bcrypt hash for "securepassword123"
			expectedValid: false,
		},
		{
			name:          "Empty password with valid hash",
			password:      "",
			hash:          "$2a$10$TIsivaAwStn3Mntd5W4tXeZ2hy2e9fh6xTzPZCuJFvasHqCuG41tS", // bcrypt hash for "securepassword123"
			expectedValid: false,
		},
		{
			name:          "Valid password with empty hash",
			password:      "securepassword123",
			hash:          "",
			expectedValid: false,
		},
		{
			name:          "Empty password with empty hash",
			password:      "",
			hash:          "",
			expectedValid: false,
		},
		{
			name:          "Valid password with invalid hash format",
			password:      "securepassword123",
			hash:          "invalid_hash_format",
			expectedValid: false,
		},
	}

	// Generate a hash for the test password to see what it looks like
	testPassword := "securepassword123"
	generatedHash, err := HashPassword(testPassword)
	assert.NoError(t, err, "HashPassword should not return an error")
	t.Logf("Generated hash for '%s': %s", testPassword, generatedHash)
	t.Logf("Expected hash: %s", testCases[0].hash)

	// Check if the generated hash matches the expected hash
	isValid := CheckPasswordHash(testPassword, generatedHash)
	t.Logf("CheckPasswordHash('%s', generated hash) = %v", testPassword, isValid)

	isValid = CheckPasswordHash(testPassword, testCases[0].hash)
	t.Logf("CheckPasswordHash('%s', expected hash) = %v", testPassword, isValid)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			isValid := CheckPasswordHash(tc.password, tc.hash)
			assert.Equal(t, tc.expectedValid, isValid,
				"CheckPasswordHash(%q, %q) should return %v",
				tc.password, tc.hash, tc.expectedValid)
		})
	}

	// Test with dynamically generated hash
	t.Run("Dynamic hash generation and verification", func(t *testing.T) {
		password := "dynamicpassword123"

		// Generate a hash
		hash, err := HashPassword(password)
		assert.NoError(t, err, "HashPassword should not return an error")
		assert.NotEmpty(t, hash, "Generated hash should not be empty")

		// Verify the hash
		isValid := CheckPasswordHash(password, hash)
		assert.True(t, isValid, "CheckPasswordHash should return true for a valid password and hash")

		// Verify with wrong password
		isValid = CheckPasswordHash("wrongpassword", hash)
		assert.False(t, isValid, "CheckPasswordHash should return false for an invalid password")
	})
}
func TestHashGormJSON(t *testing.T) {
	// Test cases
	testCases := []struct {
		name       string
		jsonData   datatypes.JSON
		expected   string
		shouldFail bool
	}{
		{
			name:       "Valid JSON data",
			jsonData:   datatypes.JSON(`{"key":"value"}`),
			expected:   "e43abcf3375244839c012f9633f95862d232a95b00d5bc7348b3098b9fed7f32", // Replace with actual hash
			shouldFail: false,
		},
		{
			name:       "Empty JSON data",
			jsonData:   datatypes.JSON(`{}`),
			expected:   "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a", // SHA-256 of empty JSON
			shouldFail: false,
		},
		{
			name:       "Invalid JSON data",
			jsonData:   datatypes.JSON(`invalid`),
			expected:   "",
			shouldFail: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			hash := HashGormJSON(tc.jsonData)
			if tc.shouldFail {
				assert.NotEqual(t, tc.expected, hash, "HashGormJSON should not match for invalid input")
			} else {
				assert.Equal(t, tc.expected, hash, "HashGormJSON should match the expected hash")
			}
		})
	}
}
