/**
 * FRONTEND MOCKUP DATA
 * This file contains mock SOC 2 documentation structure for demonstration purposes.
 * It shows how the documentation hierarchy should be organized with:
 * - General documentation pages
 * - Control pages (CC6.1, CC6.2, CC6.8)
 * - Evidence associated with each page
 * 
 * This is NOT production data - it's for UI/UX mockup purposes only.
 */

export interface MockDocumentPage {
  id: string;
  title: string;
  type: "general" | "control";
  content: string;
  description?: string;
  linkedPolicies?: string[];
  relevance?: string;
  evidence: MockEvidence[];
  evidenceRequests?: MockEvidenceRequest[]; // Requests for missing evidence
  children?: MockDocumentPage[];
}

export interface MockEvidenceSource {
  sourceId: string; // Unique identifier for the source
  queryType: "rag" | "sql" | "mongo" | "document"; // Type of query used to retrieve evidence
  query: string; // The actual query or document reference
}

export interface MockAuditorReview {
  id: string;
  auditorName: string; // Role-based name like "SOC2 General Auditor"
  auditorType: "ai"; // All auditors are AI
  date: string; // ISO date string
  status: "relevant" | "insufficient" | "irrelevant" | "outdated";
  reason: string; // Why this status was assigned
}

export interface MockEvidenceRequest {
  id: string;
  requestedBy: string; // AI auditor role name
  date: string; // ISO date string - when request was created
  reason: string; // Why this evidence is needed
  complianceImpact: string; // What lack of evidence could mean for compliance status
}

export interface MockEvidence {
  id: string;
  name: string;
  type: "policy" | "configuration" | "review" | "log" | "report" | "procedure";
  description: string;
  status: "verified" | "pending" | "expired";
  collectionName?: string;
  date: string; // ISO date string - when evidence was collected
  relevance: string; // Why this is relevant to the control
  sources: MockEvidenceSource[]; // Multiple sources for this evidence
  auditorReviews: MockAuditorReview[]; // Reviews from auditors
  data: MockEvidenceData; // Actual evidence data
}

export type MockEvidenceData =
  | { type: "quote"; content: string }
  | { type: "json"; content: Record<string, unknown> }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "chat"; messages: Array<{ timestamp: string; speaker: string; message: string }> }
  | { type: "logs"; entries: Array<{ timestamp: string; level: string; message: string }> };

/**
 * MOCKUP: SOC 2 Documentation Structure
 * Demonstrates the hierarchy and content organization
 */
