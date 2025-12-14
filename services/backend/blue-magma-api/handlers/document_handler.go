package handlers

import (
	"encoding/json"
	"sort"
	"strings"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type DocumentHandler struct {
	DB *gorm.DB
}

func NewDocumentHandler(db *gorm.DB) *DocumentHandler {
	return &DocumentHandler{DB: db}
}

type DocumentRequest struct {
	TemplatePageID string `json:"template_page_id"`
	Title          string `json:"title"`
	Content        string `json:"content"`
	ParentID       *uint  `json:"parent_id"`
	Order          int    `json:"order"`
	Status         string `json:"status"`
	LastEditedBy   string `json:"last_edited_by"`
	// Optional integer relevance score (e.g. 0-100) for this page in the
	// organisation's context.
	RelevanceScore int `json:"relevance_score"`
}

type DocumentResponse struct {
	ObjectID       string `json:"object_id"`
	ProjectID      uint   `json:"project_id"`
	TemplatePageID string `json:"template_page_id"`
	Title          string `json:"title"`
	Content        string `json:"content"`
	ParentID       *uint  `json:"parent_id"`
	Order          int    `json:"order"`
	Status         string `json:"status"`
	Version        int    `json:"version"`
	LastEditedBy   string `json:"last_edited_by"`
	PageKind       string `json:"page_kind"`
	IsControl      bool   `json:"is_control"`
	RelevanceScore int    `json:"relevance_score"`
}

// inferDocumentPageKind derives a semantic page kind and control flag from the
// template_page_id. This keeps page typing out of the DB schema and lets
// clients distinguish between control, domain, risk, threat, and overview
// pages.
func inferDocumentPageKind(templatePageID string) (string, bool) {
	id := strings.ToLower(strings.TrimSpace(templatePageID))
	if id == "" {
		return "unknown", false
	}

	switch {
	case id == "controls-overview":
		return "overview", false
	case strings.HasPrefix(id, "domain-"):
		return "domain", false
	case strings.HasPrefix(id, "control-"):
		return "control", true
	case id == "risks-overview":
		return "risks_overview", false
	case id == "threats-overview":
		return "threats_overview", false
	case strings.HasPrefix(id, "risk-"):
		return "risk", false
	case strings.HasPrefix(id, "threat-"):
		return "threat", false
	default:
		return "other", false
	}
}

func buildDocumentResponse(doc models.Document, project models.Project) DocumentResponse {
	pageKind, isControl := inferDocumentPageKind(doc.TemplatePageID)
	return DocumentResponse{
		ObjectID:       doc.ObjectID,
		ProjectID:      project.ID,
		TemplatePageID: doc.TemplatePageID,
		Title:          doc.Title,
		Content:        doc.Content,
		ParentID:       doc.ParentID,
		Order:          doc.Order,
		Status:         doc.Status,
		Version:        doc.Version,
		LastEditedBy:   doc.LastEditedBy,
		PageKind:       pageKind,
		IsControl:      isControl,
		RelevanceScore: doc.RelevanceScore,
	}
}

// GetDocuments returns documents for a project. When an optional `q` query
// parameter is provided, results are filtered by a case-insensitive substring
// match on title (if non-empty) and the response is truncated to the top 5
// documents in the existing ordering. When `q` is not present, all documents
// are returned as before.
func (h *DocumentHandler) GetDocuments(c *fiber.Ctx) error {
	projectID := c.Params("project_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get documents for this project, optionally filtered by title. When `q`
	// is present (including empty), we truncate the results to the top 5 in
	// the existing ordering. When `q` is absent, we return all documents.
	var documents []models.Document
	db := h.DB.Where("project_id = ? AND organization_id = ?", project.ID, org.ID)
	hasQ := c.Context().QueryArgs().Has("q")
	q := strings.TrimSpace(c.Query("q"))
	if hasQ && q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		db = db.Where("LOWER(title) LIKE ?", pattern)
	}
	query := db.Order(`"order" ASC`)
	if hasQ {
		query = query.Limit(5)
	}
	if err := query.Find(&documents).Error; err != nil {
		log.Errorf("Failed to get documents: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get documents"})
	}

	response := make([]DocumentResponse, 0)
	for _, doc := range documents {
		response = append(response, buildDocumentResponse(doc, project))
	}

	return c.JSON(fiber.Map{
		"documents": response,
	})
}

