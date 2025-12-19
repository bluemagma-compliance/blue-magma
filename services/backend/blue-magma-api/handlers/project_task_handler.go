package handlers

import (
	"strconv"
	"strings"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"
	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type ProjectTaskHandler struct {
	DB *gorm.DB
}

func NewProjectTaskHandler(db *gorm.DB) *ProjectTaskHandler {
	return &ProjectTaskHandler{DB: db}
}

type ProjectTaskRequest struct {
	Title             string     `json:"title"`
	Description       string     `json:"description"`
	Notes             string     `json:"notes"`
	Status            string     `json:"status"`
	Priority          string     `json:"priority"`
	DueDate           *time.Time `json:"due_date"`
	DocumentID        *uint      `json:"document_id"`
	EvidenceRequestID *uint      `json:"evidence_request_id"`
	DependsOnTaskID   *string    `json:"depends_on_task_id"`
}

type ProjectTaskResponse struct {
	ObjectID          string     `json:"object_id"`
	ProjectID         uint       `json:"project_id"`
	Title             string     `json:"title"`
	Description       string     `json:"description"`
	Notes             string     `json:"notes"`
	Status            string     `json:"status"`
	Priority          string     `json:"priority"`
	DueDate           *time.Time `json:"due_date"`
	DocumentID        *uint      `json:"document_id"`
	EvidenceRequestID *uint      `json:"evidence_request_id"`
	DependsOnTaskID   *string    `json:"depends_on_task_id"`
}

// PaginatedProjectTasksResponse wraps a list of tasks with pagination metadata.
type PaginatedProjectTasksResponse struct {
	Items  []ProjectTaskResponse `json:"items"`
	Total  int64                 `json:"total"`
	Pages  int                   `json:"pages"`
	Limit  int                   `json:"limit"`
	Offset int                   `json:"offset"`
}

func buildProjectTaskResponse(task models.ProjectTask, project models.Project, dependsOnObjectID *string) ProjectTaskResponse {
	return ProjectTaskResponse{
		ObjectID:          task.ObjectID,
		ProjectID:         project.ID,
		Title:             task.Title,
		Description:       task.Description,
		Notes:             task.Notes,
		Status:            task.Status,
		Priority:          task.Priority,
		DueDate:           task.DueDate,
		DocumentID:        task.DocumentID,
		EvidenceRequestID: task.EvidenceRequestID,
		DependsOnTaskID:   dependsOnObjectID,
	}
}

func normalizeTaskStatus(status string) (string, bool) {
	s := strings.TrimSpace(strings.ToLower(status))
	if s == "" {
		return "todo", true
	}
	switch s {
	case "todo", "in_progress", "completed", "stuck":
		return s, true
	default:
		return "", false
	}
}

func normalizeTaskPriority(priority string) (string, bool) {
	p := strings.TrimSpace(strings.ToLower(priority))
	if p == "" {
		return "medium", true
	}
	switch p {
	case "low", "medium", "high", "critical":
		return p, true
	default:
		return "", false
	}
}

// GetProjectTasks returns all tasks for a project with pagination.
func (h *ProjectTaskHandler) GetProjectTasks(c *fiber.Ctx) error {
	projectID := c.Params("project_id")

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

	// Base query
	db := h.DB.Model(&models.ProjectTask{}).Where("project_id = ? AND organization_id = ?", project.ID, org.ID)

	// Filters
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		db = db.Where("status = ?", strings.ToLower(status))
	}
	if priority := strings.TrimSpace(c.Query("priority")); priority != "" {
		db = db.Where("priority = ?", strings.ToLower(priority))
	}
	if docID := strings.TrimSpace(c.Query("document_id")); docID != "" {
		if id, err := strconv.Atoi(docID); err == nil && id > 0 {
			db = db.Where("document_id = ?", uint(id))
		}
	}
	if erID := strings.TrimSpace(c.Query("evidence_request_id")); erID != "" {
		if id, err := strconv.Atoi(erID); err == nil && id > 0 {
			db = db.Where("evidence_request_id = ?", uint(id))
		}
	}

	// Optional title search. We distinguish between the presence of `q` in the
	// query string and its (trimmed) value:
	//   - If `q` is present but empty (e.g. `?q=`), we do not filter by title
	//     but later truncate the results to the top 5.
	//   - If `q` is present and non-empty, we filter by case-insensitive
	//     substring match on title and truncate to the top 5.
	hasQ := c.Context().QueryArgs().Has("q")
	q := strings.TrimSpace(c.Query("q"))
	if hasQ && q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		db = db.Where("LOWER(title) LIKE ?", pattern)
	}

	// Pagination:
	//   - When `q` is present (including empty), always return the top 5
	//     matches with no offset.
	//   - When `q` is absent, preserve the existing pagination behavior with a
	//     default limit of 50 (max 500) and caller-controlled offset.
	limit := 50
	offset := 0
	if hasQ {
		limit = 5
		// offset remains 0
	} else {
		if limitStr := c.Query("limit"); limitStr != "" {
			if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 500 {
				limit = parsedLimit
			}
		}

		if offsetStr := c.Query("offset"); offsetStr != "" {
			if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
				offset = parsedOffset
			}
		}
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		log.Errorf("Failed to count project tasks: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get tasks"})
	}

	var tasks []models.ProjectTask
	if err := db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&tasks).Error; err != nil {
		log.Errorf("Failed to get project tasks: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get tasks"})
	}

	// Preload dependency task object IDs in bulk to avoid N+1 queries when building responses.
	depIDSet := make(map[uint]struct{})
	for _, t := range tasks {
		if t.DependsOnTaskID != nil {
			depIDSet[*t.DependsOnTaskID] = struct{}{}
		}
	}

	depObjectIDs := make(map[uint]string, len(depIDSet))
	if len(depIDSet) > 0 {
		ids := make([]uint, 0, len(depIDSet))
		for id := range depIDSet {
			ids = append(ids, id)
		}
		var depTasks []models.ProjectTask
		if err := h.DB.Where("id IN ? AND project_id = ? AND organization_id = ?", ids, project.ID, org.ID).
			Find(&depTasks).Error; err != nil {
			log.Errorf("Failed to load dependency tasks: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get tasks"})
		}
		for _, dt := range depTasks {
			depObjectIDs[dt.ID] = dt.ObjectID
		}
	}

	items := make([]ProjectTaskResponse, 0, len(tasks))
	for _, t := range tasks {
		var dependsOnObjectID *string
		if t.DependsOnTaskID != nil {
			if objID, ok := depObjectIDs[*t.DependsOnTaskID]; ok {
				objCopy := objID
				dependsOnObjectID = &objCopy
			}
		}
		items = append(items, buildProjectTaskResponse(t, project, dependsOnObjectID))
	}

	pages := 0
	if limit > 0 {
		pages = int((total + int64(limit) - 1) / int64(limit))
	}

	return c.JSON(PaginatedProjectTasksResponse{
		Items:  items,
		Total:  total,
		Pages:  pages,
		Limit:  limit,
		Offset: offset,
	})
}

