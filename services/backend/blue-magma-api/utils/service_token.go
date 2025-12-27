package utils

import "os"

// GetServiceToken returns the internal API key used for internal service-to-service
// requests. The logic for this function was moved from the middleware package into
// utils to avoid import cycles and keep middleware depending on utils, not vice versa.
func GetServiceToken() string {
	return os.Getenv("INTERNAL_API_KEY")
}

