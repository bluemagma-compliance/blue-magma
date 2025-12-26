package utils

import (
	"fmt"
	"net"
	"strings"

	log "github.com/sirupsen/logrus"
)

// IsIPInWhitelist checks if the given IP address is in the whitelist
// The whitelist can contain individual IPs or CIDR ranges, separated by commas
func IsIPInWhitelist(ipAddress string, whitelist string) (bool, error) {
	if whitelist == "" {
		return false, fmt.Errorf("whitelist is empty")
	}

	if ipAddress == "" {
		return false, fmt.Errorf("IP address is empty")
	}

	// Parse the IP address
	ip := net.ParseIP(ipAddress)
	if ip == nil {
		return false, fmt.Errorf("invalid IP address: %s", ipAddress)
	}

	// Split whitelist by comma
	allowedEntries := strings.Split(whitelist, ",")

	for _, entry := range allowedEntries {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}

		// Check if entry is a CIDR range
		if strings.Contains(entry, "/") {
			_, ipNet, err := net.ParseCIDR(entry)
			if err != nil {
				log.Warnf("Invalid CIDR range in whitelist: %s", entry)
				continue
			}

			if ipNet.Contains(ip) {
				log.Debugf("IP %s matched CIDR range: %s", ipAddress, entry)
				return true, nil
			}
		} else {
			// Single IP address
			allowedIP := net.ParseIP(entry)
			if allowedIP == nil {
				log.Warnf("Invalid IP address in whitelist: %s", entry)
				continue
			}

			if ip.Equal(allowedIP) {
				log.Debugf("IP %s matched allowed IP: %s", ipAddress, entry)
				return true, nil
			}
		}
	}

	log.Debugf("IP %s not found in whitelist", ipAddress)
	return false, nil
}

// GetClientIP extracts the client IP address from the request
// It checks X-Forwarded-For, X-Real-IP headers, and falls back to RemoteAddr
func GetClientIP(xForwardedFor, xRealIP, remoteAddr string) string {
	// Check X-Forwarded-For header (can contain multiple IPs)
	if xForwardedFor != "" {
		// Take the first IP in the list (original client)
		ips := strings.Split(xForwardedFor, ",")
		if len(ips) > 0 {
			ip := strings.TrimSpace(ips[0])
			if ip != "" {
				return ip
			}
		}
	}

	// Check X-Real-IP header
	if xRealIP != "" {
		return strings.TrimSpace(xRealIP)
	}

	// Fall back to RemoteAddr
	// RemoteAddr is in format "IP:port", so we need to extract just the IP
	if remoteAddr != "" {
		host, _, err := net.SplitHostPort(remoteAddr)
		if err == nil {
			return host
		}
		// If SplitHostPort fails, return as-is (might be just an IP without port)
		return remoteAddr
	}

	return ""
}