export const SOC2_MOCKUP_STRUCTURE: MockDocumentPage[] = [
  {
    id: "soc2_overview",
    title: "SOC 2 Compliance Overview",
    type: "general",
    content: `# SOC 2 Compliance Overview

## What is SOC 2?

SOC 2 (Service Organization Control 2) is a compliance framework developed by the American Institute of CPAs (AICPA) that defines criteria for managing customer data based on five trust service criteria.

## The Five Trust Service Criteria

- **Security (CC)**: The system is protected against unauthorized access
- **Availability (A)**: The system is available for operation and use as committed
- **Processing Integrity (PI)**: System processing is complete, accurate, timely, and authorized
- **Confidentiality (C)**: Information designated as confidential is protected
- **Privacy (P)**: Personal information is collected, used, retained, and disposed of appropriately

## Our Compliance Approach

We have implemented comprehensive controls across all five criteria to ensure our platform meets SOC 2 requirements. This documentation outlines our specific implementations and provides evidence of compliance.`,
    description: "Introduction to SOC 2 and our compliance framework",
    evidence: [
      {
        id: "ev_001",
        name: "SOC 2 Compliance Roadmap",
        type: "report",
        description: "High-level roadmap showing our compliance journey and milestones",
        status: "verified",
        date: "2025-10-01",
        relevance: "Demonstrates our commitment to SOC 2 compliance and structured approach",
        sources: [
          {
            sourceId: "src_compliance_db_001",
            queryType: "document",
            query: "compliance_roadmap_2025.pdf",
          },
        ],
        auditorReviews: [
          {
            id: "review_001",
            auditorName: "SOC2 General Auditor",
            auditorType: "ai",
            date: "2025-10-15",
            status: "relevant",
            reason: "Roadmap clearly demonstrates structured approach to SOC 2 compliance with defined phases and deliverables",
          },
        ],
        data: {
          type: "table",
          headers: ["Phase", "Timeline", "Status", "Key Deliverables"],
          rows: [
            ["Phase 1: Assessment", "Q3 2025", "Complete", "Gap analysis, control mapping"],
            ["Phase 2: Implementation", "Q4 2025", "In Progress", "Control implementation, documentation"],
            ["Phase 3: Testing", "Q1 2026", "Planned", "Control testing, evidence collection"],
            ["Phase 4: Audit", "Q2 2026", "Planned", "External audit, certification"],
          ],
        },
      },
      {
        id: "ev_002",
        name: "Compliance Team Charter",
        type: "policy",
        description: "Document defining the compliance team's responsibilities",
        status: "verified",
        date: "2025-09-01",
        relevance: "Establishes governance structure for compliance oversight",
        sources: [
          {
            sourceId: "src_policy_db_001",
            queryType: "document",
            query: "policies/compliance_team_charter_v2.1.md",
          },
        ],
        auditorReviews: [
          {
            id: "review_002",
            auditorName: "SOC2 General Auditor",
            auditorType: "ai",
            date: "2025-10-16",
            status: "relevant",
            reason: "Charter clearly defines compliance team responsibilities, authority, and reporting structure required for SOC 2 governance",
          },
        ],
        data: {
          type: "quote",
          content: `Compliance Team Charter

Mission: Ensure the organization maintains SOC 2 compliance and meets all regulatory requirements.

Responsibilities:
- Develop and maintain compliance policies and procedures
- Coordinate with all departments on compliance requirements
- Conduct regular compliance assessments and audits
- Maintain compliance documentation and evidence
- Report compliance status to executive leadership

Authority:
- Direct access to all systems and documentation
- Authority to request information from any department
- Escalation path to Chief Information Security Officer

Reporting: Quarterly compliance reports to executive team`,
        },
      },
    ],
    children: [
      {
        id: "cc_controls",
        title: "CC - Common Controls",
        type: "general",
        content: `# Common Controls (CC)

The Common Controls (CC) category covers the foundational security controls that apply across the organization.

## CC1 - Governance
The organization has established governance structures to oversee the design and implementation of controls.

## CC2 - Communications
The organization communicates control responsibilities and expectations to all personnel.

## CC3 - Risk Assessment
The organization performs risk assessments to identify potential threats and vulnerabilities.

## CC4 - Monitoring
The organization monitors the effectiveness of controls on an ongoing basis.

## CC5 - Logical and Physical Access
The organization restricts access to systems and facilities based on the principle of least privilege.

## CC6 - Logical and Physical Access Controls
Detailed controls for managing access to systems and data.

## CC7 - System Monitoring
The organization monitors systems for unauthorized access and suspicious activity.

## CC8 - Change Management
The organization manages changes to systems in a controlled manner.

## CC9 - Risk Mitigation
The organization identifies and mitigates risks to the confidentiality, integrity, and availability of systems.`,
        description: "Overview of all Common Controls",
        evidence: [],
      },
      {
        id: "cc6_section",
        title: "CC6 - Logical and Physical Access Controls",
        type: "general",
        content: `# CC6 - Logical and Physical Access Controls

CC6 is one of the most critical control areas in SOC 2. It encompasses all controls related to restricting access to systems and data.

## Overview

The entity restricts logical access to assets and the transmission, use, and disposal of data. This includes:

- Authentication mechanisms
- Authorization policies
- Access reviews
- Physical security
- Data disposal procedures

## Key Components

1. **Logical Access**: Controls over who can access systems and data
2. **Physical Access**: Controls over who can access facilities and equipment
3. **Data Transmission**: Controls over how data is transmitted
4. **Data Disposal**: Controls over how data is securely destroyed

## Implementation Status

All CC6 controls have been implemented and are actively monitored.`,
        description: "Detailed overview of CC6 controls",
        evidence: [
          {
            id: "ev_cc6_001",
            name: "CC6 Control Matrix",
            type: "report",
            description: "Mapping of all CC6 controls to our systems and processes",
            status: "verified",
            date: "2025-10-15",
            relevance: "Demonstrates comprehensive mapping of all CC6 controls to our infrastructure",
            sources: [
              {
                sourceId: "src_compliance_sheet_001",
                queryType: "sql",
                query: "SELECT * FROM controls WHERE category = 'CC6' AND status = 'implemented'",
              },
            ],
            auditorReviews: [
              {
                id: "review_cc6_001",
                auditorName: "Access Control Auditor",
                auditorType: "ai",
                date: "2025-10-16",
                status: "relevant",
                reason: "Matrix comprehensively maps all CC6 controls to systems with clear ownership and testing schedule",
              },
            ],
            data: {
              type: "table",
              headers: ["Control", "System", "Owner", "Status", "Last Tested"],
              rows: [
                ["CC6.1", "Okta, AWS", "Security Team", "Implemented", "2025-10-15"],
                ["CC6.2", "HR System, Okta", "HR & Security", "Implemented", "2025-10-14"],
                ["CC6.8", "Identity System", "Security Team", "Implemented", "2025-10-13"],
              ],
            },
          },
        ],
        children: [
          {
            id: "cc6_1",
            title: "CC6.1 - Logical and Physical Access Controls",
            type: "control",
            content: `# CC6.1 - Logical and Physical Access Controls

## Control Description

The entity restricts logical access to assets and the transmission, use, and disposal of data.

## Implementation

### Logical Access Controls
- Multi-factor authentication required for all user accounts
- Role-based access control (RBAC) implemented
- Principle of least privilege enforced
- Access reviews conducted quarterly

### Physical Access Controls
- Badge access systems for data centers
- Visitor logs maintained
- Surveillance cameras in restricted areas
- Biometric access for sensitive areas

### Data Transmission
- All data in transit encrypted with TLS 1.2+
- VPN required for remote access
- Secure file transfer protocols used

### Data Disposal
- Secure data wiping procedures documented
- Hardware destruction certified
- Data retention policies enforced`,
            description: "Restricts logical and physical access to systems and data",
            linkedPolicies: [
              "Access Control Policy",
              "Authentication and Authorization Policy",
              "Physical Security Policy",
              "Data Retention and Disposal Policy",
            ],
            relevance: `As a SaaS platform handling customer data, implementing strong logical and physical access controls is critical to maintaining data confidentiality and integrity. This control ensures that only authorized personnel can access systems and customer data, reducing the risk of unauthorized access or data breaches.`,
            evidence: [
              {
                id: "ev_cc6_1_001",
                name: "Okta MFA Configuration",
                type: "configuration",
                description: "Multi-factor authentication enabled for all user accounts",
                status: "verified",
                date: "2025-10-15",
                relevance: "Demonstrates that MFA is enforced for all user authentication, preventing unauthorized access",
                sources: [
                  {
                    sourceId: "src_okta_api_001",
                    queryType: "rag",
                    query: "Okta MFA enforcement policy and configuration settings",
                  },
                  {
                    sourceId: "src_okta_admin_001",
                    queryType: "document",
                    query: "okta_admin_console_export_2025-10-15.json",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_1_001_a",
                    auditorName: "Authentication Auditor",
                    auditorType: "ai",
                    date: "2025-10-16",
                    status: "relevant",
                    reason: "Configuration shows MFA is required for all users with multiple authentication methods supported",
                  },
                  {
                    id: "review_cc6_1_001_b",
                    auditorName: "Access Control Auditor",
                    auditorType: "ai",
                    date: "2025-10-17",
                    status: "relevant",
                    reason: "Verified MFA enforcement covers 100% of active users. Configuration aligns with SOC 2 requirements.",
                  },
                ],
                data: {
                  type: "json",
                  content: {
                    mfa_enabled: true,
                    mfa_required_for_all_users: true,
                    mfa_methods: ["OKTA", "GOOGLE_AUTHENTICATOR", "SMS"],
                    enforcement_policy: "REQUIRED",
                    last_updated: "2025-10-15T10:30:00Z",
                    coverage: "100% of active users",
                  },
                },
              },
              {
                id: "ev_cc6_1_002",
                name: "Access Control Policy",
                type: "policy",
                description: "Formal policy document defining access control procedures",
                status: "verified",
                date: "2025-09-01",
                relevance: "Establishes the formal framework for access control and principle of least privilege",
                sources: [
                  {
                    sourceId: "src_policy_doc_001",
                    queryType: "document",
                    query: "policies/access_control_policy_v3.2.md",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_1_002_a",
                    auditorName: "Authentication Auditor",
                    auditorType: "ai",
                    date: "2025-10-15",
                    status: "relevant",
                    reason: "Policy clearly defines least privilege principle, MFA requirements, and RBAC framework. Meets SOC 2 CC6.1 requirements.",
                  },
                ],
                data: {
                  type: "quote",
                  content: `Section 3.1: Access Control Principles
All access to systems and data shall be granted based on the principle of least privilege. Users shall only be granted access to systems and data necessary to perform their job functions. Access shall be reviewed quarterly and revoked when no longer needed.

Section 3.2: Authentication Requirements
All users must authenticate using multi-factor authentication. Passwords must be at least 12 characters and changed every 90 days. Service accounts must use API keys or certificates.

Section 3.3: Authorization Framework
Access decisions shall be based on role-based access control (RBAC). All access changes must be approved by the user's manager and documented.`,
                },
              },
              {
                id: "ev_cc6_1_003",
                name: "Q4 2024 Access Review",
                type: "review",
                description: "Quarterly access review showing all active accounts and permissions",
                status: "verified",
                date: "2025-10-30",
                relevance: "Demonstrates ongoing monitoring and validation that access rights remain appropriate",
                sources: [
                  {
                    sourceId: "src_access_db_001",
                    queryType: "sql",
                    query: "SELECT user_id, department, role, systems, last_review_date FROM access_reviews WHERE review_period = 'Q4_2025'",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_1_003_a",
                    auditorName: "Access Control Auditor",
                    auditorType: "ai",
                    date: "2025-10-31",
                    status: "relevant",
                    reason: "Quarterly review demonstrates systematic access validation. All users have documented access rights aligned with roles.",
                  },
                ],
                data: {
                  type: "table",
                  headers: ["User ID", "Department", "Role", "Systems", "Last Review", "Status"],
                  rows: [
                    ["user_001", "Engineering", "Senior Engineer", "GitHub, AWS, Datadog", "2025-10-30", "Active"],
                    ["user_002", "Engineering", "DevOps Engineer", "AWS, Kubernetes, Terraform", "2025-10-30", "Active"],
                    ["user_003", "Security", "Security Engineer", "All Systems", "2025-10-30", "Active"],
                    ["user_004", "Finance", "Accountant", "Accounting System, Reports", "2025-10-30", "Active"],
                    ["user_005", "HR", "HR Manager", "HR System, Payroll", "2025-10-30", "Active"],
                  ],
                },
              },
              {
                id: "ev_cc6_1_004",
                name: "Badge Access Logs",
                type: "log",
                description: "Physical access logs for data center showing badge swipes",
                status: "verified",
                date: "2025-11-04",
                relevance: "Provides audit trail of physical access to data center facilities",
                sources: [
                  {
                    sourceId: "src_badge_system_001",
                    queryType: "mongo",
                    query: "db.badge_logs.find({timestamp: {$gte: ISODate('2025-11-04T00:00:00Z')}}).limit(100)",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_1_004_a",
                    auditorName: "Physical Security Auditor",
                    auditorType: "ai",
                    date: "2025-11-04",
                    status: "relevant",
                    reason: "Badge logs show proper access control with denied access for unauthorized badge. Audit trail is complete and timestamped.",
                  },
                ],
                data: {
                  type: "logs",
                  entries: [
                    { timestamp: "2025-11-04T08:15:32Z", level: "INFO", message: "Badge swipe: emp_001 (John Smith) - Main Entrance - Access Granted" },
                    { timestamp: "2025-11-04T08:16:45Z", level: "INFO", message: "Badge swipe: emp_002 (Jane Doe) - Main Entrance - Access Granted" },
                    { timestamp: "2025-11-04T09:30:12Z", level: "INFO", message: "Badge swipe: emp_003 (Bob Johnson) - Server Room - Access Granted" },
                    { timestamp: "2025-11-04T10:45:22Z", level: "WARN", message: "Badge swipe: unknown_badge - Main Entrance - Access Denied" },
                    { timestamp: "2025-11-04T11:20:15Z", level: "INFO", message: "Badge swipe: emp_001 (John Smith) - Main Entrance - Access Granted" },
                    { timestamp: "2025-11-04T14:30:08Z", level: "INFO", message: "Badge swipe: emp_004 (Alice Brown) - Server Room - Access Granted" },
                  ],
                },
              },
              {
                id: "ev_cc6_1_005",
                name: "TLS Configuration Report",
                type: "report",
                description: "Report showing all systems using TLS 1.2+ for data transmission",
                status: "verified",
                date: "2025-10-20",
                relevance: "Confirms encryption of data in transit across all systems",
                sources: [
                  {
                    sourceId: "src_security_scan_001",
                    queryType: "rag",
                    query: "TLS configuration and encryption standards across all production systems",
                  },
                  {
                    sourceId: "src_cert_db_001",
                    queryType: "sql",
                    query: "SELECT system_name, tls_version, cipher_suite, cert_expiry FROM tls_configurations WHERE environment = 'production'",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_1_005_a",
                    auditorName: "Encryption Auditor",
                    auditorType: "ai",
                    date: "2025-10-21",
                    status: "relevant",
                    reason: "All systems use TLS 1.2 or higher with strong cipher suites. Certificates are valid and properly managed.",
                  },
                  {
                    id: "review_cc6_1_005_b",
                    auditorName: "Infrastructure Auditor",
                    auditorType: "ai",
                    date: "2025-10-22",
                    status: "relevant",
                    reason: "Verified TLS configuration meets SOC 2 requirements for data in transit encryption. Certificate renewal process is in place.",
                  },
                ],
                data: {
                  type: "table",
                  headers: ["System", "TLS Version", "Cipher Suites", "Certificate Expiry", "Status"],
                  rows: [
                    ["API Gateway", "TLS 1.3", "TLS_AES_256_GCM_SHA384", "2026-03-15", "✓ Compliant"],
                    ["Web Application", "TLS 1.3", "TLS_AES_256_GCM_SHA384", "2026-02-20", "✓ Compliant"],
                    ["Database", "TLS 1.2", "ECDHE-RSA-AES256-GCM-SHA384", "2025-12-10", "✓ Compliant"],
                    ["Message Queue", "TLS 1.2", "ECDHE-RSA-AES256-GCM-SHA384", "2026-01-05", "✓ Compliant"],
                  ],
                },
              },
            ],
            evidenceRequests: [
              {
                id: "req_cc6_1_001",
                requestedBy: "Access Control Auditor",
                date: "2025-11-05",
                reason: "Need evidence of access control testing procedures to verify that access controls are functioning as designed",
                complianceImpact: "Without documented access control testing procedures, we cannot verify that access controls are effective and functioning as designed, which could result in unauthorized access going undetected",
              },
              {
                id: "req_cc6_1_002",
                requestedBy: "Authentication Auditor",
                date: "2025-11-05",
                reason: "Need documentation of MFA bypass procedures and emergency access protocols for business continuity scenarios",
                complianceImpact: "Lack of documented emergency access procedures could lead to unauthorized access during incidents or create compliance gaps in access control documentation",
              },
            ],
          },
          {
            id: "cc6_2",
            title: "CC6.2 - Prior to Issuing System Credentials",
            type: "control",
            content: `# CC6.2 - Prior to Issuing System Credentials

## Control Description

Prior to issuing system credentials, the entity verifies the identity of the user and obtains appropriate authorization.

## Implementation

### Identity Verification
- Government-issued ID required for all employees
- Background checks conducted for all new hires
- Contractor verification process documented

### Authorization Process
- Manager approval required for all access requests
- Access request forms documented and retained
- Approval workflow tracked in system

### Credential Issuance
- Credentials issued only after verification and authorization
- Temporary credentials with expiration dates
- Credential reset procedures documented

### Monitoring
- Access provisioning tracked and logged
- Regular audits of credential issuance
- Unauthorized access attempts monitored`,
            description: "Verifies identity and obtains authorization before issuing credentials",
            linkedPolicies: [
              "User Provisioning Policy",
              "Identity Verification Procedure",
              "Authorization Workflow",
            ],
            relevance: `Proper identity verification and authorization before issuing credentials prevents unauthorized access and ensures accountability. This control is essential for maintaining the integrity of our access control system.`,
            evidence: [
              {
                id: "ev_cc6_2_001",
                name: "User Provisioning Procedure",
                type: "procedure",
                description: "Step-by-step procedure for provisioning new user accounts",
                status: "verified",
                date: "2025-09-15",
                relevance: "Documents the formal process for verifying identity and obtaining authorization before issuing credentials",
                sources: [
                  {
                    sourceId: "src_it_ops_001",
                    queryType: "document",
                    query: "it_operations_manual_v2.1.pdf",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_2_001_a",
                    auditorName: "Identity Management Auditor",
                    auditorType: "ai",
                    date: "2025-09-20",
                    status: "relevant",
                    reason: "Procedure clearly documents identity verification and authorization steps before credential issuance",
                  },
                ],
                data: {
                  type: "quote",
                  content: `User Provisioning Procedure v2.1

Step 1: Identity Verification
- Collect government-issued ID from new hire
- Verify ID authenticity with HR
- Document ID number and expiration date
- Store copy in secure personnel file

Step 2: Authorization
- Manager submits access request form
- Specify systems and access level needed
- Obtain manager and security approval
- Document all approvals with timestamps

Step 3: Credential Issuance
- Create user account in identity system
- Set temporary password (expires in 24 hours)
- Enable MFA requirement
- Send credentials via secure channel
- User must change password on first login

Step 4: Documentation
- Log all provisioning activities
- Maintain audit trail for 7 years
- Notify security team of new accounts`,
                },
              },
              {
                id: "ev_cc6_2_002",
                name: "Background Check Policy",
                type: "policy",
                description: "Policy requiring background checks for all employees",
                status: "verified",
                date: "2025-08-20",
                relevance: "Establishes requirement for background verification before granting system access",
                sources: [
                  {
                    sourceId: "src_hr_policy_001",
                    queryType: "document",
                    query: "hr_policy_database_background_checks.pdf",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_2_002_a",
                    auditorName: "Compliance Auditor",
                    auditorType: "ai",
                    date: "2025-08-25",
                    status: "relevant",
                    reason: "Policy establishes comprehensive background check requirements before system access is granted",
                  },
                ],
                data: {
                  type: "quote",
                  content: `Background Check Policy - Section 2.1

All employees must undergo a background check before being granted access to company systems or facilities.

Background Check Requirements:
- Criminal history check (7 years)
- Employment history verification
- Education verification
- Reference checks (minimum 2)
- Credit check (for finance roles)

Timing: Background checks must be completed before Day 1 of employment.

Exceptions: Temporary contractors require abbreviated checks (criminal history only).

Renewal: Background checks are renewed every 3 years for all employees.

Documentation: All background check results are maintained in secure HR files.`,
                },
              },
              {
                id: "ev_cc6_2_003",
                name: "Access Request Log",
                type: "log",
                description: "Log of all access requests with approvals and timestamps",
                status: "verified",
                date: "2025-11-01",
                relevance: "Provides audit trail showing all access requests were properly authorized before credential issuance",
                sources: [
                  {
                    sourceId: "src_access_mgmt_001",
                    queryType: "sql",
                    query: "SELECT * FROM access_requests WHERE issued_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_2_003_a",
                    auditorName: "Access Control Auditor",
                    auditorType: "ai",
                    date: "2025-11-02",
                    status: "relevant",
                    reason: "All access requests show proper manager and security approvals before credential issuance",
                  },
                ],
                data: {
                  type: "table",
                  headers: ["Request ID", "User", "Systems Requested", "Manager Approval", "Security Approval", "Issued Date", "Status"],
                  rows: [
                    ["REQ-2025-001", "emp_101", "GitHub, AWS", "2025-10-28", "2025-10-29", "2025-10-30", "Active"],
                    ["REQ-2025-002", "emp_102", "Datadog, PagerDuty", "2025-10-28", "2025-10-29", "2025-10-30", "Active"],
                    ["REQ-2025-003", "emp_103", "All Systems", "2025-10-27", "2025-10-28", "2025-10-29", "Active"],
                    ["REQ-2025-004", "emp_104", "Accounting System", "2025-10-26", "2025-10-27", "2025-10-28", "Active"],
                  ],
                },
              },
              {
                id: "ev_cc6_2_004",
                name: "Credential Issuance Audit",
                type: "report",
                description: "Audit report of all credentials issued in the past 12 months",
                status: "verified",
                date: "2025-10-31",
                relevance: "Demonstrates that all credentials were issued following proper authorization procedures",
                sources: [
                  {
                    sourceId: "src_security_audit_001",
                    queryType: "rag",
                    query: "Credential issuance audit report and compliance metrics",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_2_004_a",
                    auditorName: "Compliance Auditor",
                    auditorType: "ai",
                    date: "2025-11-01",
                    status: "relevant",
                    reason: "Audit shows 100% compliance rate for credential issuance with proper authorization",
                  },
                ],
                data: {
                  type: "table",
                  headers: ["Month", "New Accounts", "Authorized", "Verified", "Compliance %"],
                  rows: [
                    ["Nov 2024", "3", "3", "3", "100%"],
                    ["Dec 2024", "2", "2", "2", "100%"],
                    ["Jan 2025", "4", "4", "4", "100%"],
                    ["Feb 2025", "1", "1", "1", "100%"],
                    ["Mar 2025", "5", "5", "5", "100%"],
                    ["Apr 2025", "2", "2", "2", "100%"],
                    ["May 2025", "3", "3", "3", "100%"],
                    ["Jun 2025", "4", "4", "4", "100%"],
                    ["Jul 2025", "2", "2", "2", "100%"],
                    ["Aug 2025", "3", "3", "3", "100%"],
                    ["Sep 2025", "1", "1", "1", "100%"],
                    ["Oct 2025", "2", "2", "2", "100%"],
                  ],
                },
              },
            ],
          },
          {
            id: "cc6_8",
            title: "CC6.8 - Logical and Physical Access Revocation",
            type: "control",
            content: `# CC6.8 - Logical and Physical Access Revocation

## Control Description

The entity revokes logical and physical access rights of terminated users in a timely manner.

## Implementation

### Termination Process
- Exit checklist completed for all departing employees
- Access revocation initiated on last day of employment
- All credentials disabled within 24 hours

### Logical Access Revocation
- System access disabled immediately
- VPN access revoked
- Email and collaboration tools disabled
- API keys and tokens revoked

### Physical Access Revocation
- Badge access disabled
- Parking access revoked
- Building access removed
- Equipment returned and verified

### Monitoring
- Termination checklist tracked
- Access revocation logged
- Periodic audits of active accounts
- Comparison with current employee roster

### Contractor and Vendor Access
- Temporary access with defined end dates
- Automatic revocation on contract end date
- Regular review of active contractor accounts`,
            description: "Revokes access rights of terminated users in a timely manner",
            linkedPolicies: [
              "Offboarding Policy",
              "Access Revocation Procedure",
              "Contractor Access Policy",
            ],
            relevance: `Timely revocation of access for terminated employees is critical to preventing unauthorized access and data breaches. This control ensures that former employees cannot access systems or data after their employment ends.`,
            evidence: [
              {
                id: "ev_cc6_8_001",
                name: "Offboarding Checklist",
                type: "procedure",
                description: "Comprehensive checklist for employee offboarding including access revocation",
                status: "verified",
                date: "2025-09-10",
                relevance: "Ensures systematic revocation of all access rights when employees terminate",
                sources: [
                  {
                    sourceId: "src_hr_ops_001",
                    queryType: "document",
                    query: "hr_operations_manual_offboarding_v3.0.pdf",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_8_001_a",
                    auditorName: "Offboarding Auditor",
                    auditorType: "ai",
                    date: "2025-09-15",
                    status: "relevant",
                    reason: "Checklist comprehensively covers all access revocation steps with clear timelines and documentation requirements",
                  },
                ],
                data: {
                  type: "quote",
                  content: `Employee Offboarding Checklist v3.0

LAST DAY OF EMPLOYMENT:
☐ Disable all system accounts (same day)
☐ Revoke VPN access
☐ Disable email and collaboration tools
☐ Revoke API keys and tokens
☐ Remove from all security groups
☐ Disable badge access
☐ Revoke parking access
☐ Collect company equipment

WITHIN 24 HOURS:
☐ Verify all access has been revoked
☐ Run access audit report
☐ Confirm no active sessions
☐ Document completion in HR system

WITHIN 1 WEEK:
☐ Audit all systems for orphaned accounts
☐ Review file permissions
☐ Archive email (if required)
☐ Final security review

DOCUMENTATION:
☐ Maintain offboarding record for 7 years
☐ Document all access revocation timestamps
☐ Obtain manager sign-off`,
                },
              },
              {
                id: "ev_cc6_8_002",
                name: "Access Revocation Log",
                type: "log",
                description: "Log of all access revocations with timestamps and approvals",
                status: "verified",
                date: "2025-11-03",
                relevance: "Provides audit trail of access revocation for terminated employees",
                sources: [
                  {
                    sourceId: "src_idm_system_001",
                    queryType: "mongo",
                    query: "db.access_revocation_logs.find({timestamp: {$gte: ISODate('2025-10-01T00:00:00Z')}}).limit(100)",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_8_002_a",
                    auditorName: "Access Control Auditor",
                    auditorType: "ai",
                    date: "2025-11-04",
                    status: "relevant",
                    reason: "Logs show complete access revocation for all terminated employees with proper timestamps",
                  },
                ],
                data: {
                  type: "logs",
                  entries: [
                    { timestamp: "2025-10-31T17:00:15Z", level: "INFO", message: "Access revocation initiated for emp_050 (Terminated)" },
                    { timestamp: "2025-10-31T17:00:32Z", level: "INFO", message: "System access disabled: GitHub" },
                    { timestamp: "2025-10-31T17:00:45Z", level: "INFO", message: "System access disabled: AWS" },
                    { timestamp: "2025-10-31T17:01:02Z", level: "INFO", message: "VPN access revoked" },
                    { timestamp: "2025-10-31T17:01:18Z", level: "INFO", message: "Email account disabled" },
                    { timestamp: "2025-10-31T17:01:35Z", level: "INFO", message: "Badge access revoked" },
                    { timestamp: "2025-10-31T17:02:00Z", level: "INFO", message: "All access revocation completed for emp_050" },
                    { timestamp: "2025-11-01T09:15:22Z", level: "INFO", message: "Access revocation initiated for emp_051 (Terminated)" },
                    { timestamp: "2025-11-01T09:16:00Z", level: "INFO", message: "All systems access revoked for emp_051" },
                  ],
                },
              },
              {
                id: "ev_cc6_8_003",
                name: "Terminated Employee Report",
                type: "report",
                description: "Monthly report of terminated employees and their access revocation status",
                status: "verified",
                date: "2025-11-01",
                relevance: "Tracks terminations and confirms timely access revocation",
                sources: [
                  {
                    sourceId: "src_hr_security_report_001",
                    queryType: "sql",
                    query: "SELECT * FROM terminations WHERE termination_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_8_003_a",
                    auditorName: "Compliance Auditor",
                    auditorType: "ai",
                    date: "2025-11-02",
                    status: "relevant",
                    reason: "Report confirms all terminated employees had access revoked on their termination date",
                  },
                ],
                data: {
                  type: "table",
                  headers: ["Employee ID", "Name", "Termination Date", "Access Revoked", "Revocation Date", "Status"],
                  rows: [
                    ["emp_045", "John Smith", "2025-09-30", "Yes", "2025-09-30", "Complete"],
                    ["emp_048", "Jane Doe", "2025-10-15", "Yes", "2025-10-15", "Complete"],
                    ["emp_050", "Bob Johnson", "2025-10-31", "Yes", "2025-10-31", "Complete"],
                    ["emp_051", "Alice Brown", "2025-11-01", "Yes", "2025-11-01", "Complete"],
                  ],
                },
              },
              {
                id: "ev_cc6_8_004",
                name: "Active Account Audit",
                type: "report",
                description: "Quarterly audit comparing active system accounts to current employee roster",
                status: "verified",
                date: "2025-10-31",
                relevance: "Identifies orphaned accounts and ensures no terminated employees retain access",
                sources: [
                  {
                    sourceId: "src_security_audit_002",
                    queryType: "rag",
                    query: "Active account audit and orphaned account detection",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_8_004_a",
                    auditorName: "Access Control Auditor",
                    auditorType: "ai",
                    date: "2025-11-01",
                    status: "relevant",
                    reason: "Audit confirms zero orphaned accounts across all systems, validating effective access revocation",
                  },
                ],
                data: {
                  type: "table",
                  headers: ["System", "Total Accounts", "Active Employees", "Orphaned Accounts", "Status"],
                  rows: [
                    ["GitHub", "45", "42", "0", "✓ Clean"],
                    ["AWS", "38", "38", "0", "✓ Clean"],
                    ["Datadog", "52", "50", "0", "✓ Clean"],
                    ["Okta", "48", "48", "0", "✓ Clean"],
                    ["Slack", "55", "52", "0", "✓ Clean"],
                  ],
                },
              },
              {
                id: "ev_cc6_8_005",
                name: "Contractor Access Review",
                type: "review",
                description: "Quarterly review of all active contractor and vendor accounts",
                status: "verified",
                date: "2025-10-30",
                relevance: "Ensures contractor access is time-limited and revoked when contracts end",
                sources: [
                  {
                    sourceId: "src_vendor_mgmt_001",
                    queryType: "document",
                    query: "Vendor Management System – contractor access review Q4 2025",
                  },
                ],
                auditorReviews: [
                  {
                    id: "review_cc6_8_005",
                    auditorName: "Access Control Auditor",
                    auditorType: "ai",
                    date: "2025-10-31",
                    status: "relevant",
                    reason:
                      "Quarterly review confirms contractor accounts are time-bound and revoked promptly at contract end.",
                  },
                ],
                data: {
                  type: "table",
                  headers: ["Contractor", "Company", "Systems", "Contract End", "Auto-Revoke", "Status"],
                  rows: [
                    ["John Contractor", "TechCorp", "GitHub, AWS", "2025-12-31", "Yes", "Active"],
                    ["Jane Vendor", "SecureInc", "AWS, Datadog", "2026-03-15", "Yes", "Active"],
                    ["Bob Consultant", "CloudSys", "All Systems", "2025-11-30", "Yes", "Active"],
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * MOCKUP: Tasks connected to evidence requests
 * These tasks are created when evidence requests are added to the documentation
 * They link back to the evidence requests and allow users to fulfill them
 */
export const SOC2_MOCKUP_TASKS = [
  // Evidence Request Tasks (linked to CC6.1 evidence requests)
  {
    id: 'task_ev_req_001',
    title: 'Access Control Testing Procedures',
    description: 'Need evidence of access control testing procedures to verify that access controls are functioning as designed',
    taskType: 'evidence-request' as const,
    author: {
      name: 'Access Control Auditor',
      role: 'Access Control Auditor',
      type: 'ai' as const,
    },
    status: 'todo' as const,
    priority: 'high' as const,
    linkedEvidenceRequestId: 'req_cc6_1_001',
    linkedDocumentPageId: 'cc6_1',
    dueDate: '2025-11-15',
    createdAt: '2025-11-05T10:00:00Z',
  },
  {
    id: 'task_ev_req_002',
    title: 'MFA Bypass and Emergency Access Documentation',
    description: 'Need documentation of MFA bypass procedures and emergency access protocols for business continuity scenarios',
    taskType: 'evidence-request' as const,
    author: {
      name: 'Authentication Auditor',
      role: 'Authentication Auditor',
      type: 'ai' as const,
    },
    status: 'todo' as const,
    priority: 'high' as const,
    linkedEvidenceRequestId: 'req_cc6_1_002',
    linkedDocumentPageId: 'cc6_1',
    dueDate: '2025-11-15',
    createdAt: '2025-11-05T10:15:00Z',
  },

  // Documentation Issue Tasks
  {
    id: 'task_doc_001',
    title: 'Update CC6.2 Control Description',
    description: 'The CC6.2 control description needs to be updated with the latest requirements for logical access controls',
    taskType: 'documentation-issue' as const,
    author: {
      name: 'Compliance Officer',
      role: 'Compliance Team',
      type: 'human' as const,
    },
    status: 'in-progress' as const,
    priority: 'medium' as const,
    linkedDocumentPageId: 'cc6_2',
    assignedTo: 'Sarah Chen',
    dueDate: '2025-11-10',
    createdAt: '2025-11-03T14:30:00Z',
  },
  {
    id: 'task_doc_002',
    title: 'Add Physical Security Procedures Page',
    description: 'Need to add a new documentation page for physical security procedures and controls',
    taskType: 'documentation-issue' as const,
    author: {
      name: 'SOC2 General Auditor',
      role: 'SOC2 General Auditor',
      type: 'ai' as const,
    },
    status: 'todo' as const,
    priority: 'medium' as const,
    dueDate: '2025-11-20',
    createdAt: '2025-11-04T09:00:00Z',
  },

  // Missing Data Tasks
  {
    id: 'task_missing_001',
    title: 'Add Database Schema Documentation',
    description: 'The knowledge base is missing documentation for the database schema and data classification',
    taskType: 'missing-data' as const,
    author: {
      name: 'Infrastructure Auditor',
      role: 'Infrastructure Auditor',
      type: 'ai' as const,
    },
    status: 'todo' as const,
    priority: 'high' as const,
    dueDate: '2025-11-12',
    createdAt: '2025-11-02T11:00:00Z',
  },
  {
    id: 'task_missing_002',
    title: 'Add API Security Documentation',
    description: 'Missing documentation for API authentication, authorization, and rate limiting mechanisms',
    taskType: 'missing-data' as const,
    author: {
      name: 'Security Auditor',
      role: 'Security Team',
      type: 'human' as const,
    },
    status: 'in-progress' as const,
    priority: 'high' as const,
    assignedTo: 'Michael Johnson',
    dueDate: '2025-11-08',
    createdAt: '2025-11-01T15:45:00Z',
  },

  // Security Issue Tasks
  {
    id: 'task_security_001',
    title: 'MFA Not Enforced on Admin Accounts',
    description: 'Critical security issue: Multi-factor authentication is not enforced for administrative accounts',
    taskType: 'security-issue' as const,
    author: {
      name: 'Security Auditor',
      role: 'Security Team',
      type: 'human' as const,
    },
    status: 'in-progress' as const,
    priority: 'critical' as const,
    assignedTo: 'James Wilson',
    dueDate: '2025-11-06',
    createdAt: '2025-11-01T08:00:00Z',
  },
  {
    id: 'task_security_002',
    title: 'Encryption in Transit Not Verified',
    description: 'Need to verify that all data in transit is encrypted using TLS 1.2 or higher',
    taskType: 'security-issue' as const,
    author: {
      name: 'Encryption Auditor',
      role: 'Encryption Auditor',
      type: 'ai' as const,
    },
    status: 'todo' as const,
    priority: 'critical' as const,
    dueDate: '2025-11-09',
    createdAt: '2025-11-04T13:20:00Z',
  },

  // Completed Tasks
  {
    id: 'task_completed_001',
    title: 'Review Access Control Policies',
    description: 'Completed review of all access control policies and procedures',
    taskType: 'documentation-issue' as const,
    author: {
      name: 'Compliance Officer',
      role: 'Compliance Team',
      type: 'human' as const,
    },
    status: 'completed' as const,
    priority: 'medium' as const,
    createdAt: '2025-10-20T10:00:00Z',
  },
];
