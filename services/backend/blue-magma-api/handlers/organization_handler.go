package handlers

import (
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	log "github.com/sirupsen/logrus"
)

// OrganizationHandler handles organization-related requests
type OrganizationHandler struct {
	DB        *gorm.DB
	Validator *validator.Validate
}

// NewOrganizationHandler creates a new OrganizationHandler instance
func NewOrganizationHandler(db *gorm.DB) *OrganizationHandler {
	return &OrganizationHandler{
		DB:        db,
		Validator: validator.New(),
	}
}

// OrganizationResponse represents the response structure for organization data
type OrganizationResponse struct {
	ObjectID                        string  `json:"object_id"`
	OrganizationName                string  `json:"organization_name"`
	OrganizationDescription         string  `json:"organization_description"`
	OrganizationAddress             string  `json:"organization_address"`
	OrganizationCity                string  `json:"organization_city"`
	OrganizationState               string  `json:"organization_state"`
	OrganizationPostalCode          string  `json:"organization_postal_code"`
	OrganizationCountry             string  `json:"organization_country"`
	OrganizationWhat                string  `json:"organization_what"`
	OrganizationSize                string  `json:"organization_size"`
	OrganizationIndustry            string  `json:"organization_industry"`
	OrganizationLocation            string  `json:"organization_location"`
	OrganizationGoals               string  `json:"organization_goals"`
	OrganizationImportantDataTypes  string  `json:"organization_important_data_types"`
	OrganizationCustomerProfile     string  `json:"organization_customer_profile"`
	OrganizationSecurityMotivations string  `json:"organization_security_motivations"`
	OrganizationStructureOwnership  string  `json:"organization_structure_ownership"`
	OrganizationTechnicalStack      string  `json:"organization_technical_stack"`
	OrganizationSecurityFrameworks  string  `json:"organization_security_frameworks"`
	OrganizationRelevantLaws        string  `json:"organization_relevant_laws"`
	PastIssues                      string  `json:"past_issues"`
	PreviousWork                    string  `json:"previous_work"`
	OnboardStatus                   string  `json:"onboard_status"`
	StripeCustomerID                string  `json:"stripe_customer_id"`
	BillingEmail                    string  `json:"billing_email"`
	StripeSubscriptionID            string  `json:"stripe_subscription_id"`
	StripePaymentMethodID           string  `json:"stripe_payment_method_id"`
	CurrentPlan                     string  `json:"current_plan"`
	Credits                         int     `json:"credits"`
	MonthlyCost                     float64 `json:"monthly_cost"`
	SubscriptionStatus              string  `json:"subscription_status"`
	NextBillingDate                 string  `json:"next_billing_date"`
	ShareCommitment                 bool    `json:"share_commitment"`
	Partners                        bool    `json:"partners"`
	TotalCreditsAdded               int     `json:"total_credits_added"`
	TotalCreditsSubtracted          int     `json:"total_credits_subtracted"`
}

// UpdateOrganizationRequest represents the request structure for updating organization data (DEPRECATED - use UpdateOrganizationRequestPUT)
// Note: Credits field is intentionally excluded as it should not be user-editable
type UpdateOrganizationRequest struct {
	OrganizationName        string `json:"organization_name"`
	OrganizationDescription string `json:"organization_description"`
	OrganizationAddress     string `json:"organization_address"`
	OrganizationCity        string `json:"organization_city"`
	OrganizationState       string `json:"organization_state"`
	OrganizationPostalCode  string `json:"organization_postal_code"`
	OrganizationCountry     string `json:"organization_country"`
	StripeCustomerID        string `json:"stripe_customer_id"`
	BillingEmail            string `json:"billing_email"`
	StripeSubscriptionID    string `json:"stripe_subscription_id"`
	StripePaymentMethodID   string `json:"stripe_payment_method_id"`
	CurrentPlan             string `json:"current_plan"`
}

