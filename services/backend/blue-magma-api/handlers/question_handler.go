package handlers

import (
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/crypto"

	"github.com/bluemagma-compliance/blue-magma-api/models"
	"github.com/gofiber/fiber/v2"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type QuestionHandler struct {
	DB *gorm.DB
}

func NewQuestionHandler(db *gorm.DB) *QuestionHandler {
	return &QuestionHandler{
		DB: db,
	}
}

type QuestionRequest struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
	RulingId string `json:"ruling_id"`
}

type CreateManyQuestionsRequest struct {
	Questions []QuestionRequest `json:"questions"`
	RulingId  string            `json:"ruling_id"`
}

type QuestionResponse struct {
	ObjectID        string                  `json:"object_id"`
	OrganizationID  string                  `json:"organization_id"`  // Foreign key to Organization
	Question        string                  `json:"question"`         // The question text
	Answer          string                  `json:"answer"`           // The answer text
	FoundProperties []FoundPropertyResponse `json:"found_properties"` // List of found properties related to the question
}

func BuildQuestionResponse(org models.Organization, question models.Question, foundProperties []models.FoundProperty) QuestionResponse {
	// Build the found properties response
	var foundPropertyResponses []FoundPropertyResponse
	for _, fp := range foundProperties {
		foundPropertyResponse := FoundPropertyResponse{
			ObjectID:       fp.ObjectID,
			Key:            fp.Key,
			Value:          fp.Value,
			PropertyType:   fp.PropertyType,
			OrganizationID: org.ObjectID,
			IsIssue:        fp.IsIssue,
			IssueSeverity:  fp.IssueSeverity,
		}
		foundPropertyResponses = append(foundPropertyResponses, foundPropertyResponse)
	}

	return QuestionResponse{
		ObjectID:        question.ObjectID,
		OrganizationID:  org.ObjectID,
		Question:        question.Question,
		Answer:          question.Answer,
		FoundProperties: foundPropertyResponses,
	}
}

// CreateQuestion creates a new question in the database
// @Summary Create a new question
// @Description Create a new question in the database
// @Tags question
// @Accept json
// @Produce json
// @Param question body QuestionRequest true "Question Request"
// @Param org_id path string true "Organization ID"
// @Success 201 {object} QuestionResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/question [post]
// @Security Bearer
func (h *QuestionHandler) CreateQuestion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var questionRequest QuestionRequest
	if err := c.BodyParser(&questionRequest); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	// make sure the question text is not empty
	if questionRequest.Question == "" {
		log.Errorf("Question text is empty")
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Question text is empty"})
	}

	var ruling models.Ruling
	if err := h.DB.Where("object_id = ? AND organization_id = ?", questionRequest.RulingId, org.ID).First(&ruling).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Ruling not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Ruling not found"})
		}
		log.Errorf("Failed to find ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find ruling"})
	}

	objectId, err := crypto.GenerateUUID()
	if err != nil {
		log.Errorf("Failed to generate UUID: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate UUID"})
	}

	// Create the question
	question := models.Question{
		ObjectID:       objectId,
		Question:       questionRequest.Question,
		RulingID:       ruling.ID,
		Ruling:         ruling,
		Answer:         "Pending",
		OrganizationID: org.ID,
		DateCreated:    time.Now().Format(time.RFC3339),
	}
	if err := h.DB.Create(&question).Error; err != nil {
		log.Errorf("Failed to create question: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create question"})
	}

	response := BuildQuestionResponse(org, question, []models.FoundProperty{})

	return c.Status(fiber.StatusCreated).JSON(response)
}

