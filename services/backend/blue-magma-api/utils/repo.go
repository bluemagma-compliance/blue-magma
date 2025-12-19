package utils

import (
	"net/url"
	"path"
	"strings"
)

// ExtractRepoNameFromURL extracts the repository name from a Git repository URL
// Supports various formats:
// - https://github.com/user/repo
// - https://github.com/user/repo.git
// - git@github.com:user/repo.git
// - ssh://git@github.com/user/repo.git
func ExtractRepoNameFromURL(repoURL string) string {
	if repoURL == "" {
		return ""
	}

	// Handle SSH URLs with git@ prefix
	if strings.HasPrefix(repoURL, "git@") {
		// Convert git@github.com:user/repo.git to github.com/user/repo.git
		parts := strings.SplitN(repoURL, ":", 2)
		if len(parts) == 2 {
			repoURL = "https://" + strings.Replace(parts[0], "git@", "", 1) + "/" + parts[1]
		}
	}

	// Parse the URL
	parsedURL, err := url.Parse(repoURL)
	if err != nil {
		// If URL parsing fails, try to extract from the string directly
		return extractRepoNameFromPath(repoURL)
	}

	// Get the path component
	repoPath := parsedURL.Path

	// Extract repository name from path
	return extractRepoNameFromPath(repoPath)
}

// extractRepoNameFromPath extracts the repository name from a path
func extractRepoNameFromPath(repoPath string) string {
	// Remove leading slash
	repoPath = strings.TrimPrefix(repoPath, "/")
	
	// Remove trailing slash
	repoPath = strings.TrimSuffix(repoPath, "/")
	
	// Remove .git suffix if present
	repoPath = strings.TrimSuffix(repoPath, ".git")
	
	// Get the base name (last part of the path)
	repoName := path.Base(repoPath)
	
	// If the path is just the repo name without user/org, return it
	if repoName != "." && repoName != "" {
		return repoName
	}
	
	// If we couldn't extract a name, return empty string
	return ""
}