// GetDocument returns a single document
func (h *DocumentHandler) GetDocument(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	documentID := c.Params("document_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get document
	var document models.Document
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", documentID, project.ID, org.ID).
		Preload("Evidence").
		Preload("EvidenceRequests").
		Preload("Children").
		First(&document).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
		}
		log.Errorf("Failed to get document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
	}

	return c.JSON(buildDocumentResponse(document, project))
}

// CreateDocument creates a new document
func (h *DocumentHandler) CreateDocument(c *fiber.Ctx) error {
	projectID := c.Params("project_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Parse request
	var req DocumentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate required fields
	if req.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Title is required"})
	}

	// Generate object ID
	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Set default status
	status := req.Status
	if status == "" {
		status = "draft"
	}

	// Create document
	document := models.Document{
		ObjectID:       objectID,
		OrganizationID: org.ID,
		ProjectID:      project.ID,
		TemplatePageID: req.TemplatePageID,
		Title:          req.Title,
		Content:        req.Content,
		ParentID:       req.ParentID,
		Order:          req.Order,
		Status:         status,
		Version:        1,
		LastEditedBy:   req.LastEditedBy,
		RelevanceScore: req.RelevanceScore,
	}

	if err := h.DB.Create(&document).Error; err != nil {
		log.Errorf("Failed to create document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create document"})
	}

	return c.Status(201).JSON(buildDocumentResponse(document, project))
}

// UpdateDocument updates an existing document
func (h *DocumentHandler) UpdateDocument(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	documentID := c.Params("document_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get document
	var document models.Document
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", documentID, project.ID, org.ID).First(&document).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
		}
		log.Errorf("Failed to get document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
	}

	// Parse request
	var req DocumentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Update fields
	if req.Title != "" {
		document.Title = req.Title
	}
	if req.Content != "" {
		document.Content = req.Content
		document.Version++ // Increment version on content change
	}
	if req.Status != "" {
		document.Status = req.Status
	}
	if req.LastEditedBy != "" {
		document.LastEditedBy = req.LastEditedBy
	}
	// RelevanceScore is allowed to be zero; we only update when the client
	// explicitly sends a non-zero value or when the request differs from the
	// current value and the client opted to change it. Since BodyParser will
	// default missing ints to 0, we can't rely on zero to distinguish "not
	// provided" from "set to 0" without a pointer type. To keep the API
	// simple, we accept that clients set RelevanceScore explicitly on update,
	// including setting it back to 0.
	document.RelevanceScore = req.RelevanceScore
	if req.ParentID != nil {
		document.ParentID = req.ParentID
	}
	document.Order = req.Order

	if err := h.DB.Save(&document).Error; err != nil {
		log.Errorf("Failed to update document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update document"})
	}

	return c.JSON(buildDocumentResponse(document, project))
}

// DeleteDocument deletes a document
func (h *DocumentHandler) DeleteDocument(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	documentID := c.Params("document_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get document
	var document models.Document
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", documentID, project.ID, org.ID).First(&document).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
		}
		log.Errorf("Failed to get document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
	}

	// Delete document (cascade will handle evidence and evidence requests)
	if err := h.DB.Delete(&document).Error; err != nil {
		log.Errorf("Failed to delete document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete document"})
	}

	return c.JSON(fiber.Map{"message": "Document deleted successfully"})
}

// GetDocumentTree returns the full document hierarchy
func (h *DocumentHandler) GetDocumentTree(c *fiber.Ctx) error {
	projectID := c.Params("project_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get all documents
	var documents []models.Document
	if err := h.DB.Where("project_id = ? AND organization_id = ?", project.ID, org.ID).
		Order(`"order" ASC`).
		Find(&documents).Error; err != nil {
		log.Errorf("Failed to get documents: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get documents"})
	}

	// Build tree structure. We use pointers throughout the intermediate tree to
	// ensure that child relationships are preserved at all depths.
	type TreeNode struct {
		DocumentResponse
		Children []*TreeNode `json:"children"`
	}

	nodeMap := make(map[uint]*TreeNode)
	var rootNodes []*TreeNode

	// First pass: create all nodes
	for _, doc := range documents {
		node := &TreeNode{
			DocumentResponse: buildDocumentResponse(doc, project),
			Children:         []*TreeNode{},
		}
		nodeMap[doc.ID] = node
	}

	// Second pass: build tree by wiring parents and children
	for _, doc := range documents {
		node := nodeMap[doc.ID]
		if doc.ParentID == nil {
			rootNodes = append(rootNodes, node)
		} else if parent, exists := nodeMap[*doc.ParentID]; exists {
			parent.Children = append(parent.Children, node)
		}
	}

	return c.JSON(fiber.Map{
		"tree": rootNodes,
	})
}

