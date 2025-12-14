package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupQuestionTestDB() *gorm.DB {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.Question{}, &models.Ruling{}, &models.FoundProperty{})
	return db
}

func TestCreateQuestion_Success(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	ruling := models.Ruling{ObjectID: "ruling1", OrganizationID: 1}

	db.Create(&ruling)

	app.Post("/api/v1/org/:org_id/question", handler.CreateQuestion)

	requestBody := QuestionRequest{
		Question: "What is the capital of France?",
		RulingId: "ruling1",
		Answer:   "Paris",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/org1/question", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
}

func TestCreateQuestion_InvalidRequest(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	app.Post("/api/v1/org/:org_id/question", handler.CreateQuestion)

	req := httptest.NewRequest("POST", "/api/v1/org/org1/question", bytes.NewReader([]byte(`invalid-json`)))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}

func TestCreateQuestion_RulingNotFound(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	app.Post("/api/v1/org/:org_id/question", handler.CreateQuestion)

	requestBody := QuestionRequest{
		Question: "What is the capital of France?",
		RulingId: "nonexistent-ruling",
		Answer:   "Paris",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("POST", "/api/v1/org/org1/question", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
}
func TestGetQuestion_Success(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	// Seed test data
	question := models.Question{
		ObjectID:       "question1",
		Question:       "What is the capital of France?",
		OrganizationID: 1,
	}
	db.Create(&question)

	app.Get("/api/v1/org/:org_id/question/:question_id", handler.GetQuestion)

	req := httptest.NewRequest("GET", "/api/v1/org/org1/question/question1", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var responseQuestion models.Question
	json.NewDecoder(resp.Body).Decode(&responseQuestion)
	assert.Equal(t, question.ObjectID, responseQuestion.ObjectID)
	assert.Equal(t, question.Question, responseQuestion.Question)
	// assert.Equal(t, org.ObjectID, responseQuestion.OrganizationID)
}

func TestGetQuestion_NotFound(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	app.Get("/api/v1/org/:org_id/question/:question_id", handler.GetQuestion)

	req := httptest.NewRequest("GET", "/api/v1/org/org1/question/nonexistent-question", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)

	var responseBody map[string]string
	json.NewDecoder(resp.Body).Decode(&responseBody)
	assert.Equal(t, "Question not found", responseBody["error"])
}

func TestGetQuestion_InternalServerError(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	// Simulate a database error by closing the DB connection
	sqlDB, _ := db.DB()
	sqlDB.Close()

	app.Get("/api/v1/org/:org_id/question/:question_id", handler.GetQuestion)

	req := httptest.NewRequest("GET", "/api/v1/org/org1/question/question1", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)

	var responseBody map[string]string
	json.NewDecoder(resp.Body).Decode(&responseBody)
	assert.Equal(t, "Failed to find organization", responseBody["error"])
}
func TestDeleteQuestion_Success(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	// Seed test data
	question := models.Question{
		ObjectID:       "question1",
		Question:       "What is the capital of France?",
		OrganizationID: 1,
	}
	db.Create(&question)

	app.Delete("/api/v1/org/:org_id/question/:question_id", handler.DeleteQuestion)

	req := httptest.NewRequest("DELETE", "/api/v1/org/org1/question/question1", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNoContent, resp.StatusCode)
}

func TestUpdateQuestion_Success(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	// Seed test data
	question := models.Question{
		ObjectID:       "question1",
		Question:       "What is the capital of France?",
		OrganizationID: 1,
	}
	db.Create(&question)

	app.Put("/api/v1/org/:org_id/question/:question_id", handler.UpdateQuestion)

	requestBody := QuestionRequest{
		Question: "What is the capital of Germany?",
		Answer:   "Berlin",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("PUT", "/api/v1/org/org1/question/question1", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var updatedQuestion models.Question
	json.NewDecoder(resp.Body).Decode(&updatedQuestion)
	assert.Equal(t, "What is the capital of Germany?", updatedQuestion.Question)
	assert.Equal(t, "Berlin", updatedQuestion.Answer)
}

func TestUpdateQuestion_NotFound(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)
	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	app.Put("/api/v1/org/:org_id/question/:question_id", handler.UpdateQuestion)

	requestBody := QuestionRequest{
		Question: "What is the capital of Germany?",
		Answer:   "Berlin",
	}
	body, _ := json.Marshal(requestBody)

	req := httptest.NewRequest("PUT", "/api/v1/org/org1/question/nonexistent-question", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)

	var responseBody map[string]string
	json.NewDecoder(resp.Body).Decode(&responseBody)
	assert.Equal(t, "Question not found", responseBody["error"])
}

func TestUpdateQuestion_InvalidRequest(t *testing.T) {
	app := fiber.New()
	db := setupQuestionTestDB()
	handler := NewQuestionHandler(db)

	org := models.Organization{
		ObjectID:         "org1",
		OrganizationName: "Test Org",
	}
	db.Create(&org)

	// Seed test data
	question := models.Question{
		ObjectID:       "question1",
		Question:       "What is the capital of France?",
		OrganizationID: 1,
	}
	db.Create(&question)

	app.Put("/api/v1/org/:org_id/question/:question_id", handler.UpdateQuestion)

	req := httptest.NewRequest("PUT", "/api/v1/org/org1/question/question1", bytes.NewReader([]byte(`invalid-json`)))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)

	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

	var responseBody map[string]string
	json.NewDecoder(resp.Body).Decode(&responseBody)
	assert.Equal(t, "Invalid request", responseBody["error"])
}
