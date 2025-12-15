package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupProjectTaskTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	assert.NoError(t, err)

	err = db.AutoMigrate(&models.Organization{}, &models.Project{}, &models.Document{}, &models.EvidenceRequest{}, &models.ProjectTask{})
	assert.NoError(t, err)

	return db
}

func TestCreateAndListProjectTasks(t *testing.T) {
	app := fiber.New()
	db := setupProjectTaskTestDB(t)

	handler := NewProjectTaskHandler(db)

	// Seed org and project
	org := models.Organization{ObjectID: "org1", OrganizationName: "Test Org"}
	assert.NoError(t, db.Create(&org).Error)

	project := models.Project{ObjectID: "proj1", OrganizationID: org.ID, Name: "Test Project"}
	assert.NoError(t, db.Create(&project).Error)

	// Simple middleware to inject organization into context
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("organization", org)
		return c.Next()
	})

	app.Post("/api/v1/org/:org_id/project/:project_id/task", handler.CreateProjectTask)
	app.Get("/api/v1/org/:org_id/project/:project_id/task", handler.GetProjectTasks)

	due := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Second)

	// Create task
	createReq := ProjectTaskRequest{
		Title:       "Test Task",
		Description: "Do something important",
		Status:      "stuck",
		Priority:    "high",
		DueDate:     &due,
	}
	body, _ := json.Marshal(createReq)

	req := httptest.NewRequest("POST", "/api/v1/org/org1/project/proj1/task", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)

	// List tasks with pagination
	listReq := httptest.NewRequest("GET", "/api/v1/org/org1/project/proj1/task?limit=10&offset=0", nil)
	listResp, err := app.Test(listReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, listResp.StatusCode)

	var listResponse PaginatedProjectTasksResponse
	err = json.NewDecoder(listResp.Body).Decode(&listResponse)
	assert.NoError(t, err)
	assert.Equal(t, int64(1), listResponse.Total)
	assert.Equal(t, 1, listResponse.Pages)
	assert.Equal(t, 1, len(listResponse.Items))
	assert.Equal(t, "Test Task", listResponse.Items[0].Title)
}

func TestProjectTaskDependenciesAndNotes(t *testing.T) {
	app := fiber.New()
	db := setupProjectTaskTestDB(t)

	handler := NewProjectTaskHandler(db)

	// Seed org and project
	org := models.Organization{ObjectID: "org1", OrganizationName: "Test Org"}
	assert.NoError(t, db.Create(&org).Error)

	project := models.Project{ObjectID: "proj1", OrganizationID: org.ID, Name: "Test Project"}
	assert.NoError(t, db.Create(&project).Error)

	// Simple middleware to inject organization into context
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("organization", org)
		return c.Next()
	})

	basePath := "/api/v1/org/:org_id/project/:project_id/task"
	app.Post(basePath, handler.CreateProjectTask)
	app.Get(basePath, handler.GetProjectTasks)
	app.Get(basePath+"/:task_id", handler.GetProjectTask)
	app.Put(basePath+"/:task_id", handler.UpdateProjectTask)

	due := time.Now().Add(24 * time.Hour).UTC().Truncate(time.Second)

	// Create base task A with notes
	createReqA := ProjectTaskRequest{
		Title:       "Task A",
		Description: "Base task",
		Status:      "todo",
		Priority:    "medium",
		DueDate:     &due,
		Notes:       "Initial notes",
	}
	bodyA, _ := json.Marshal(createReqA)

	reqA := httptest.NewRequest("POST", "/api/v1/org/org1/project/proj1/task", bytes.NewReader(bodyA))
	reqA.Header.Set("Content-Type", "application/json")

	respA, err := app.Test(reqA)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respA.StatusCode)

	var taskAResp ProjectTaskResponse
	err = json.NewDecoder(respA.Body).Decode(&taskAResp)
	assert.NoError(t, err)
	assert.NotEmpty(t, taskAResp.ObjectID)
	assert.Equal(t, "Initial notes", taskAResp.Notes)

	// Create task B that depends on A
	depID := taskAResp.ObjectID
	createReqB := ProjectTaskRequest{
		Title:           "Task B",
		Description:     "Depends on A",
		Status:          "todo",
		Priority:        "high",
		DueDate:         &due,
		DependsOnTaskID: &depID,
	}
	bodyB, _ := json.Marshal(createReqB)

	reqB := httptest.NewRequest("POST", "/api/v1/org/org1/project/proj1/task", bytes.NewReader(bodyB))
	reqB.Header.Set("Content-Type", "application/json")

	respB, err := app.Test(reqB)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusCreated, respB.StatusCode)

	var taskBResp ProjectTaskResponse
	err = json.NewDecoder(respB.Body).Decode(&taskBResp)
	assert.NoError(t, err)
	assert.NotEmpty(t, taskBResp.ObjectID)
	if assert.NotNil(t, taskBResp.DependsOnTaskID) {
		assert.Equal(t, depID, *taskBResp.DependsOnTaskID)
	}

	// Update task B notes and clear dependency
	emptyDep := ""
	updateReqB := ProjectTaskRequest{
		Notes:           "Updated notes",
		DependsOnTaskID: &emptyDep,
	}
	bodyUpdateB, _ := json.Marshal(updateReqB)

	updateURL := "/api/v1/org/org1/project/proj1/task/" + taskBResp.ObjectID
	reqUpdate := httptest.NewRequest("PUT", updateURL, bytes.NewReader(bodyUpdateB))
	reqUpdate.Header.Set("Content-Type", "application/json")

	respUpdate, err := app.Test(reqUpdate)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, respUpdate.StatusCode)

	var updatedBResp ProjectTaskResponse
	err = json.NewDecoder(respUpdate.Body).Decode(&updatedBResp)
	assert.NoError(t, err)
	assert.Equal(t, "Updated notes", updatedBResp.Notes)
	assert.Nil(t, updatedBResp.DependsOnTaskID)
}