// GetProjectTask returns a single task by object_id.
func (h *ProjectTaskHandler) GetProjectTask(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	taskID := c.Params("task_id")

	org := c.Locals("organization").(models.Organization)

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	var task models.ProjectTask
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", taskID, project.ID, org.ID).
		First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Task not found"})
		}
		log.Errorf("Failed to get task: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get task"})
	}

	var dependsOnObjectID *string
	if task.DependsOnTaskID != nil {
		var depTask models.ProjectTask
		if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *task.DependsOnTaskID, project.ID, org.ID).
			First(&depTask).Error; err == nil {
			objCopy := depTask.ObjectID
			dependsOnObjectID = &objCopy
		} else if err != gorm.ErrRecordNotFound {
			log.Errorf("Failed to get dependency task: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get task"})
		}
	}

	return c.JSON(buildProjectTaskResponse(task, project, dependsOnObjectID))
}

// CreateProjectTask creates a new task for a project.
func (h *ProjectTaskHandler) CreateProjectTask(c *fiber.Ctx) error {
	projectID := c.Params("project_id")

	org := c.Locals("organization").(models.Organization)

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	var req ProjectTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if strings.TrimSpace(req.Title) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Title is required"})
	}

	status, ok := normalizeTaskStatus(req.Status)
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid status. Allowed: todo, in_progress, completed, stuck"})
	}

	priority, ok := normalizeTaskPriority(req.Priority)
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid priority. Allowed: low, medium, high, critical"})
	}

	// Validate optional associations
	var documentID *uint
	if req.DocumentID != nil {
		var document models.Document
		if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *req.DocumentID, project.ID, org.ID).
			First(&document).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
			}
			log.Errorf("Failed to get document: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
		}
		documentID = &document.ID
	}

	var evidenceRequestID *uint
	if req.EvidenceRequestID != nil {
		var er models.EvidenceRequest
		if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *req.EvidenceRequestID, project.ID, org.ID).
			First(&er).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return c.Status(404).JSON(fiber.Map{"error": "Evidence request not found"})
			}
			log.Errorf("Failed to get evidence request: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence request"})
		}
		evidenceRequestID = &er.ID
	}

	// Validate optional dependency on another task within the same project and organization.
	var dependsOnTaskID *uint
	if req.DependsOnTaskID != nil {
		depObjectID := strings.TrimSpace(*req.DependsOnTaskID)
		if depObjectID != "" {
			var depTask models.ProjectTask
			if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", depObjectID, project.ID, org.ID).
				First(&depTask).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return c.Status(404).JSON(fiber.Map{"error": "Dependency task not found"})
				}
				log.Errorf("Failed to get dependency task: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to get dependency task"})
			}
			dependsOnTaskID = &depTask.ID
		}
	}

	objectID, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	task := models.ProjectTask{
		ObjectID:          objectID,
		OrganizationID:    org.ID,
		ProjectID:         project.ID,
		DocumentID:        documentID,
		EvidenceRequestID: evidenceRequestID,
		DependsOnTaskID:   dependsOnTaskID,
		Title:             strings.TrimSpace(req.Title),
		Description:       strings.TrimSpace(req.Description),
		Notes:             strings.TrimSpace(req.Notes),
		Status:            status,
		Priority:          priority,
		DueDate:           req.DueDate,
	}

	if err := h.DB.Create(&task).Error; err != nil {
		log.Errorf("Failed to create task: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create task"})
	}

	var dependsOnObjectID *string
	if task.DependsOnTaskID != nil {
		// We just resolved this task above; look it up again to obtain its object_id for the response.
		var depTask models.ProjectTask
		if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *task.DependsOnTaskID, project.ID, org.ID).
			First(&depTask).Error; err == nil {
			objCopy := depTask.ObjectID
			dependsOnObjectID = &objCopy
		}
	}

	return c.Status(201).JSON(buildProjectTaskResponse(task, project, dependsOnObjectID))
}

