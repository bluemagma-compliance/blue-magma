package handlers

import (
	"time"

	"github.com/bluemagma-compliance/blue-magma-api/models"
)

// ActionableItemResponse represents an actionable item in the API response
type ActionableItemResponse struct {
	ObjectID    string     `json:"object_id"`
	RulingID    string     `json:"ruling_id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Severity    string     `json:"severity"`
	Priority    string     `json:"priority"`
	ProblemType string     `json:"problem_type"`
	ProposedFix string     `json:"proposed_fix"`
	FilePath    string     `json:"file_path"`
	LineNumber  *int       `json:"line_number"`
	Status      string     `json:"status"`
	AssignedTo  string     `json:"assigned_to"`
	DueDate     *time.Time `json:"due_date"`
	ResolvedAt  *time.Time `json:"resolved_at"`
	ResolvedBy  string     `json:"resolved_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// BuildActionableItemResponse builds an ActionableItemResponse from an ActionableItem model
func BuildActionableItemResponse(org models.Organization, item models.ActionableItem) ActionableItemResponse {
	var rulingID string
	if item.Ruling.ObjectID != "" {
		rulingID = item.Ruling.ObjectID
	}

	return ActionableItemResponse{
		ObjectID:    item.ObjectID,
		RulingID:    rulingID,
		Title:       item.Title,
		Description: item.Description,
		Severity:    item.Severity,
		Priority:    item.Priority,
		ProblemType: item.ProblemType,
		ProposedFix: item.ProposedFix,
		FilePath:    item.FilePath,
		LineNumber:  item.LineNumber,
		Status:      item.Status,
		AssignedTo:  item.AssignedTo,
		DueDate:     item.DueDate,
		ResolvedAt:  item.ResolvedAt,
		ResolvedBy:  item.ResolvedBy,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}