// GetDocumentFull returns a document with all related data (evidence with collections, evidence requests, children)
func (h *DocumentHandler) GetDocumentFull(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	documentID := c.Params("document_id")

	// Get organization
	org := c.Locals("organization").(models.Organization)

	// Get project
	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	// Get document
	var document models.Document
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", documentID, project.ID, org.ID).
		Preload("Children").
		First(&document).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
		}
		log.Errorf("Failed to get document: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
	}

	// Get evidence for this document
	var evidence []models.Evidence
	if err := h.DB.Where("document_id = ? AND organization_id = ?", document.ID, org.ID).
		Preload("Collection").
		Find(&evidence).Error; err != nil {
		log.Errorf("Failed to get evidence: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence"})
	}

	// Get evidence requests for this document
	var evidenceRequests []models.EvidenceRequest
	if err := h.DB.Where("document_id = ? AND organization_id = ?", document.ID, org.ID).
		Find(&evidenceRequests).Error; err != nil {
		log.Errorf("Failed to get evidence requests: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence requests"})
	}

	// Build response with full data
	type EvidenceWithCollection struct {
		ObjectID      string                 `json:"object_id"`
		Name          string                 `json:"name"`
		Description   string                 `json:"description"`
		Type          string                 `json:"type"`
		SourceID      string                 `json:"source_id"`
		SourceType    string                 `json:"source_type"`
		SourceMethod  string                 `json:"source_method"`
		SourceQuery   string                 `json:"source_query"`
		DateCollected string                 `json:"date_collected"`
		DateExpires   *string                `json:"date_expires"`
		Context       string                 `json:"context"`
		ValueType     string                 `json:"value_type"`
		Value         map[string]interface{} `json:"value"`
		ContentHash   string                 `json:"content_hash"`
		Group         string                 `json:"group"`
		Tags          []string               `json:"tags"`
		IsVerified    bool                   `json:"is_verified"`
		VerifiedBy    string                 `json:"verified_by"`
		VerifiedAt    *string                `json:"verified_at"`
		Collection    *models.Collection     `json:"collection,omitempty"`
	}

	evidenceWithCollections := make([]EvidenceWithCollection, 0)
	for _, evi := range evidence {
		var value map[string]interface{}
		if err := json.Unmarshal(evi.Value, &value); err != nil {
			log.Warnf("Failed to unmarshal evidence value: %v", err)
			value = make(map[string]interface{})
		}

		var dateExpires *string
		if evi.DateExpires != nil {
			expires := evi.DateExpires.Format("2006-01-02T15:04:05Z07:00")
			dateExpires = &expires
		}

		var verifiedAt *string
		if evi.VerifiedAt != nil {
			verified := evi.VerifiedAt.Format("2006-01-02T15:04:05Z07:00")
			verifiedAt = &verified
		}

		var tags []string
		if err := json.Unmarshal(evi.Tags, &tags); err != nil {
			log.Warnf("Failed to unmarshal evidence tags: %v", err)
			tags = make([]string, 0)
		}

		eviWithCol := EvidenceWithCollection{
			ObjectID:      evi.ObjectID,
			Name:          evi.Name,
			Description:   evi.Description,
			Type:          evi.Type,
			SourceID:      evi.SourceID,
			SourceType:    evi.SourceType,
			SourceMethod:  evi.SourceMethod,
			SourceQuery:   evi.SourceQuery,
			DateCollected: evi.DateCollected.Format("2006-01-02T15:04:05Z07:00"),
			DateExpires:   dateExpires,
			Context:       evi.Context,
			ValueType:     evi.ValueType,
			Value:         value,
			ContentHash:   evi.ContentHash,
			Group:         evi.Group,
			Tags:          tags,
			IsVerified:    evi.IsVerified,
			VerifiedBy:    evi.VerifiedBy,
			VerifiedAt:    verifiedAt,
		}

		// Include collection if it exists
		if evi.Collection != nil {
			eviWithCol.Collection = evi.Collection
		}

		evidenceWithCollections = append(evidenceWithCollections, eviWithCol)
	}

	// Load related pages via document relations so clients can navigate between
	// controls, risks, and threats without fetching additional documents.
	var relations []models.DocumentRelation
	if err := h.DB.
		Where("document_id = ? AND organization_id = ?", document.ID, org.ID).
		Preload("RelatedDocument").
		Find(&relations).Error; err != nil {
		log.Errorf("Failed to get document relations: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get related pages"})
	}

	type RelatedPage struct {
		ObjectID       string `json:"object_id"`
		TemplatePageID string `json:"template_page_id"`
		Title          string `json:"title"`
		Status         string `json:"status"`
		PageKind       string `json:"page_kind"`
		IsControl      bool   `json:"is_control"`
		RelationType   string `json:"relation_type"`
	}

	relatedPages := make([]RelatedPage, 0, len(relations))
	for _, rel := range relations {
		if rel.RelatedDocument.ID == 0 {
			continue
		}
		kind, isCtrl := inferDocumentPageKind(rel.RelatedDocument.TemplatePageID)
		relatedPages = append(relatedPages, RelatedPage{
			ObjectID:       rel.RelatedDocument.ObjectID,
			TemplatePageID: rel.RelatedDocument.TemplatePageID,
			Title:          rel.RelatedDocument.Title,
			Status:         rel.RelatedDocument.Status,
			PageKind:       kind,
			IsControl:      isCtrl,
			RelationType:   rel.RelationType,
		})
	}

	// Derive SCF metadata for control documents so clients can see which
	// frameworks and external control IDs apply to this page, consistent with
	// the public/private commitment views.
	var scfID string
	if document.SCFControlID != nil {
		scfID = strings.TrimSpace(*document.SCFControlID)
	}

	frameworks := make([]string, 0)
	if len(document.SCFFrameworkKeys) > 0 {
		if err := json.Unmarshal(document.SCFFrameworkKeys, &frameworks); err != nil {
			log.Errorf("Failed to unmarshal SCFFrameworkKeys for document %s: %v", document.ObjectID, err)
			frameworks = make([]string, 0)
		}
	}

	var frameworkMappings []CommitmentFrameworkMapping
	if scfID != "" {
		var mappings []models.SCFFrameworkMap
		if err := h.DB.Where("scf_object_id = ?", scfID).Find(&mappings).Error; err != nil {
			log.Errorf("Failed to load SCF framework mappings for control %s on document %s: %v", scfID, document.ObjectID, err)
		} else if len(mappings) > 0 {
			grouped := make(map[string]map[string]struct{})
			for _, m := range mappings {
				if m.ExternalID == "" {
					continue
				}
				if _, ok := grouped[m.Framework]; !ok {
					grouped[m.Framework] = make(map[string]struct{})
				}
				grouped[m.Framework][m.ExternalID] = struct{}{}
			}

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
				frameworkMappings = append(frameworkMappings, CommitmentFrameworkMapping{
					Framework:   fw,
					ExternalIDs: ids,
				})
			}
		}
	}

	pageKind, isControl := inferDocumentPageKind(document.TemplatePageID)

	return c.JSON(fiber.Map{
		"document": fiber.Map{
			"object_id":          document.ObjectID,
			"template_page_id":   document.TemplatePageID,
			"title":              document.Title,
			"content":            document.Content,
			"parent_id":          document.ParentID,
			"order":              document.Order,
			"status":             document.Status,
			"version":            document.Version,
			"last_edited_by":     document.LastEditedBy,
			"page_kind":          pageKind,
			"is_control":         isControl,
			"relevance_score":    document.RelevanceScore,
			"frameworks":         frameworks,
			"scf_id":             scfID,
			"framework_mappings": frameworkMappings,
		},
		"evidence":          evidenceWithCollections,
		"evidence_requests": evidenceRequests,
		"children":          document.Children,
		"related_pages":     relatedPages,
	})
}
