package middleware

import (
	"fmt"
	"net/http"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/proxy"
	log "github.com/sirupsen/logrus"
)

func AwsIntegrationProxy(c *fiber.Ctx) error {
	awsIntegrationURL := os.Getenv("AWS_INTEGRATION_URL")
	if awsIntegrationURL == "" {
		log.Error("AWS_INTEGRATION_URL is not set")
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "AWS integration URL is not configured",
		})
	}

	// Construct the proxied URL
	proxyURL := fmt.Sprintf("%s%s", awsIntegrationURL, c.OriginalURL())
	log.Infof("Proxying request to: %s", proxyURL)

	// Add any necessary headers or modifications to the request here
	serviceToken := GetServiceToken()
	if serviceToken != "" {
		c.Request().Header.Set("Authorization", serviceToken)
	}

	// Perform the proxying
	if err := proxy.Do(c, proxyURL); err != nil {
		log.Errorf("Failed to proxy request: %v", err)
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to proxy request",
		})
	}

	// Remove the server header from the response
	c.Response().Header.Del(fiber.HeaderServer)
	return nil
}