// UpdateOrganizationRequestPUT represents the request structure for PUT updates (all fields required)
// Note: Credits field is intentionally excluded as it should not be user-editable
type UpdateOrganizationRequestPUT struct {
	OrganizationName                string  `json:"organization_name" validate:"required"`
	OrganizationDescription         string  `json:"organization_description" validate:"required"`
	OrganizationAddress             string  `json:"organization_address" validate:"required"`
	OrganizationCity                string  `json:"organization_city" validate:"required"`
	OrganizationState               string  `json:"organization_state" validate:"required"`
	OrganizationPostalCode          string  `json:"organization_postal_code" validate:"required"`
	OrganizationCountry             string  `json:"organization_country" validate:"required"`
	OrganizationWhat                string  `json:"organization_what" validate:"required"`
	OrganizationSize                string  `json:"organization_size" validate:"required"`
	OrganizationIndustry            string  `json:"organization_industry" validate:"required"`
	OrganizationLocation            string  `json:"organization_location" validate:"required"`
	OrganizationGoals               string  `json:"organization_goals" validate:"required"`
	OrganizationImportantDataTypes  string  `json:"organization_important_data_types" validate:"required"`
	OrganizationCustomerProfile     string  `json:"organization_customer_profile" validate:"required"`
	OrganizationSecurityMotivations string  `json:"organization_security_motivations" validate:"required"`
	OrganizationStructureOwnership  string  `json:"organization_structure_ownership" validate:"required"`
	OrganizationTechnicalStack      string  `json:"organization_technical_stack" validate:"required"`
	OrganizationSecurityFrameworks  string  `json:"organization_security_frameworks" validate:"required"`
	OrganizationRelevantLaws        string  `json:"organization_relevant_laws" validate:"required"`
	PastIssues                      string  `json:"past_issues" validate:"required"`
	PreviousWork                    string  `json:"previous_work" validate:"required"`
	OnboardStatus                   string  `json:"onboard_status" validate:"required"`
	StripeCustomerID                string  `json:"stripe_customer_id" validate:"required"`
	BillingEmail                    string  `json:"billing_email" validate:"required,email"`
	StripeSubscriptionID            string  `json:"stripe_subscription_id" validate:"required"`
	StripePaymentMethodID           string  `json:"stripe_payment_method_id" validate:"required"`
	CurrentPlan                     string  `json:"current_plan" validate:"required"`
	MonthlyCost                     float64 `json:"monthly_cost" validate:"required,min=0"`
	SubscriptionStatus              string  `json:"subscription_status" validate:"required"`
	NextBillingDate                 string  `json:"next_billing_date" validate:"required"`
}

// PatchOrganizationRequest represents the request structure for PATCH updates (partial updates)
// Note: Credits field is intentionally excluded as it should not be user-editable
type PatchOrganizationRequest struct {
	OrganizationName                *string  `json:"organization_name,omitempty"`
	OrganizationDescription         *string  `json:"organization_description,omitempty"`
	OrganizationAddress             *string  `json:"organization_address,omitempty"`
	OrganizationCity                *string  `json:"organization_city,omitempty"`
	OrganizationState               *string  `json:"organization_state,omitempty"`
	OrganizationPostalCode          *string  `json:"organization_postal_code,omitempty"`
	OrganizationCountry             *string  `json:"organization_country,omitempty"`
	OrganizationWhat                *string  `json:"organization_what,omitempty"`
	OrganizationSize                *string  `json:"organization_size,omitempty"`
	OrganizationIndustry            *string  `json:"organization_industry,omitempty"`
	OrganizationLocation            *string  `json:"organization_location,omitempty"`
	OrganizationGoals               *string  `json:"organization_goals,omitempty"`
	OrganizationImportantDataTypes  *string  `json:"organization_important_data_types,omitempty"`
	OrganizationCustomerProfile     *string  `json:"organization_customer_profile,omitempty"`
	OrganizationSecurityMotivations *string  `json:"organization_security_motivations,omitempty"`
	OrganizationStructureOwnership  *string  `json:"organization_structure_ownership,omitempty"`
	OrganizationTechnicalStack      *string  `json:"organization_technical_stack,omitempty"`
	OrganizationSecurityFrameworks  *string  `json:"organization_security_frameworks,omitempty"`
	OrganizationRelevantLaws        *string  `json:"organization_relevant_laws,omitempty"`
	PastIssues                      *string  `json:"past_issues,omitempty"`
	PreviousWork                    *string  `json:"previous_work,omitempty"`
	OnboardStatus                   *string  `json:"onboard_status,omitempty"`
	StripeCustomerID                *string  `json:"stripe_customer_id,omitempty"`
	BillingEmail                    *string  `json:"billing_email,omitempty" validate:"omitempty,email"`
	StripeSubscriptionID            *string  `json:"stripe_subscription_id,omitempty"`
	StripePaymentMethodID           *string  `json:"stripe_payment_method_id,omitempty"`
	CurrentPlan                     *string  `json:"current_plan,omitempty"`
	MonthlyCost                     *float64 `json:"monthly_cost,omitempty" validate:"omitempty,min=0"`
	SubscriptionStatus              *string  `json:"subscription_status,omitempty"`
	NextBillingDate                 *string  `json:"next_billing_date,omitempty"`
	ShareCommitment                 *bool    `json:"share_commitment,omitempty"`
}

