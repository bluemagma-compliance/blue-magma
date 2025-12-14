// Mock HIPAA Compliance Report Data
export const mockHipaaReport = [
  {
    description:
      "Comprehensive HIPAA compliance assessment covering administrative, physical, and technical safeguards for healthcare data protection",
    name: "HIPAA Compliance Assessment - Q4 2024",
    object_id: "report_hipaa_001",
    sections: [
      {
        description:
          "Administrative safeguards for protecting electronic protected health information (ePHI)",
        name: "Administrative Safeguards",
        object_id: "section_admin_001",
        report_id: "report_hipaa_001",
        rulings: [
          {
            decision: "NON_COMPLIANT",
            level: "HIGH",
            object_id: "ruling_admin_001",
            organization_id: "org_001",
            questions: [
              {
                answer: "No formal security officer has been designated",
                found_properties: [
                  {
                    is_issue: true,
                    issue_severity: "HIGH",
                    key: "security_officer_designation",
                    object_id: "prop_001",
                    organization_id: "org_001",
                    property_type: "POLICY_DOCUMENT",
                    question_id: "q_admin_001",
                    value: "MISSING",
                  },
                ],
                object_id: "q_admin_001",
                organization_id: "org_001",
                question:
                  "Has a security officer been designated to develop and implement security policies and procedures?",
              },
            ],
            reasoning:
              "HIPAA requires designation of a security officer responsible for developing and implementing security policies. No evidence found of formal designation.",
            rule_id: "hipaa_164_308_a_2",
            status: "FAILED",
          },
          {
            decision: "COMPLIANT",
            level: "MEDIUM",
            object_id: "ruling_admin_002",
            organization_id: "org_001",
            questions: [
              {
                answer:
                  "Access management procedures are documented and implemented",
                found_properties: [
                  {
                    is_issue: false,
                    issue_severity: "NONE",
                    key: "access_management_policy",
                    object_id: "prop_002",
                    organization_id: "org_001",
                    property_type: "POLICY_DOCUMENT",
                    question_id: "q_admin_002",
                    value: "PRESENT",
                  },
                ],
                object_id: "q_admin_002",
                organization_id: "org_001",
                question:
                  "Are there documented procedures for granting access to ePHI?",
              },
            ],
            reasoning:
              "Access management procedures are properly documented and align with HIPAA requirements for controlling access to ePHI.",
            rule_id: "hipaa_164_308_a_4",
            status: "PASSED",
          },
        ],
      },
      {
        description:
          "Physical safeguards to protect electronic systems and equipment containing ePHI",
        name: "Physical Safeguards",
        object_id: "section_physical_001",
        report_id: "report_hipaa_001",
        rulings: [
          {
            decision: "PARTIALLY_COMPLIANT",
            level: "MEDIUM",
            object_id: "ruling_physical_001",
            organization_id: "org_001",
            questions: [
              {
                answer: "Some workstations lack automatic screen locks",
                found_properties: [
                  {
                    is_issue: true,
                    issue_severity: "MEDIUM",
                    key: "workstation_security",
                    object_id: "prop_003",
                    organization_id: "org_001",
                    property_type: "SYSTEM_CONFIGURATION",
                    question_id: "q_physical_001",
                    value: "PARTIAL",
                  },
                ],
                object_id: "q_physical_001",
                organization_id: "org_001",
                question:
                  "Are workstations that access ePHI configured with automatic screen locks?",
              },
            ],
            reasoning:
              "Most workstations have proper screen lock configuration, but 3 out of 15 workstations were found without automatic screen locks enabled.",
            rule_id: "hipaa_164_310_b",
            status: "PARTIAL",
          },
        ],
      },
      {
        description:
          "Technical safeguards to control access to ePHI and protect it from unauthorized access",
        name: "Technical Safeguards",
        object_id: "section_technical_001",
        report_id: "report_hipaa_001",
        rulings: [
          {
            decision: "NON_COMPLIANT",
            level: "CRITICAL",
            object_id: "ruling_technical_001",
            organization_id: "org_001",
            questions: [
              {
                answer:
                  "Database encryption is not implemented for ePHI storage",
                found_properties: [
                  {
                    is_issue: true,
                    issue_severity: "CRITICAL",
                    key: "database_encryption",
                    object_id: "prop_004",
                    organization_id: "org_001",
                    property_type: "DATABASE_CONFIGURATION",
                    question_id: "q_technical_001",
                    value: "DISABLED",
                  },
                ],
                object_id: "q_technical_001",
                organization_id: "org_001",
                question: "Is ePHI encrypted when stored in databases?",
              },
            ],
            reasoning:
              "Patient health information is stored in unencrypted databases, creating significant risk of data exposure in case of unauthorized access.",
            rule_id: "hipaa_164_312_a_2_iv",
            status: "FAILED",
          },
          {
            decision: "COMPLIANT",
            level: "HIGH",
            object_id: "ruling_technical_002",
            organization_id: "org_001",
            questions: [
              {
                answer: "Audit logs are properly configured and monitored",
                found_properties: [
                  {
                    is_issue: false,
                    issue_severity: "NONE",
                    key: "audit_logging",
                    object_id: "prop_005",
                    organization_id: "org_001",
                    property_type: "SYSTEM_CONFIGURATION",
                    question_id: "q_technical_002",
                    value: "ENABLED",
                  },
                ],
                object_id: "q_technical_002",
                organization_id: "org_001",
                question:
                  "Are audit logs implemented to record access to ePHI?",
              },
            ],
            reasoning:
              "Comprehensive audit logging is in place with proper monitoring and retention policies that meet HIPAA requirements.",
            rule_id: "hipaa_164_312_b",
            status: "PASSED",
          },
        ],
      },
    ],
    status: "NON_COMPLIANT",
    template_id: "template_hipaa_001",
  },
];

export default mockHipaaReport;
