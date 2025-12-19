package models

import "gorm.io/gorm"

type Organization struct {
	gorm.Model
	ObjectID string `gorm:"not null;unique" json:"object_id"`

	// Organization information
	OrganizationName        string `json:"organization_name"`
	OrganizationDescription string `json:"organization_description"`

	OrganizationAddress    string `json:"organization_address"`
	OrganizationCity       string `json:"organization_city"`
	OrganizationState      string `json:"organization_state"`
	OrganizationPostalCode string `json:"organization_postal_code"`
	OrganizationCountry    string `json:"organization_country"`

	// Organization profile fields
	OrganizationWhat                string `json:"organization_what"`                          // What the organization does
	OrganizationSize                string `json:"organization_size"`                          // Organization size (e.g., "1-10", "11-50", etc.)
	OrganizationIndustry            string `json:"organization_industry"`                      // Industry sector
	OrganizationLocation            string `json:"organization_location"`                      // Primary location
	OrganizationGoals               string `json:"organization_goals"`                         // Organization goals
	OrganizationImportantDataTypes  string `json:"organization_important_data_types"`          // Important data types or info stored by the organization
	OrganizationCustomerProfile     string `json:"organization_customer_profile"`              // High-level description of the organization's customers
	OrganizationSecurityMotivations string `json:"organization_security_motivations"`          // Motivations and drivers for security/compliance
	OrganizationStructureOwnership  string `json:"organization_structure_ownership"`           // How security/compliance ownership is structured
	OrganizationTechnicalStack      string `json:"organization_technical_stack"`               // High-level description of the technical stack
	OrganizationSecurityFrameworks  string `json:"organization_security_frameworks"`           // Active/wanted security frameworks
	OrganizationRelevantLaws        string `json:"organization_relevant_laws"`                 // Regulations they need to follow
	OrganizationPastIssues          string `json:"past_issues"`                                // Past issues or problems
	OrganizationPreviousWork        string `json:"previous_work"`                              // Previous compliance/security work
	OnboardStatus                   string `gorm:"default:'onboarding'" json:"onboard_status"` // Onboarding status (default: "onboarding")

	// Optional billing information
	StripeCustomerID      string  `json:"stripe_customer_id"`
	BillingEmail          string  `json:"billing_email"`
	StripeSubscriptionID  string  `json:"stripe_subscription_id"`
	StripePaymentMethodID string  `json:"stripe_payment_method_id"`
	CurrentPlan           string  `json:"current_plan" gorm:"default:'free'"`
	Credits               int     `json:"credits" gorm:"default:200"`
	MonthlyCost           float64 `json:"monthly_cost" gorm:"default:0.0"`
	SubscriptionStatus    string  `json:"subscription_status" gorm:"default:'active'"`
	NextBillingDate       string  `json:"next_billing_date" gorm:"default:N/A"`

	// Cumulative credit movement tracking. These counters are incremented only
	// by the dedicated add/subtract credits endpoints; they are not adjusted by
	// direct credits overrides so we preserve a clear history of explicit
	// adjustments.
	TotalCreditsAdded      int `json:"total_credits_added" gorm:"default:0"`
	TotalCreditsSubtracted int `json:"total_credits_subtracted" gorm:"default:0"`

	// Public commitment sharing flag – controls whether the organization exposes
	// its in-progress security/compliance commitment via the public commitment
	// endpoint.
	ShareCommitment bool `json:"share_commitment" gorm:"default:false"`

	// Partners indicates whether this organization is a partner account. This
	// flag is intentionally not writable via public organization write
	// endpoints; it is only exposed on GET responses.
	Partners bool `json:"partners" gorm:"default:false"`
}

// Before delete hook to delete all associated Codebases
func (o *Organization) BeforeDelete(tx *gorm.DB) (err error) {
	// Get all associated Codebases
	var codebases []Codebase
	if err := tx.Where("organization_id = ?", o.ID).Find(&codebases).Error; err != nil {
		return err
	}
	// Delete each Codebase (which will cascade to CodebaseVersions)
	for _, codebase := range codebases {
		if err := tx.Unscoped().Delete(&codebase).Error; err != nil {
			return err
		}
	}
	return nil
}

// BeforeCreate hook to set default values for new organizations
func (o *Organization) BeforeCreate(tx *gorm.DB) (err error) {
	// Set default credits if not specified
	if o.Credits == 0 {
		o.Credits = 200
	}
	return nil
}