// UpdateCreditsRequest represents the request structure for updating organization credits
type UpdateCreditsRequest struct {
	Credits int `json:"credits" validate:"required,min=0"`
}

// AddCreditsRequest represents the request structure for adding credits to organization
type AddCreditsRequest struct {
	Credits int `json:"credits" validate:"min=1"`
}

// SubtractCreditsRequest represents the request structure for subtracting credits from organization
type SubtractCreditsRequest struct {
	Credits int `json:"credits" validate:"min=1"`
}

// GetOrganization retrieves organization details
// @Summary Get organization details
// @Description Get organization details by organization ID
// @Tags organization
// @Produce json
// @Param org_id path string true "Organization ID"
// @Success 200 {object} OrganizationResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id} [get]
// @Security Bearer
func (h *OrganizationHandler) GetOrganization(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %s", orgId)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to retrieve organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	response := OrganizationResponse{
		ObjectID:                        org.ObjectID,
		OrganizationName:                org.OrganizationName,
		OrganizationDescription:         org.OrganizationDescription,
		OrganizationAddress:             org.OrganizationAddress,
		OrganizationCity:                org.OrganizationCity,
		OrganizationState:               org.OrganizationState,
		OrganizationPostalCode:          org.OrganizationPostalCode,
		OrganizationCountry:             org.OrganizationCountry,
		OrganizationWhat:                org.OrganizationWhat,
		OrganizationSize:                org.OrganizationSize,
		OrganizationIndustry:            org.OrganizationIndustry,
		OrganizationLocation:            org.OrganizationLocation,
		OrganizationGoals:               org.OrganizationGoals,
		OrganizationImportantDataTypes:  org.OrganizationImportantDataTypes,
		OrganizationCustomerProfile:     org.OrganizationCustomerProfile,
		OrganizationSecurityMotivations: org.OrganizationSecurityMotivations,
		OrganizationStructureOwnership:  org.OrganizationStructureOwnership,
		OrganizationTechnicalStack:      org.OrganizationTechnicalStack,
		OrganizationSecurityFrameworks:  org.OrganizationSecurityFrameworks,
		OrganizationRelevantLaws:        org.OrganizationRelevantLaws,
		PastIssues:                      org.OrganizationPastIssues,
		PreviousWork:                    org.OrganizationPreviousWork,
		OnboardStatus:                   org.OnboardStatus,
		StripeCustomerID:                org.StripeCustomerID,
		BillingEmail:                    org.BillingEmail,
		StripeSubscriptionID:            org.StripeSubscriptionID,
		StripePaymentMethodID:           org.StripePaymentMethodID,
		CurrentPlan:                     org.CurrentPlan,
		Credits:                         org.Credits,
		MonthlyCost:                     org.MonthlyCost,
		SubscriptionStatus:              org.SubscriptionStatus,
		NextBillingDate:                 org.NextBillingDate,
		ShareCommitment:                 org.ShareCommitment,
		Partners:                        org.Partners,
		TotalCreditsAdded:               org.TotalCreditsAdded,
		TotalCreditsSubtracted:          org.TotalCreditsSubtracted,
	}

	return c.JSON(response)
}