// CreateManyQuestions creates multiple questions in the database
// @Summary Create multiple questions
// @Description Create multiple questions in the database
// @Tags question
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param questions body CreateManyQuestionsRequest true "Create Many Questions Request"
// @Success 201 {array} QuestionResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/question/many [post]
// @Security Bearer
func (h *QuestionHandler) CreateManyQuestions(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	var createManyQuestionsRequest CreateManyQuestionsRequest
	if err := c.BodyParser(&createManyQuestionsRequest); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var ruling models.Ruling
	if err := h.DB.Where("object_id = ? AND organization_id = ?", createManyQuestionsRequest.RulingId, org.ID).First(&ruling).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Ruling not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Ruling not found"})
		}
		log.Errorf("Failed to find ruling: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find ruling"})
	}

	var questionResponses []QuestionResponse
	for _, questionReq := range createManyQuestionsRequest.Questions {
		if questionReq.Question == "" {
			log.Errorf("Question text is empty")
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Question text is empty"})
		}

		objectId, err := crypto.GenerateUUID()
		if err != nil {
			log.Errorf("Failed to generate UUID: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate UUID"})
		}

		question := models.Question{
			ObjectID:       objectId,
			RulingID:       ruling.ID,
			Ruling:         ruling,
			Question:       questionReq.Question,
			Answer:         questionReq.Answer,
			OrganizationID: org.ID,
			DateCreated:    time.Now().Format(time.RFC3339),
		}
		if err := h.DB.Create(&question).Error; err != nil {
			log.Errorf("Failed to create question: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create question"})
		}
		var foundProperties []models.FoundProperty
		if err := h.DB.Where("question_id = ?", question.ID).Find(&foundProperties).Error; err != nil {
			log.Errorf("Failed to find found properties for question: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find found properties for question"})
		}
		questionResponse := BuildQuestionResponse(org, question, foundProperties)
		questionResponses = append(questionResponses, questionResponse)
	}
	return c.Status(fiber.StatusCreated).JSON(questionResponses)
}

// GetQuestion retrieves a question by its ID
// @Summary Get a question by ID
// @Description Get a question by ID
// @Tags question
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param question_id path string true "Question ID"
// @Success 200 {object} QuestionResponse
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/question/{question_id} [get]
// @Security Bearer
func (h *QuestionHandler) GetQuestion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	questionId := c.Params("question_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var question models.Question
	if err := h.DB.Where("object_id = ? AND organization_id = ?", questionId, org.ID).First(&question).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Question not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Question not found"})
		}
		log.Errorf("Failed to find question: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find question"})
	}

	var foundProperties []models.FoundProperty
	if err := h.DB.Where("question_id = ?", question.ID).Find(&foundProperties).Error; err != nil {
		log.Errorf("Failed to find found properties for question: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find found properties for question"})
	}

	questionResponse := BuildQuestionResponse(org, question, foundProperties)

	return c.JSON(questionResponse)
}

// DeleteQuestion deletes a question by ID
// @Summary Delete a question by ID
// @Description Delete a question by ID
// @Tags question
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param question_id path string true "Question ID"
// @Success 204 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/question/{question_id} [delete]
// @Security Bearer
func (h *QuestionHandler) DeleteQuestion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	questionId := c.Params("question_id")

	org := models.Organization{}
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	if err := h.DB.Where("object_id = ? AND organization_id = ?", questionId, org.ID).Delete(&models.Question{}).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Question not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Question not found"})
		}
		log.Errorf("Failed to delete question: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete question"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// UpdateQuestion updates a question by ID
// @Summary Update a question by ID
// @Description Update a question by ID
// @Tags question
// @Accept json
// @Produce json
// @Param org_id path string true "Organization ID"
// @Param question_id path string true "Question ID"
// @Param question body QuestionRequest true "Question Request"
// @Success 200 {object} QuestionResponse
// @Failure 400 {object} fiber.Map
// @Failure 404 {object} fiber.Map
// @Failure 500 {object} fiber.Map
// @Router /api/v1/org/{org_id}/question/{question_id} [put]
// @Security Bearer
func (h *QuestionHandler) UpdateQuestion(c *fiber.Ctx) error {
	orgId := c.Params("org_id")
	questionId := c.Params("question_id")

	var questionRequest QuestionRequest
	if err := c.BodyParser(&questionRequest); err != nil {
		log.Errorf("Failed to parse request body: %v", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	var org models.Organization
	if err := h.DB.Where("object_id = ?", orgId).First(&org).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Organization not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Organization not found"})
		}
		log.Errorf("Failed to find organization: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find organization"})
	}

	var question models.Question
	if err := h.DB.Where("object_id = ? AND organization_id = ?", questionId, org.ID).First(&question).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Errorf("Question not found: %v", err)
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Question not found"})
		}
		log.Errorf("Failed to find question: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find question"})
	}

	// Update the question fields
	if questionRequest.Question != "" {
		question.Question = questionRequest.Question
	}
	if questionRequest.Answer != "" {
		question.Answer = questionRequest.Answer
	}

	if err := h.DB.Save(&question).Error; err != nil {
		log.Errorf("Failed to update question: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update question"})
	}
	var foundProperties []models.FoundProperty
	if err := h.DB.Where("question_id = ?", question.ID).Find(&foundProperties).Error; err != nil {
		log.Errorf("Failed to find found properties for question: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to find found properties for question"})
	}

	questionResponse := BuildQuestionResponse(org, question, foundProperties)

	return c.JSON(questionResponse)
}
