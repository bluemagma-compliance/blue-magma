package models

import (
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"gorm.io/gorm"
)

// Service is the actual instance of a service
type CodebaseVersion struct {
	ID        uint `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	ObjectID       string       `gorm:"not null;uniqueIndex" json:"object_id"`
	OrganizationID uint         `json:"organization_id"`                                                                 // Foreign key to Organization
	Organization   Organization `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:OrganizationID" json:"-"` // Foreign key to Organization

	BranchName string `json:"branch_name"` // The branch name of the service version
	CommitHash string `json:"commit_hash"` // The commit hash of the service version

	IngestStatus string `json:"ingest_status"` // The status of the ingestion process (e.g., pending, completed, failed)
	Summary      string `json:"summary"`       // A summary of the codebase version

	CodebaseID uint     `json:"codebase_id"`                                                                 // Foreign key to Codebase
	Codebase   Codebase `json:"-" gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE;foreignKey:CodebaseID"` // Foreign key to Codebase

	Rulings         []Ruling         `gorm:"foreignKey:CodebaseVersionID" json:"rulings"`
}

func isTestMode() bool {
	return flag.Lookup("test.v") != nil
}

// BeforeDelete is a GORM hook that runs before deleting CodebaseVersion
func (cv *CodebaseVersion) BeforeDelete(tx *gorm.DB) (err error) {

	if isTestMode() {
		fmt.Println("Test mode detected, skipping BeforeDelete hook")
		return nil
	}

	fmt.Printf("Loading ObjectID for CodebaseVersion ID: %d\n", cv.ID)
	// Ensure ObjectID is loaded
	if cv.ObjectID == "" && cv.ID != 0 {

		var obj struct {
			ObjectID string
		}
		if err := tx.Model(cv).Select("object_id").Where("id = ?", cv.ID).First(&obj).Error; err != nil {
			return fmt.Errorf("failed to load ObjectID: %w", err)
		}
		cv.ObjectID = obj.ObjectID
	}

	// Compose the URL for the delete request
	url := fmt.Sprintf("http://rag-daddy:8000/collection/%s", cv.ObjectID)

	print("Deleting collection at URL: ", url, "\n")
	fmt.Println("CodebaseVersion ObjectID:", cv.ObjectID)

	// Send the DELETE request
	resp, err := http.DefaultClient.Do(&http.Request{
		Method: http.MethodDelete,
		URL:    mustParseURL(url),
	})
	if err != nil {
		return fmt.Errorf("failed to contact collection API: %w", err)
	}
	defer resp.Body.Close()

	// Check the response code
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNotFound {
		// Proceed with deletion
		return nil
	}

	// Stop the deletion
	return fmt.Errorf("collection delete failed: status code %d", resp.StatusCode)
}

func mustParseURL(rawURL string) *url.URL {
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil {
		panic(fmt.Sprintf("invalid URL: %s", rawURL))
	}
	return parsed
}
