package handlers

import (
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// CommitmentControlResponse represents a single control entry in the public
// or private commitment view.
type CommitmentControlResponse struct {
	Title             string                       `json:"title"`
	Description       string                       `json:"description"`
	Status            string                       `json:"status"`
	Frameworks        []string                     `json:"frameworks"`
	SCFID             string                       `json:"scf_id"`
	FrameworkMappings []CommitmentFrameworkMapping `json:"framework_mappings"`
}

// CommitmentFrameworkMapping exposes external framework mappings (e.g. NIST
// CSF or ISO42001 control IDs) for a given SCF control, grouped so that each
// framework appears once with a de-duplicated list of external IDs.
type CommitmentFrameworkMapping struct {
	Framework   string   `json:"framework"`
	ExternalIDs []string `json:"external_ids"`
}

// CommitmentProjectResponse groups controls by active project.
type CommitmentProjectResponse struct {
	ObjectID   string                      `json:"object_id"`
	Name       string                      `json:"name"`
	Status     string                      `json:"status"`
	Frameworks []string                    `json:"frameworks"`
	Controls   []CommitmentControlResponse `json:"controls"`
}

// CommitmentOrganizationResponse is the top-level organization metadata for
// the commitment response.
type CommitmentOrganizationResponse struct {
	ObjectID        string `json:"object_id"`
	Name            string `json:"organization_name"`
	ShareCommitment bool   `json:"share_commitment"`
}

// CommitmentResponse is the full payload returned by both public and private
// commitment endpoints.
type CommitmentResponse struct {
	Organization CommitmentOrganizationResponse `json:"organization"`
	Projects     []CommitmentProjectResponse    `json:"projects"`
}

// CommitmentHandler aggregates commitment data (controls and framework
// mappings) for organizations and their active projects.
type CommitmentHandler struct {
	DB *gorm.DB
}

// NewCommitmentHandler constructs a CommitmentHandler.
func NewCommitmentHandler(db *gorm.DB) *CommitmentHandler {
	return &CommitmentHandler{DB: db}
}

// GetPublicCommitment exposes a public, unauthenticated view of an
// organization's active projects and their controls, gated by the
// Organization.ShareCommitment flag.
//
// @Summary Get public security commitment
// @Description Get a public view of an organization's active projects and their controls, including framework coverage and mappings.
// @Tags commitment
// @Produce json
// @Param org_id query string true "Organization Object ID"
// @Success 200 {object} CommitmentResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/public/commitment [get]
func (h *CommitmentHandler) GetPublicCommitment(c *fiber.Ctx) error {
	orgObjectID := strings.TrimSpace(c.Query("org_id"))
	if orgObjectID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "org_id query parameter is required"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgObjectID).First(&org).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to load organization for public commitment: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load organization"})
	}

	if !org.ShareCommitment {
		// Return 404 instead of 403 to avoid leaking the existence of
		// organizations that have not chosen to share their commitment.
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Public commitment not available"})
	}

	resp, err := h.buildCommitmentResponse(&org)
	if err != nil {
		log.Errorf("Failed to build public commitment response: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to build commitment response"})
	}

	return c.JSON(resp)
}

// GetPrivateCommitmentPreview returns the same structure as GetPublicCommitment
// but is scoped to the authenticated organization via middleware and does not
// require ShareCommitment to be true. This allows org users to preview their
// commitment before making it public.
//
// @Summary Get private security commitment preview
// @Description Get a private, org-scoped preview of active projects and their controls, regardless of share_commitment flag.
// @Tags commitment
// @Produce json
// @Param org_id path string true "Organization Object ID"
// @Success 200 {object} CommitmentResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/commitment/preview [get]
// @Security Bearer
func (h *CommitmentHandler) GetPrivateCommitmentPreview(c *fiber.Ctx) error {
	// RestOrgCheckMiddleware ensures this is present and corresponds to the
	// authenticated user's organization.
	org, ok := c.Locals("organization").(models.Organization)
	if !ok {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Organization context not found"})
	}

	resp, err := h.buildCommitmentResponse(&org)
	if err != nil {
		log.Errorf("Failed to build private commitment response: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to build commitment response"})
	}

	return c.JSON(resp)
}

