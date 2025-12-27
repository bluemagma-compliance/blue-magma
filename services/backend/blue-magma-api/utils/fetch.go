package utils

import (
	"fmt"
	"io"
	"net/http"
	"time"
)

// Fetch performs a simple HTTP GET request and returns the response body as a byte slice.
// Appends the internal API key to the request headers for authentication.
func FetchInternal(url string) ([]byte, error) {
	client := &http.Client{
		Timeout: 10 * time.Second, // Set a timeout for the request
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	serviceToken := GetServiceToken()
	req.Header.Set("Authorization", serviceToken)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("non-OK HTTP status: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}
