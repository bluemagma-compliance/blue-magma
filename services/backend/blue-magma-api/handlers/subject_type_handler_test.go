package handlers

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
)

func TestGetAllSubjectTypes_Success(t *testing.T) {
	app := fiber.New()
	mockData := []models.SubjectType{
		{Name: "Type1", ObjectID: "obj1"},
		{Name: "Type2", ObjectID: "obj2"},
	}
	db := setupTestDB(t)
	db.AutoMigrate(&models.SubjectType{})
	for _, subjectType := range mockData {
		db.Create(&subjectType)
	}
	handler := &SubjectTypeHandler{db: db}

	app.Get("/api/v1/subject-types", handler.GetAllSubjectTypes)

	req := httptest.NewRequest("GET", "/api/v1/subject-types", nil)
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var got []models.SubjectType
	err = json.NewDecoder(resp.Body).Decode(&got)
	assert.NoError(t, err)
	for i := range mockData {
		assert.Equal(t, mockData[i].Name, got[i].Name)
		assert.Equal(t, mockData[i].ObjectID, got[i].ObjectID)
	}
}
