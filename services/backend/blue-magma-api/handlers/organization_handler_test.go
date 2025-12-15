package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupOrganizationTestEnv() (*gorm.DB, *OrganizationHandler, *fiber.App) {
	// Set encryption key for tests (must be exactly 32 bytes)
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	// Migrate all required models for proper cascade deletion
	err = db.AutoMigrate(
		&models.Organization{},
		&models.User{},
		&models.Codebase{},
		&models.CodebaseVersion{},
		&models.Rule{},
		&models.APIKey{},
		&models.SubjectType{},
	)
	if err != nil {
		panic(err)
	}

	handler := NewOrganizationHandler(db)
	app := fiber.New()

	// Setup routes
	app.Get("/api/v1/org/:org_id", handler.GetOrganization)
	app.Put("/api/v1/org/:org_id", handler.UpdateOrganization)
	app.Patch("/api/v1/org/:org_id", handler.PatchOrganization)
	app.Patch("/api/v1/org/:org_id/credits", handler.UpdateOrganizationCredits)
	app.Patch("/api/v1/org/:org_id/credits/add", handler.AddOrganizationCredits)
	app.Patch("/api/v1/org/:org_id/credits/subtract", handler.SubtractOrganizationCredits)
	app.Delete("/api/v1/org/:org_id", handler.DeleteOrganization)

	return db, handler, app
}

