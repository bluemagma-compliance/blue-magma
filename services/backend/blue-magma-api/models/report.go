package models

import (
	"gorm.io/gorm"
)

// Report represents a compliance report for an organization
type Report struct {
	gorm.Model
	ObjectID       string       `gorm:"not null;unique" json:"object_id"`                                                 // Unique identifier for the report
	OrganizationID uint         `json:"organization_id"`                                                                  // Foreign key to Organization
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID;" json:"-"` // Foreign key to Organization

	ReportTemplateID uint           `json:"report_template_id"`                                      // ID of the template used for the report
	ReportTemplate   ReportTemplate `gorm:"constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"-"` // Foreign key to Template

	Name        string `json:"name"`        // Name of the report
	Description string `json:"description"` // Description of the report
	Status      string `json:"status"`      // Status of the report (e.g., "draft", "finalized")

	// Summary fields
	Summary              string  `json:"summary"`                // Executive summary text
	CompliantCount       int     `json:"compliant_count"`        // Number of compliant rulings
	NonCompliantCount    int     `json:"non_compliant_count"`    // Number of non-compliant rulings
	IndeterminateCount   int     `json:"indeterminate_count"`    // Number of warning/indeterminate rulings
	TotalRulingsCount    int     `json:"total_rulings_count"`    // Total number of rulings
	CompliancePercentage float64 `json:"compliance_percentage"`  // Percentage of compliant rulings
}