// UpdateProjectTask updates an existing task.
func (h *ProjectTaskHandler) UpdateProjectTask(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	taskID := c.Params("task_id")

	org := c.Locals("organization").(models.Organization)

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	var task models.ProjectTask
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", taskID, project.ID, org.ID).
		First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Task not found"})
		}
		log.Errorf("Failed to get task: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get task"})
	}

	var req ProjectTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Title != "" {
		task.Title = strings.TrimSpace(req.Title)
	}
	if req.Description != "" {
		task.Description = strings.TrimSpace(req.Description)
	}
	if req.Notes != "" {
		task.Notes = strings.TrimSpace(req.Notes)
	}
	if req.Status != "" {
		status, ok := normalizeTaskStatus(req.Status)
		if !ok {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid status. Allowed: todo, in_progress, completed, stuck"})
		}
		task.Status = status
	}
	if req.Priority != "" {
		priority, ok := normalizeTaskPriority(req.Priority)
		if !ok {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid priority. Allowed: low, medium, high, critical"})
		}
		task.Priority = priority
	}

	// Update associations if provided
	if req.DocumentID != nil {
		if *req.DocumentID == 0 {
			// Clear association
			task.DocumentID = nil
		} else {
			var document models.Document
			if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *req.DocumentID, project.ID, org.ID).
				First(&document).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
				}
				log.Errorf("Failed to get document: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to get document"})
			}
			task.DocumentID = &document.ID
		}
	}

	if req.EvidenceRequestID != nil {
		if *req.EvidenceRequestID == 0 {
			task.EvidenceRequestID = nil
		} else {
			var er models.EvidenceRequest
			if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *req.EvidenceRequestID, project.ID, org.ID).
				First(&er).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return c.Status(404).JSON(fiber.Map{"error": "Evidence request not found"})
				}
				log.Errorf("Failed to get evidence request: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to get evidence request"})
			}
			task.EvidenceRequestID = &er.ID
		}
	}

	if req.DependsOnTaskID != nil {
		depObjectID := strings.TrimSpace(*req.DependsOnTaskID)
		if depObjectID == "" {
			// Clear dependency
			task.DependsOnTaskID = nil
		} else {
			var depTask models.ProjectTask
			if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", depObjectID, project.ID, org.ID).
				First(&depTask).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return c.Status(404).JSON(fiber.Map{"error": "Dependency task not found"})
				}
				log.Errorf("Failed to get dependency task: %v", err)
				return c.Status(500).JSON(fiber.Map{"error": "Failed to get dependency task"})
			}

			if depTask.ID == task.ID {
				return c.Status(400).JSON(fiber.Map{"error": "Task cannot depend on itself"})
			}

			task.DependsOnTaskID = &depTask.ID
		}
	}

	if req.DueDate != nil {
		task.DueDate = req.DueDate
	}

	if err := h.DB.Save(&task).Error; err != nil {
		log.Errorf("Failed to update task: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update task"})
	}

	var dependsOnObjectID *string
	if task.DependsOnTaskID != nil {
		var depTask models.ProjectTask
		if err := h.DB.Where("id = ? AND project_id = ? AND organization_id = ?", *task.DependsOnTaskID, project.ID, org.ID).
			First(&depTask).Error; err == nil {
			objCopy := depTask.ObjectID
			dependsOnObjectID = &objCopy
		} else if err != gorm.ErrRecordNotFound {
			log.Errorf("Failed to get dependency task: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update task"})
		}
	}

	return c.JSON(buildProjectTaskResponse(task, project, dependsOnObjectID))
}

// DeleteProjectTask deletes a task.
func (h *ProjectTaskHandler) DeleteProjectTask(c *fiber.Ctx) error {
	projectID := c.Params("project_id")
	taskID := c.Params("task_id")

	org := c.Locals("organization").(models.Organization)

	var project models.Project
	if err := h.DB.Where("object_id = ? AND organization_id = ?", projectID, org.ID).First(&project).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Project not found"})
		}
		log.Errorf("Failed to get project: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get project"})
	}

	var task models.ProjectTask
	if err := h.DB.Where("object_id = ? AND project_id = ? AND organization_id = ?", taskID, project.ID, org.ID).
		First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return c.Status(404).JSON(fiber.Map{"error": "Task not found"})
		}
		log.Errorf("Failed to get task: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to get task"})
	}

	if err := h.DB.Delete(&task).Error; err != nil {
		log.Errorf("Failed to delete task: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete task"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