func TestGetOrganization(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:                "test-org-123",
		OrganizationName:        "Test Organization",
		OrganizationDescription: "Test Description",
		OrganizationAddress:     "123 Test St",
		OrganizationCity:        "Test City",
		OrganizationState:       "Test State",
		OrganizationPostalCode:  "12345",
		OrganizationCountry:     "Test Country",
		StripeCustomerID:        "cus_test123",
		BillingEmail:            "billing@test.com",
		StripeSubscriptionID:    "sub_test123",
		StripePaymentMethodID:   "pm_test123",
		CurrentPlan:             "premium",
		Credits:                 100,
		Partners:                true,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test successful retrieval
	req, _ := http.NewRequest("GET", "/api/v1/org/test-org-123", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, "test-org-123", response.ObjectID)
	assert.Equal(t, "Test Organization", response.OrganizationName)
	assert.Equal(t, "Test Description", response.OrganizationDescription)
	assert.Equal(t, 100, response.Credits)
	assert.Equal(t, "premium", response.CurrentPlan)
	assert.True(t, response.Partners)

	// Test organization not found
	req, _ = http.NewRequest("GET", "/api/v1/org/nonexistent", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

func TestUpdateOrganization(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:                "test-org-123",
		OrganizationName:        "Original Name",
		OrganizationDescription: "Original Description",
		Credits:                 100, // This should not be updated
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test successful update with all required fields
	updateReq := UpdateOrganizationRequestPUT{
		OrganizationName:                "Updated Name",
		OrganizationDescription:         "Updated Description",
		OrganizationAddress:             "456 Updated St",
		OrganizationCity:                "Updated City",
		OrganizationState:               "Updated State",
		OrganizationPostalCode:          "54321",
		OrganizationCountry:             "Updated Country",
		OrganizationWhat:                "We build compliance tooling",
		OrganizationSize:                "11-50",
		OrganizationIndustry:            "SaaS",
		OrganizationLocation:            "Remote",
		OrganizationGoals:               "Achieve SOC2 and ISO27001",
		OrganizationImportantDataTypes:  "PHI, PII, production logs",
		OrganizationCustomerProfile:     "B2B SaaS companies using our platform",
		OrganizationSecurityMotivations: "Meet customer security questionnaires and reduce breach risk",
		OrganizationStructureOwnership:  "Security owned by CTO with one security engineer",
		OrganizationTechnicalStack:      "Kubernetes on GCP, Postgres, Node backend, React frontend",
		OrganizationSecurityFrameworks:  "SOC2, ISO27001",
		OrganizationRelevantLaws:        "GDPR, CCPA",
		PastIssues:                      "Had prior audit delays",
		PreviousWork:                    "Completed SOC2 readiness in 2023",
		OnboardStatus:                   "active",
		StripeCustomerID:                "cus_updated123",
		BillingEmail:                    "updated@test.com",
		StripeSubscriptionID:            "sub_updated123",
		StripePaymentMethodID:           "pm_updated123",
		CurrentPlan:                     "enterprise",
		MonthlyCost:                     99.99,
		SubscriptionStatus:              "active",
		NextBillingDate:                 "2024-01-01",
	}

	body, _ := json.Marshal(updateReq)
	req, _ := http.NewRequest("PUT", "/api/v1/org/test-org-123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", response.OrganizationName)
	assert.Equal(t, "Updated Description", response.OrganizationDescription)
	assert.Equal(t, "456 Updated St", response.OrganizationAddress)
	assert.Equal(t, "enterprise", response.CurrentPlan)
	assert.Equal(t, 100, response.Credits) // Credits should remain unchanged

	// Verify in database
	var updatedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&updatedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, "Updated Name", updatedOrg.OrganizationName)
	assert.Equal(t, 100, updatedOrg.Credits) // Credits should remain unchanged

	// Test organization not found
	req, _ = http.NewRequest("PUT", "/api/v1/org/nonexistent", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)

	// Test invalid request body
	req, _ = http.NewRequest("PUT", "/api/v1/org/test-org-123", bytes.NewReader([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

func TestDeleteOrganization(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Create test users in the organization
	phone1 := "555-0001"
	user1 := models.User{
		ObjectID:       "user-1",
		FirstName:      "John",
		LastName:       "Doe",
		Email:          "john@test.com",
		Phone:          &phone1,
		Username:       "john@test.com",
		OrganizationID: org.ID,
	}
	phone2 := "555-0002"
	user2 := models.User{
		ObjectID:       "user-2",
		FirstName:      "Jane",
		LastName:       "Smith",
		Email:          "jane@test.com",
		Phone:          &phone2,
		Username:       "jane@test.com",
		OrganizationID: org.ID,
	}
	err = db.Create(&user1).Error
	assert.NoError(t, err)
	err = db.Create(&user2).Error
	assert.NoError(t, err)

	// Verify users exist
	var userCount int64
	db.Model(&models.User{}).Where("organization_id = ?", org.ID).Count(&userCount)
	assert.Equal(t, int64(2), userCount)

	// Test successful deletion
	req, _ := http.NewRequest("DELETE", "/api/v1/org/test-org-123", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNoContent, resp.StatusCode)

	// Verify organization is deleted
	var deletedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&deletedOrg).Error
	assert.Error(t, err)
	assert.Equal(t, gorm.ErrRecordNotFound, err)

	// Verify users are deleted
	db.Model(&models.User{}).Where("organization_id = ?", org.ID).Count(&userCount)
	assert.Equal(t, int64(0), userCount)

	// Test organization not found
	req, _ = http.NewRequest("DELETE", "/api/v1/org/nonexistent", nil)
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}

func TestUpdateOrganizationCreditsExclusion(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization with initial credits
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
		Credits:          100,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Attempt to update organization (credits should remain unchanged)
	updateReq := UpdateOrganizationRequestPUT{
		OrganizationName:                "Updated Name",
		OrganizationDescription:         "Updated Description",
		OrganizationAddress:             "456 Updated St",
		OrganizationCity:                "Updated City",
		OrganizationState:               "Updated State",
		OrganizationPostalCode:          "54321",
		OrganizationCountry:             "Updated Country",
		OrganizationWhat:                "We build compliance tooling",
		OrganizationSize:                "11-50",
		OrganizationIndustry:            "SaaS",
		OrganizationLocation:            "Remote",
		OrganizationGoals:               "Achieve SOC2 and ISO27001",
		OrganizationImportantDataTypes:  "PHI, PII, production logs",
		OrganizationCustomerProfile:     "B2B SaaS companies using our platform",
		OrganizationSecurityMotivations: "Meet customer security questionnaires and reduce breach risk",
		OrganizationStructureOwnership:  "Security owned by CTO with one security engineer",
		OrganizationTechnicalStack:      "Kubernetes on GCP, Postgres, Node backend, React frontend",
		OrganizationSecurityFrameworks:  "SOC2, ISO27001",
		OrganizationRelevantLaws:        "GDPR, CCPA",
		PastIssues:                      "Had prior audit delays",
		PreviousWork:                    "Completed SOC2 readiness in 2023",
		OnboardStatus:                   "active",
		StripeCustomerID:                "cus_updated123",
		BillingEmail:                    "updated@test.com",
		StripeSubscriptionID:            "sub_updated123",
		StripePaymentMethodID:           "pm_updated123",
		CurrentPlan:                     "premium",
		MonthlyCost:                     49.99,
		SubscriptionStatus:              "active",
		NextBillingDate:                 "2024-02-01",
		// Note: Credits field is not included in UpdateOrganizationRequestPUT
	}

	body, _ := json.Marshal(updateReq)
	req, _ := http.NewRequest("PUT", "/api/v1/org/test-org-123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	// Verify credits remain unchanged
	var updatedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&updatedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, 100, updatedOrg.Credits) // Credits should remain unchanged
	assert.Equal(t, "Updated Name", updatedOrg.OrganizationName)
	assert.Equal(t, "premium", updatedOrg.CurrentPlan)
}

func TestUpdateOrganizationPUTValidation(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
		Credits:          100,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test with missing required fields - should fail
	incompleteReq := map[string]interface{}{
		"organization_name": "Updated Name",
		// Missing other required fields
	}

	body, _ := json.Marshal(incompleteReq)
	req, _ := http.NewRequest("PUT", "/api/v1/org/test-org-123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	// Verify error message mentions required fields
	var errorResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&errorResp)
	assert.NoError(t, err)
	assert.Contains(t, errorResp["error"], "required")
}

func TestPatchOrganization(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:                "test-org-123",
		OrganizationName:        "Original Name",
		OrganizationDescription: "Original Description",
		OrganizationAddress:     "123 Original St",
		OrganizationCity:        "Original City",
		OrganizationState:       "Original State",
		OrganizationPostalCode:  "12345",
		OrganizationCountry:     "Original Country",
		StripeCustomerID:        "cus_original123",
		BillingEmail:            "original@test.com",
		StripeSubscriptionID:    "sub_original123",
		StripePaymentMethodID:   "pm_original123",
		CurrentPlan:             "basic",
		Credits:                 100,
		MonthlyCost:             29.99,
		SubscriptionStatus:      "active",
		NextBillingDate:         "2024-01-15",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test partial update - only update name, plan, and monthly cost
	patchReq := PatchOrganizationRequest{
		OrganizationName: stringPtr("Updated Name"),
		CurrentPlan:      stringPtr("premium"),
		MonthlyCost:      float64Ptr(59.99),
		// Other fields intentionally omitted
	}

	body, _ := json.Marshal(patchReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)

	// Verify only specified fields were updated
	assert.Equal(t, "Updated Name", response.OrganizationName)
	assert.Equal(t, "premium", response.CurrentPlan)
	assert.Equal(t, 59.99, response.MonthlyCost)
	// Verify other fields remained unchanged
	assert.Equal(t, "Original Description", response.OrganizationDescription)
	assert.Equal(t, "123 Original St", response.OrganizationAddress)
	assert.Equal(t, "Original City", response.OrganizationCity)
	assert.Equal(t, "original@test.com", response.BillingEmail)
	assert.Equal(t, "active", response.SubscriptionStatus)
	assert.Equal(t, "2024-01-15", response.NextBillingDate)
	assert.Equal(t, 100, response.Credits) // Credits should remain unchanged
}

func TestPatchOrganizationPastIssuesAndPreviousWork(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization with existing narrative fields
	org := models.Organization{
		ObjectID:                 "test-org-123",
		OrganizationName:         "Original Name",
		OrganizationPastIssues:   "Old issues",
		OrganizationPreviousWork: "Old work",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	patchReq := PatchOrganizationRequest{
		PastIssues:   stringPtr("New past issues narrative"),
		PreviousWork: stringPtr("New previous work narrative"),
	}

	body, _ := json.Marshal(patchReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response2 OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response2)
	assert.NoError(t, err)
	assert.Equal(t, "New past issues narrative", response2.PastIssues)
	assert.Equal(t, "New previous work narrative", response2.PreviousWork)

	// Verify in database
	var updatedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&updatedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, "New past issues narrative", updatedOrg.OrganizationPastIssues)
	assert.Equal(t, "New previous work narrative", updatedOrg.OrganizationPreviousWork)
}

func TestPatchOrganizationEmailValidation(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:     "test-org-123",
		BillingEmail: "valid@test.com",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test with invalid email format
	patchReq := PatchOrganizationRequest{
		BillingEmail: stringPtr("invalid-email"),
	}

	body, _ := json.Marshal(patchReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	// Verify error message mentions validation
	var errorResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&errorResp)
	assert.NoError(t, err)
	assert.Contains(t, errorResp["error"], "Validation")
}

func TestPatchOrganizationEmptyRequest(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Original Name",
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test with empty patch request (should succeed but change nothing)
	patchReq := PatchOrganizationRequest{}

	body, _ := json.Marshal(patchReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)

	// Verify nothing was changed
	assert.Equal(t, "Original Name", response.OrganizationName)
}

func TestUpdateOrganizationCredits(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
		Credits:          100,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test successful credits update
	creditsReq := UpdateCreditsRequest{
		Credits: 500,
	}

	body, _ := json.Marshal(creditsReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123/credits", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, 500, response.Credits)

	// Verify in database
	var updatedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&updatedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, 500, updatedOrg.Credits)
}

func TestUpdateOrganizationCreditsValidation(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID: "test-org-123",
		Credits:  100,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test with negative credits (should fail)
	creditsReq := UpdateCreditsRequest{
		Credits: -10,
	}

	body, _ := json.Marshal(creditsReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123/credits", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	// Verify error message mentions validation
	var errorResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&errorResp)
	assert.NoError(t, err)
	assert.Contains(t, errorResp["error"], "non-negative")
}

func TestAddOrganizationCredits(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization with initial credits
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
		Credits:          100,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test adding credits
	addReq := AddCreditsRequest{
		Credits: 250,
	}

	body, _ := json.Marshal(addReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123/credits/add", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, 350, response.Credits) // 100 + 250

	// Verify in database
	var updatedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&updatedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, 350, updatedOrg.Credits)
}

func TestAddOrganizationCreditsValidation(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID: "test-org-123",
		Credits:  100,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test with zero credits (should fail)
	addReq := AddCreditsRequest{
		Credits: 0,
	}

	body, _ := json.Marshal(addReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123/credits/add", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	// Verify error message mentions positive integer
	var errorResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&errorResp)
	assert.NoError(t, err)
	assert.Contains(t, errorResp["error"], "positive")
}

func TestSubtractOrganizationCredits(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization with initial credits
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
		Credits:          500,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test subtracting credits (normal case)
	subtractReq := SubtractCreditsRequest{
		Credits: 200,
	}

	body, _ := json.Marshal(subtractReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123/credits/subtract", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, 300, response.Credits) // 500 - 200

	// Verify in database
	var updatedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&updatedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, 300, updatedOrg.Credits)
}

func TestSubtractOrganizationCreditsFloorAtZero(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization with low credits
	org := models.Organization{
		ObjectID:         "test-org-123",
		OrganizationName: "Test Organization",
		Credits:          50,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test subtracting more credits than available (should floor at 0)
	subtractReq := SubtractCreditsRequest{
		Credits: 100, // More than the 50 available
	}

	body, _ := json.Marshal(subtractReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123/credits/subtract", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var response OrganizationResponse
	err = json.NewDecoder(resp.Body).Decode(&response)
	assert.NoError(t, err)
	assert.Equal(t, 0, response.Credits) // Should be 0, not negative

	// Verify in database
	var updatedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-123").First(&updatedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, 0, updatedOrg.Credits)
}

func TestSubtractOrganizationCreditsValidation(t *testing.T) {
	db, _, app := setupOrganizationTestEnv()

	// Create test organization
	org := models.Organization{
		ObjectID: "test-org-123",
		Credits:  100,
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Test with zero credits (should fail)
	subtractReq := SubtractCreditsRequest{
		Credits: 0,
	}

	body, _ := json.Marshal(subtractReq)
	req, _ := http.NewRequest("PATCH", "/api/v1/org/test-org-123/credits/subtract", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	// Verify error message mentions positive integer
	var errorResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&errorResp)
	assert.NoError(t, err)
	assert.Contains(t, errorResp["error"], "positive")
}

// Helper function to create string pointers for patch requests
func stringPtr(s string) *string {
	return &s
}

func TestOrganizationDefaultCredits(t *testing.T) {
	db, _, _ := setupOrganizationTestEnv()

	// Create organization without specifying credits
	org := models.Organization{
		ObjectID:         "test-org-default",
		OrganizationName: "Test Organization",
		// Credits not specified - should get default value
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Verify default credits were set
	var savedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-default").First(&savedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, 200, savedOrg.Credits)
}

func TestOrganizationExplicitCredits(t *testing.T) {
	db, _, _ := setupOrganizationTestEnv()

	// Create organization with explicit credits
	org := models.Organization{
		ObjectID:         "test-org-explicit",
		OrganizationName: "Test Organization",
		Credits:          1000, // Explicit value
	}
	err := db.Create(&org).Error
	assert.NoError(t, err)

	// Verify explicit credits were preserved
	var savedOrg models.Organization
	err = db.Where("object_id = ?", "test-org-explicit").First(&savedOrg).Error
	assert.NoError(t, err)
	assert.Equal(t, 1000, savedOrg.Credits)
}

// Helper function to create float64 pointers for patch requests
func float64Ptr(f float64) *float64 {
	return &f
}