// UpdateOrganization updates organization details (owner only, credits excluded) - requires all fields
// @Summary Update organization details (PUT - all fields required)
// @Description Update organization details by organization ID (owner only, credits field is read-only). All fields are required for PUT requests.
// @Tags organization
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param organization body UpdateOrganizationRequestPUT true "Organization update data (all fields required)"
// @Success 200 {object} OrganizationResponse
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id} [put]
// @Security Bearer
func (h *OrganizationHandler) UpdateOrganization(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var req UpdateOrganizationRequestPUT
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate required fields
	if err := h.Validator.Struct(&req); err != nil {
		log.Errorf("Validation failed: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "All fields are required for PUT requests", "details": err.Error()})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %s", orgId)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to retrieve organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	// Update organization fields (excluding credits)
	org.OrganizationName = req.OrganizationName
	org.OrganizationDescription = req.OrganizationDescription
	org.OrganizationAddress = req.OrganizationAddress
	org.OrganizationCity = req.OrganizationCity
	org.OrganizationState = req.OrganizationState
	org.OrganizationPostalCode = req.OrganizationPostalCode
	org.OrganizationCountry = req.OrganizationCountry
	org.OrganizationWhat = req.OrganizationWhat
	org.OrganizationSize = req.OrganizationSize
	org.OrganizationIndustry = req.OrganizationIndustry
	org.OrganizationLocation = req.OrganizationLocation
	org.OrganizationGoals = req.OrganizationGoals
	org.OrganizationImportantDataTypes = req.OrganizationImportantDataTypes
	org.OrganizationCustomerProfile = req.OrganizationCustomerProfile
	org.OrganizationSecurityMotivations = req.OrganizationSecurityMotivations
	org.OrganizationStructureOwnership = req.OrganizationStructureOwnership
	org.OrganizationTechnicalStack = req.OrganizationTechnicalStack
	org.OrganizationSecurityFrameworks = req.OrganizationSecurityFrameworks
	org.OrganizationRelevantLaws = req.OrganizationRelevantLaws
	org.OrganizationPastIssues = req.PastIssues
	org.OrganizationPreviousWork = req.PreviousWork
	org.OnboardStatus = req.OnboardStatus
	org.StripeCustomerID = req.StripeCustomerID
	org.BillingEmail = req.BillingEmail
	org.StripeSubscriptionID = req.StripeSubscriptionID
	org.StripePaymentMethodID = req.StripePaymentMethodID
	org.CurrentPlan = req.CurrentPlan
	org.MonthlyCost = req.MonthlyCost
	org.SubscriptionStatus = req.SubscriptionStatus
	org.NextBillingDate = req.NextBillingDate

	if err := h.DB.Save(&org).Error; err != nil {
		log.Errorf("Failed to update organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update organization"})
	}

	response := OrganizationResponse{
		ObjectID:                        org.ObjectID,
		OrganizationName:                org.OrganizationName,
		OrganizationDescription:         org.OrganizationDescription,
		OrganizationAddress:             org.OrganizationAddress,
		OrganizationCity:                org.OrganizationCity,
		OrganizationState:               org.OrganizationState,
		OrganizationPostalCode:          org.OrganizationPostalCode,
		OrganizationCountry:             org.OrganizationCountry,
		OrganizationWhat:                org.OrganizationWhat,
		OrganizationSize:                org.OrganizationSize,
		OrganizationIndustry:            org.OrganizationIndustry,
		OrganizationLocation:            org.OrganizationLocation,
		OrganizationGoals:               org.OrganizationGoals,
		OrganizationImportantDataTypes:  org.OrganizationImportantDataTypes,
		OrganizationCustomerProfile:     org.OrganizationCustomerProfile,
		OrganizationSecurityMotivations: org.OrganizationSecurityMotivations,
		OrganizationStructureOwnership:  org.OrganizationStructureOwnership,
		OrganizationTechnicalStack:      org.OrganizationTechnicalStack,
		OrganizationSecurityFrameworks:  org.OrganizationSecurityFrameworks,
		OrganizationRelevantLaws:        org.OrganizationRelevantLaws,
		PastIssues:                      org.OrganizationPastIssues,
		PreviousWork:                    org.OrganizationPreviousWork,
		OnboardStatus:                   org.OnboardStatus,
		StripeCustomerID:                org.StripeCustomerID,
		BillingEmail:                    org.BillingEmail,
		StripeSubscriptionID:            org.StripeSubscriptionID,
		StripePaymentMethodID:           org.StripePaymentMethodID,
		CurrentPlan:                     org.CurrentPlan,
		Credits:                         org.Credits,
		MonthlyCost:                     org.MonthlyCost,
		SubscriptionStatus:              org.SubscriptionStatus,
		NextBillingDate:                 org.NextBillingDate,
		ShareCommitment:                 org.ShareCommitment,
		Partners:                        org.Partners,
		TotalCreditsAdded:               org.TotalCreditsAdded,
		TotalCreditsSubtracted:          org.TotalCreditsSubtracted,
	}

	return c.JSON(response)
}

