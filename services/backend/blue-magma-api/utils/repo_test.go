package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExtractRepoNameFromURL(t *testing.T) {
	tests := []struct {
		name     string
		repoURL  string
		expected string
	}{
		{
			name:     "HTTPS GitHub URL",
			repoURL:  "https://github.com/user/repo",
			expected: "repo",
		},
		{
			name:     "HTTPS GitHub URL with .git",
			repoURL:  "https://github.com/user/repo.git",
			expected: "repo",
		},
		{
			name:     "SSH GitHub URL",
			repoURL:  "git@github.com:user/repo.git",
			expected: "repo",
		},
		{
			name:     "SSH GitHub URL without .git",
			repoURL:  "git@github.com:user/repo",
			expected: "repo",
		},
		{
			name:     "HTTPS GitLab URL",
			repoURL:  "https://gitlab.com/user/repo",
			expected: "repo",
		},
		{
			name:     "HTTPS GitLab URL with .git",
			repoURL:  "https://gitlab.com/user/repo.git",
			expected: "repo",
		},
		{
			name:     "SSH GitLab URL",
			repoURL:  "git@gitlab.com:user/repo.git",
			expected: "repo",
		},
		{
			name:     "Complex repo name with hyphens",
			repoURL:  "https://github.com/user/my-awesome-repo",
			expected: "my-awesome-repo",
		},
		{
			name:     "Complex repo name with underscores",
			repoURL:  "https://github.com/user/my_awesome_repo",
			expected: "my_awesome_repo",
		},
		{
			name:     "Organization with multiple levels",
			repoURL:  "https://github.com/org/suborg/repo",
			expected: "repo",
		},
		{
			name:     "URL with trailing slash",
			repoURL:  "https://github.com/user/repo/",
			expected: "repo",
		},
		{
			name:     "URL with trailing slash and .git",
			repoURL:  "https://github.com/user/repo.git/",
			expected: "repo",
		},
		{
			name:     "Just repo name (backend case)",
			repoURL:  "backend",
			expected: "backend",
		},
		{
			name:     "Empty URL",
			repoURL:  "",
			expected: "",
		},
		{
			name:     "Self-hosted Git server",
			repoURL:  "https://git.company.com/team/project",
			expected: "project",
		},
		{
			name:     "SSH with custom port",
			repoURL:  "ssh://git@git.company.com:2222/team/project.git",
			expected: "project",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractRepoNameFromURL(tt.repoURL)
			assert.Equal(t, tt.expected, result)
		})
	}
}