// buildCommitmentResponse aggregates active projects and their SCF-derived
// control documents for a given organization.
func (h *CommitmentHandler) buildCommitmentResponse(org *models.Organization) (*CommitmentResponse, error) {
	// Load active projects for the organization
	var projects []models.Project
	if err := h.DB.Where("organization_id = ? AND status = ?", org.ID, "active").Find(&projects).Error; err != nil {
		return nil, err
	}

	// If no active projects, return an empty list but still include org metadata
	if len(projects) == 0 {
		return &CommitmentResponse{
			Organization: CommitmentOrganizationResponse{
				ObjectID:        org.ObjectID,
				Name:            org.OrganizationName,
				ShareCommitment: org.ShareCommitment,
			},
			Projects: []CommitmentProjectResponse{},
		}, nil
	}

	projectIDs := make([]uint, 0, len(projects))
	for _, p := range projects {
		projectIDs = append(projectIDs, p.ID)
	}

	// Load all control documents (those with SCFControlID set) for these
	// projects in a single query.
	var documents []models.Document
	if err := h.DB.Where("organization_id = ? AND project_id IN ? AND scf_control_id IS NOT NULL", org.ID, projectIDs).
		Find(&documents).Error; err != nil {
		return nil, err
	}

	docsByProject := make(map[uint][]models.Document)
	controlIDsSet := make(map[string]struct{})
	for _, doc := range documents {
		docsByProject[doc.ProjectID] = append(docsByProject[doc.ProjectID], doc)
		if doc.SCFControlID != nil && *doc.SCFControlID != "" {
			controlIDsSet[*doc.SCFControlID] = struct{}{}
		}
	}

	// Load framework mappings for all referenced SCF controls so we can expose
	// NIST (and other) mappings alongside each control.
	frameworkMappingsByControl := make(map[string][]models.SCFFrameworkMap)
	// Also load the SCFControl records themselves so we can use their
	// ControlDescription as a high-level, non-implementation-specific
	// description instead of leaking the full internal document content.
	scfControlsByID := make(map[string]models.SCFControl)
	if len(controlIDsSet) > 0 {
		controlIDs := make([]string, 0, len(controlIDsSet))
		for id := range controlIDsSet {
			controlIDs = append(controlIDs, id)
		}
		sort.Strings(controlIDs)

		// Load mappings from external frameworks (e.g. NIST, ISO42001) to SCF
		// controls.
		var mappings []models.SCFFrameworkMap
		if err := h.DB.Where("scf_object_id IN ?", controlIDs).Find(&mappings).Error; err != nil {
			return nil, err
		}
		for _, m := range mappings {
			frameworkMappingsByControl[m.SCFObjectID] = append(frameworkMappingsByControl[m.SCFObjectID], m)
		}

		// Load the SCF control metadata so we can surface a concise SCF control
		// description without exposing the full document content.
		var scfControls []models.SCFControl
		if err := h.DB.Where("object_id IN ?", controlIDs).Find(&scfControls).Error; err != nil {
			return nil, err
		}
		for _, sc := range scfControls {
			scfControlsByID[sc.ObjectID] = sc
		}
	}

	projectResponses := make([]CommitmentProjectResponse, 0, len(projects))
	for _, project := range projects {
		docs := docsByProject[project.ID]
		frameworkSet := make(map[string]struct{})
		controls := make([]CommitmentControlResponse, 0, len(docs))

		for _, doc := range docs {
			// Decode framework keys stored on the document (e.g. ["soc2","nist_csf"]).
			var frameworks []string
			if len(doc.SCFFrameworkKeys) > 0 {
				if err := json.Unmarshal(doc.SCFFrameworkKeys, &frameworks); err != nil {
					log.Errorf("Failed to unmarshal SCFFrameworkKeys for document %s: %v", doc.ObjectID, err)
				}
			}
			for _, f := range frameworks {
				frameworkSet[f] = struct{}{}
			}

			// Build framework mappings (e.g. NIST CSF IDs) from SCFFrameworkMap.
			var scfID string
			if doc.SCFControlID != nil {
				scfID = *doc.SCFControlID
			}

			// Use the SCF control description as a concise, non-implementation
			// specific description. We intentionally do NOT expose the full
			// Document.Content here to avoid leaking internal control pages.
			var description string
			if scfID != "" {
				if sc, ok := scfControlsByID[scfID]; ok {
					description = strings.TrimSpace(sc.ControlDescription)
					const maxDescriptionLength = 400
					if len(description) > maxDescriptionLength {
						description = description[:maxDescriptionLength] + "..."
					}
				}
			}

			var mappingResponses []CommitmentFrameworkMapping
			if scfID != "" {
				if maps, ok := frameworkMappingsByControl[scfID]; ok {
					// Group by framework and de-duplicate external IDs so we don't
					// repeat the framework name for every mapped control.
					grouped := make(map[string]map[string]struct{})
					for _, m := range maps {
						if m.ExternalID == "" {
							continue
						}
						if _, ok := grouped[m.Framework]; !ok {
							grouped[m.Framework] = make(map[string]struct{})
						}
						grouped[m.Framework][m.ExternalID] = struct{}{}
					}

					// Ensure deterministic ordering of frameworks and external IDs.
					frameworkNames := make([]string, 0, len(grouped))
					for fw := range grouped {
						frameworkNames = append(frameworkNames, fw)
					}
					sort.Strings(frameworkNames)

					for _, fw := range frameworkNames {
						idsSet := grouped[fw]
						ids := make([]string, 0, len(idsSet))
						for id := range idsSet {
							ids = append(ids, id)
						}
						sort.Strings(ids)
						mappingResponses = append(mappingResponses, CommitmentFrameworkMapping{
							Framework:   fw,
							ExternalIDs: ids,
						})
					}
				}
			}

			controls = append(controls, CommitmentControlResponse{
				Title:             doc.Title,
				Description:       description,
				Status:            doc.Status,
				Frameworks:        frameworks,
				SCFID:             scfID,
				FrameworkMappings: mappingResponses,
			})
		}

		projectFrameworks := make([]string, 0, len(frameworkSet))
		for f := range frameworkSet {
			projectFrameworks = append(projectFrameworks, f)
		}
		sort.Strings(projectFrameworks)

		projectResponses = append(projectResponses, CommitmentProjectResponse{
			ObjectID:   project.ObjectID,
			Name:       project.Name,
			Status:     project.Status,
			Frameworks: projectFrameworks,
			Controls:   controls,
		})
	}

	resp := &CommitmentResponse{
		Organization: CommitmentOrganizationResponse{
			ObjectID:        org.ObjectID,
			Name:            org.OrganizationName,
			ShareCommitment: org.ShareCommitment,
		},
		Projects: projectResponses,
	}

	return resp, nil
}