// PatchOrganization partially updates organization details (owner only, credits excluded)
// @Summary Partially update organization details
// @Description Partially update organization details by organization ID (owner only, credits field is read-only). Only provided fields will be updated.
// @Tags organization
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param organization body PatchOrganizationRequest true "Organization partial update data"
// @Success 200 {object} OrganizationResponse
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id} [patch]
// @Security Bearer
func (h *OrganizationHandler) PatchOrganization(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var req PatchOrganizationRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate fields that are provided (email validation if provided)
	if err := h.Validator.Struct(&req); err != nil {
		log.Errorf("Validation failed: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Validation failed", "details": err.Error()})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %s", orgId)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to retrieve organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	// Update only provided fields
	if req.OrganizationName != nil {
		org.OrganizationName = *req.OrganizationName
	}
	if req.OrganizationDescription != nil {
		org.OrganizationDescription = *req.OrganizationDescription
	}
	if req.OrganizationAddress != nil {
		org.OrganizationAddress = *req.OrganizationAddress
	}
	if req.OrganizationCity != nil {
		org.OrganizationCity = *req.OrganizationCity
	}
	if req.OrganizationState != nil {
		org.OrganizationState = *req.OrganizationState
	}
	if req.OrganizationPostalCode != nil {
		org.OrganizationPostalCode = *req.OrganizationPostalCode
	}
	if req.OrganizationCountry != nil {
		org.OrganizationCountry = *req.OrganizationCountry
	}
	if req.OrganizationWhat != nil {
		org.OrganizationWhat = *req.OrganizationWhat
	}
	if req.OrganizationSize != nil {
		org.OrganizationSize = *req.OrganizationSize
	}
	if req.OrganizationIndustry != nil {
		org.OrganizationIndustry = *req.OrganizationIndustry
	}
	if req.OrganizationLocation != nil {
		org.OrganizationLocation = *req.OrganizationLocation
	}
	if req.OrganizationGoals != nil {
		org.OrganizationGoals = *req.OrganizationGoals
	}
	if req.OrganizationImportantDataTypes != nil {
		org.OrganizationImportantDataTypes = *req.OrganizationImportantDataTypes
	}
	if req.OrganizationCustomerProfile != nil {
		org.OrganizationCustomerProfile = *req.OrganizationCustomerProfile
	}
	if req.OrganizationSecurityMotivations != nil {
		org.OrganizationSecurityMotivations = *req.OrganizationSecurityMotivations
	}
	if req.OrganizationStructureOwnership != nil {
		org.OrganizationStructureOwnership = *req.OrganizationStructureOwnership
	}
	if req.OrganizationTechnicalStack != nil {
		org.OrganizationTechnicalStack = *req.OrganizationTechnicalStack
	}
	if req.OrganizationSecurityFrameworks != nil {
		org.OrganizationSecurityFrameworks = *req.OrganizationSecurityFrameworks
	}
	if req.OrganizationRelevantLaws != nil {
		org.OrganizationRelevantLaws = *req.OrganizationRelevantLaws
	}
	if req.PastIssues != nil {
		org.OrganizationPastIssues = *req.PastIssues
	}
	if req.PreviousWork != nil {
		org.OrganizationPreviousWork = *req.PreviousWork
	}
	if req.OnboardStatus != nil {
		org.OnboardStatus = *req.OnboardStatus
	}
	if req.StripeCustomerID != nil {
		org.StripeCustomerID = *req.StripeCustomerID
	}
	if req.BillingEmail != nil {
		org.BillingEmail = *req.BillingEmail
	}
	if req.StripeSubscriptionID != nil {
		org.StripeSubscriptionID = *req.StripeSubscriptionID
	}
	if req.StripePaymentMethodID != nil {
		org.StripePaymentMethodID = *req.StripePaymentMethodID
	}
	if req.CurrentPlan != nil {
		org.CurrentPlan = *req.CurrentPlan
	}
	if req.MonthlyCost != nil {
		org.MonthlyCost = *req.MonthlyCost
	}
	if req.SubscriptionStatus != nil {
		org.SubscriptionStatus = *req.SubscriptionStatus
	}
	if req.NextBillingDate != nil {
		org.NextBillingDate = *req.NextBillingDate
	}
	if req.ShareCommitment != nil {
		org.ShareCommitment = *req.ShareCommitment
	}

	if err := h.DB.Save(&org).Error; err != nil {
		log.Errorf("Failed to update organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update organization"})
	}

	response := OrganizationResponse{
		ObjectID:                       org.ObjectID,
		OrganizationName:               org.OrganizationName,
		OrganizationDescription:        org.OrganizationDescription,
		OrganizationAddress:            org.OrganizationAddress,
		OrganizationCity:               org.OrganizationCity,
		OrganizationState:              org.OrganizationState,
		OrganizationPostalCode:         org.OrganizationPostalCode,
		OrganizationCountry:            org.OrganizationCountry,
		OrganizationWhat:               org.OrganizationWhat,
		OrganizationSize:               org.OrganizationSize,
		OrganizationIndustry:           org.OrganizationIndustry,
		OrganizationLocation:           org.OrganizationLocation,
		OrganizationGoals:              org.OrganizationGoals,
		OrganizationImportantDataTypes: org.OrganizationImportantDataTypes,
		OrganizationSecurityFrameworks: org.OrganizationSecurityFrameworks,
		OrganizationRelevantLaws:       org.OrganizationRelevantLaws,
		PastIssues:                     org.OrganizationPastIssues,
		PreviousWork:                   org.OrganizationPreviousWork,
		OnboardStatus:                  org.OnboardStatus,
		StripeCustomerID:               org.StripeCustomerID,
		BillingEmail:                   org.BillingEmail,
		StripeSubscriptionID:           org.StripeSubscriptionID,
		StripePaymentMethodID:          org.StripePaymentMethodID,
		CurrentPlan:                    org.CurrentPlan,
		Credits:                        org.Credits,
		MonthlyCost:                    org.MonthlyCost,
		SubscriptionStatus:             org.SubscriptionStatus,
		NextBillingDate:                org.NextBillingDate,
		ShareCommitment:                org.ShareCommitment,
		Partners:                       org.Partners,
		TotalCreditsAdded:              org.TotalCreditsAdded,
		TotalCreditsSubtracted:         org.TotalCreditsSubtracted,
	}

	return c.JSON(response)
}