func TestGetProjectTasks_SearchAndTopFiveLimit(t *testing.T) {
	app := fiber.New()
	db := setupProjectTaskTestDB(t)

	handler := NewProjectTaskHandler(db)

	// Seed org and project
	org := models.Organization{ObjectID: "org1", OrganizationName: "Test Org"}
	assert.NoError(t, db.Create(&org).Error)

	project := models.Project{ObjectID: "proj1", OrganizationID: org.ID, Name: "Test Project"}
	assert.NoError(t, db.Create(&project).Error)

	// Middleware to inject organization
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("organization", org)
		return c.Next()
	})

	app.Get("/api/v1/org/:org_id/project/:project_id/task", handler.GetProjectTasks)

	// Create 10 tasks, 6 matching "alpha" in the title and 4 others.
	for i := 0; i < 6; i++ {
		task := models.ProjectTask{
			ObjectID:       fmt.Sprintf("alpha-%d", i),
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			Title:          fmt.Sprintf("Alpha Task %d", i),
			Status:         "todo",
			Priority:       "medium",
		}
		assert.NoError(t, db.Create(&task).Error)
	}
	for i := 0; i < 4; i++ {
		task := models.ProjectTask{
			ObjectID:       fmt.Sprintf("beta-%d", i),
			OrganizationID: org.ID,
			ProjectID:      project.ID,
			Title:          fmt.Sprintf("Beta Task %d", i),
			Status:         "todo",
			Priority:       "medium",
		}
		assert.NoError(t, db.Create(&task).Error)
	}

	// With q present but empty: should return the top 5 tasks with correct
	// metadata, without changing the underlying total.
	listReq := httptest.NewRequest("GET", "/api/v1/org/org1/project/proj1/task?q=", nil)
	listResp, err := app.Test(listReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, listResp.StatusCode)

	var listResponse PaginatedProjectTasksResponse
	assert.NoError(t, json.NewDecoder(listResp.Body).Decode(&listResponse))
	assert.Equal(t, int64(10), listResponse.Total)
	assert.Equal(t, 2, listResponse.Pages)
	assert.Equal(t, 5, listResponse.Limit)
	assert.Equal(t, 0, listResponse.Offset)
	assert.Len(t, listResponse.Items, 5)

	// With q=alpha: only alpha tasks should be returned, limited to 5
	// results even though there are 6 matches.
	searchReq := httptest.NewRequest("GET", "/api/v1/org/org1/project/proj1/task?q=alpha", nil)
	searchResp, err := app.Test(searchReq)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, searchResp.StatusCode)

	var searchResponse PaginatedProjectTasksResponse
	assert.NoError(t, json.NewDecoder(searchResp.Body).Decode(&searchResponse))
	assert.Equal(t, int64(6), searchResponse.Total)
	assert.Equal(t, 2, searchResponse.Pages)
	assert.Equal(t, 5, searchResponse.Limit)
	assert.Equal(t, 0, searchResponse.Offset)
	assert.Len(t, searchResponse.Items, 5)
	for _, item := range searchResponse.Items {
		assert.Contains(t, strings.ToLower(item.Title), "alpha")
	}
}