// UpdateOrganizationCredits updates only the credits field for an organization (admin only)
// @Summary Update organization credits
// @Description Update only the credits field for an organization by organization ID (admin only)
// @Tags organization
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param credits body UpdateCreditsRequest true "Credits update data"
// @Success 200 {object} OrganizationResponse
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/credits [patch]
// @Security Bearer
func (h *OrganizationHandler) UpdateOrganizationCredits(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var req UpdateCreditsRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate credits value
	if err := h.Validator.Struct(&req); err != nil {
		log.Errorf("Validation failed: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Credits must be a non-negative integer", "details": err.Error()})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %s", orgId)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to retrieve organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	// Update only the credits field
	org.Credits = req.Credits

	if err := h.DB.Save(&org).Error; err != nil {
		log.Errorf("Failed to update organization credits: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update organization credits"})
	}

	response := OrganizationResponse{
		ObjectID:                       org.ObjectID,
		OrganizationName:               org.OrganizationName,
		OrganizationDescription:        org.OrganizationDescription,
		OrganizationAddress:            org.OrganizationAddress,
		OrganizationCity:               org.OrganizationCity,
		OrganizationState:              org.OrganizationState,
		OrganizationPostalCode:         org.OrganizationPostalCode,
		OrganizationCountry:            org.OrganizationCountry,
		OrganizationWhat:               org.OrganizationWhat,
		OrganizationSize:               org.OrganizationSize,
		OrganizationIndustry:           org.OrganizationIndustry,
		OrganizationLocation:           org.OrganizationLocation,
		OrganizationGoals:              org.OrganizationGoals,
		OrganizationImportantDataTypes: org.OrganizationImportantDataTypes,
		OrganizationSecurityFrameworks: org.OrganizationSecurityFrameworks,
		OrganizationRelevantLaws:       org.OrganizationRelevantLaws,
		PastIssues:                     org.OrganizationPastIssues,
		PreviousWork:                   org.OrganizationPreviousWork,
		OnboardStatus:                  org.OnboardStatus,
		StripeCustomerID:               org.StripeCustomerID,
		BillingEmail:                   org.BillingEmail,
		StripeSubscriptionID:           org.StripeSubscriptionID,
		StripePaymentMethodID:          org.StripePaymentMethodID,
		CurrentPlan:                    org.CurrentPlan,
		Credits:                        org.Credits,
		MonthlyCost:                    org.MonthlyCost,
		SubscriptionStatus:             org.SubscriptionStatus,
		NextBillingDate:                org.NextBillingDate,
		ShareCommitment:                org.ShareCommitment,
		Partners:                       org.Partners,
		TotalCreditsAdded:              org.TotalCreditsAdded,
		TotalCreditsSubtracted:         org.TotalCreditsSubtracted,
	}

	return c.JSON(response)
}

// AddOrganizationCredits adds credits to an organization's existing balance (admin only)
// @Summary Add credits to organization
// @Description Add credits to an organization's existing balance by organization ID (admin only)
// @Tags organization
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param credits body AddCreditsRequest true "Credits to add"
// @Success 200 {object} OrganizationResponse
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/credits/add [patch]
// @Security Bearer
func (h *OrganizationHandler) AddOrganizationCredits(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var req AddCreditsRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate credits value
	if err := h.Validator.Struct(&req); err != nil {
		log.Errorf("Validation failed: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Credits must be a positive integer", "details": err.Error()})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %s", orgId)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to retrieve organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	// Add credits to existing balance and track cumulative additions
	org.Credits += req.Credits
	org.TotalCreditsAdded += req.Credits

	if err := h.DB.Save(&org).Error; err != nil {
		log.Errorf("Failed to add organization credits: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add organization credits"})
	}

	response := OrganizationResponse{
		ObjectID:                       org.ObjectID,
		OrganizationName:               org.OrganizationName,
		OrganizationDescription:        org.OrganizationDescription,
		OrganizationAddress:            org.OrganizationAddress,
		OrganizationCity:               org.OrganizationCity,
		OrganizationState:              org.OrganizationState,
		OrganizationPostalCode:         org.OrganizationPostalCode,
		OrganizationCountry:            org.OrganizationCountry,
		OrganizationWhat:               org.OrganizationWhat,
		OrganizationSize:               org.OrganizationSize,
		OrganizationIndustry:           org.OrganizationIndustry,
		OrganizationLocation:           org.OrganizationLocation,
		OrganizationGoals:              org.OrganizationGoals,
		OrganizationImportantDataTypes: org.OrganizationImportantDataTypes,
		OrganizationSecurityFrameworks: org.OrganizationSecurityFrameworks,
		OrganizationRelevantLaws:       org.OrganizationRelevantLaws,
		PastIssues:                     org.OrganizationPastIssues,
		PreviousWork:                   org.OrganizationPreviousWork,
		OnboardStatus:                  org.OnboardStatus,
		StripeCustomerID:               org.StripeCustomerID,
		BillingEmail:                   org.BillingEmail,
		StripeSubscriptionID:           org.StripeSubscriptionID,
		StripePaymentMethodID:          org.StripePaymentMethodID,
		CurrentPlan:                    org.CurrentPlan,
		Credits:                        org.Credits,
		MonthlyCost:                    org.MonthlyCost,
		SubscriptionStatus:             org.SubscriptionStatus,
		NextBillingDate:                org.NextBillingDate,
		ShareCommitment:                org.ShareCommitment,
		Partners:                       org.Partners,
		TotalCreditsAdded:              org.TotalCreditsAdded,
		TotalCreditsSubtracted:         org.TotalCreditsSubtracted,
	}

	return c.JSON(response)
}

// SubtractOrganizationCredits subtracts credits from an organization's balance (admin only)
// @Summary Subtract credits from organization
// @Description Subtract credits from an organization's balance by organization ID (admin only). Credits cannot go below 0.
// @Tags organization
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param credits body SubtractCreditsRequest true "Credits to subtract"
// @Success 200 {object} OrganizationResponse
// @Failure 400 {object} fiber.Map
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/credits/subtract [patch]
// @Security Bearer
func (h *OrganizationHandler) SubtractOrganizationCredits(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var req SubtractCreditsRequest
	if err := c.BodyParser(&req); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	// Validate credits value
	if err := h.Validator.Struct(&req); err != nil {
		log.Errorf("Validation failed: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Credits must be a positive integer", "details": err.Error()})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %s", orgId)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to retrieve organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	// Subtract credits but don't allow going below 0. Track how many credits
	// were actually removed so TotalCreditsSubtracted reflects real
	// deductions, not just requested amounts.
	newCredits := org.Credits - req.Credits
	if newCredits < 0 {
		newCredits = 0
	}
	removed := org.Credits - newCredits
	org.Credits = newCredits
	org.TotalCreditsSubtracted += removed

	if err := h.DB.Save(&org).Error; err != nil {
		log.Errorf("Failed to subtract organization credits: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to subtract organization credits"})
	}

	response := OrganizationResponse{
		ObjectID:                       org.ObjectID,
		OrganizationName:               org.OrganizationName,
		OrganizationDescription:        org.OrganizationDescription,
		OrganizationAddress:            org.OrganizationAddress,
		OrganizationCity:               org.OrganizationCity,
		OrganizationState:              org.OrganizationState,
		OrganizationPostalCode:         org.OrganizationPostalCode,
		OrganizationCountry:            org.OrganizationCountry,
		OrganizationWhat:               org.OrganizationWhat,
		OrganizationSize:               org.OrganizationSize,
		OrganizationIndustry:           org.OrganizationIndustry,
		OrganizationLocation:           org.OrganizationLocation,
		OrganizationGoals:              org.OrganizationGoals,
		OrganizationImportantDataTypes: org.OrganizationImportantDataTypes,
		OrganizationSecurityFrameworks: org.OrganizationSecurityFrameworks,
		OrganizationRelevantLaws:       org.OrganizationRelevantLaws,
		PastIssues:                     org.OrganizationPastIssues,
		PreviousWork:                   org.OrganizationPreviousWork,
		OnboardStatus:                  org.OnboardStatus,
		StripeCustomerID:               org.StripeCustomerID,
		BillingEmail:                   org.BillingEmail,
		StripeSubscriptionID:           org.StripeSubscriptionID,
		StripePaymentMethodID:          org.StripePaymentMethodID,
		CurrentPlan:                    org.CurrentPlan,
		Credits:                        org.Credits,
		MonthlyCost:                    org.MonthlyCost,
		SubscriptionStatus:             org.SubscriptionStatus,
		NextBillingDate:                org.NextBillingDate,
		ShareCommitment:                org.ShareCommitment,
		Partners:                       org.Partners,
	}

	return c.JSON(response)
}

// DeleteOrganization deletes an organization and all associated users (owner only)
// @Summary Delete organization
// @Description Delete organization by organization ID (owner only, cascades to all users)
// @Tags organization
// @Param org_id path string true "Organization ID"
// @Success 204
// @Failure 403 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id} [delete]
// @Security Bearer
func (h *OrganizationHandler) DeleteOrganization(c *fiber.Ctx) error {
	orgId := c.Params("org_id")

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %s", orgId)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to retrieve organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve organization"})
	}

	// Delete all users in the organization first (hard delete to satisfy DB FKs)
	if err := h.DB.Unscoped().Where("organization_id = ?", org.ID).Delete(&models.User{}).Error; err != nil {
		log.Errorf("Failed to delete users in organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete organization users"})
	}

	// Delete the organization (BeforeDelete hook will handle cascading to codebases)
	if err := h.DB.Unscoped().Delete(&org).Error; err != nil {
		log.Errorf("Failed to delete organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete organization"})
	}

	log.Infof("Organization deleted successfully: %s", orgId)
	return c.SendStatus(fiber.StatusNoContent)
}
