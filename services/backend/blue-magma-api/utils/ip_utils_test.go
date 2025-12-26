package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsIPInWhitelist_SingleIP(t *testing.T) {
	tests := []struct {
		name      string
		ip        string
		whitelist string
		expected  bool
		hasError  bool
	}{
		{
			name:      "Exact match",
			ip:        "192.168.1.1",
			whitelist: "192.168.1.1",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "No match",
			ip:        "192.168.1.2",
			whitelist: "192.168.1.1",
			expected:  false,
			hasError:  false,
		},
		{
			name:      "Multiple IPs - first match",
			ip:        "192.168.1.1",
			whitelist: "192.168.1.1,10.0.0.1,172.16.0.1",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "Multiple IPs - middle match",
			ip:        "10.0.0.1",
			whitelist: "192.168.1.1,10.0.0.1,172.16.0.1",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "Multiple IPs - last match",
			ip:        "172.16.0.1",
			whitelist: "192.168.1.1,10.0.0.1,172.16.0.1",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "Multiple IPs - no match",
			ip:        "8.8.8.8",
			whitelist: "192.168.1.1,10.0.0.1,172.16.0.1",
			expected:  false,
			hasError:  false,
		},
		{
			name:      "Localhost",
			ip:        "127.0.0.1",
			whitelist: "127.0.0.1",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "Empty whitelist",
			ip:        "192.168.1.1",
			whitelist: "",
			expected:  false,
			hasError:  true,
		},
		{
			name:      "Empty IP",
			ip:        "",
			whitelist: "192.168.1.1",
			expected:  false,
			hasError:  true,
		},
		{
			name:      "Invalid IP",
			ip:        "not-an-ip",
			whitelist: "192.168.1.1",
			expected:  false,
			hasError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := IsIPInWhitelist(tt.ip, tt.whitelist)
			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestIsIPInWhitelist_CIDR(t *testing.T) {
	tests := []struct {
		name      string
		ip        string
		whitelist string
		expected  bool
		hasError  bool
	}{
		{
			name:      "IP in CIDR range /24",
			ip:        "192.168.1.100",
			whitelist: "192.168.1.0/24",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "IP not in CIDR range /24",
			ip:        "192.168.2.100",
			whitelist: "192.168.1.0/24",
			expected:  false,
			hasError:  false,
		},
		{
			name:      "IP in CIDR range /16",
			ip:        "192.168.50.100",
			whitelist: "192.168.0.0/16",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "IP not in CIDR range /16",
			ip:        "192.169.1.100",
			whitelist: "192.168.0.0/16",
			expected:  false,
			hasError:  false,
		},
		{
			name:      "Mixed single IP and CIDR - match CIDR",
			ip:        "192.168.1.50",
			whitelist: "10.0.0.1,192.168.1.0/24,172.16.0.1",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "Mixed single IP and CIDR - match single IP",
			ip:        "10.0.0.1",
			whitelist: "10.0.0.1,192.168.1.0/24,172.16.0.1",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "Mixed single IP and CIDR - no match",
			ip:        "8.8.8.8",
			whitelist: "10.0.0.1,192.168.1.0/24,172.16.0.1",
			expected:  false,
			hasError:  false,
		},
		{
			name:      "CIDR /32 (single IP)",
			ip:        "192.168.1.1",
			whitelist: "192.168.1.1/32",
			expected:  true,
			hasError:  false,
		},
		{
			name:      "CIDR /32 no match",
			ip:        "192.168.1.2",
			whitelist: "192.168.1.1/32",
			expected:  false,
			hasError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := IsIPInWhitelist(tt.ip, tt.whitelist)
			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestGetClientIP(t *testing.T) {
	tests := []struct {
		name           string
		xForwardedFor  string
		xRealIP        string
		remoteAddr     string
		expectedIP     string
	}{
		{
			name:           "X-Forwarded-For single IP",
			xForwardedFor:  "192.168.1.1",
			xRealIP:        "",
			remoteAddr:     "10.0.0.1:12345",
			expectedIP:     "192.168.1.1",
		},
		{
			name:           "X-Forwarded-For multiple IPs",
			xForwardedFor:  "192.168.1.1, 10.0.0.1, 172.16.0.1",
			xRealIP:        "",
			remoteAddr:     "10.0.0.1:12345",
			expectedIP:     "192.168.1.1",
		},
		{
			name:           "X-Real-IP when no X-Forwarded-For",
			xForwardedFor:  "",
			xRealIP:        "192.168.1.1",
			remoteAddr:     "10.0.0.1:12345",
			expectedIP:     "192.168.1.1",
		},
		{
			name:           "RemoteAddr when no headers",
			xForwardedFor:  "",
			xRealIP:        "",
			remoteAddr:     "192.168.1.1:12345",
			expectedIP:     "192.168.1.1",
		},
		{
			name:           "X-Forwarded-For takes precedence",
			xForwardedFor:  "192.168.1.1",
			xRealIP:        "10.0.0.1",
			remoteAddr:     "172.16.0.1:12345",
			expectedIP:     "192.168.1.1",
		},
		{
			name:           "X-Real-IP takes precedence over RemoteAddr",
			xForwardedFor:  "",
			xRealIP:        "192.168.1.1",
			remoteAddr:     "10.0.0.1:12345",
			expectedIP:     "192.168.1.1",
		},
		{
			name:           "RemoteAddr without port",
			xForwardedFor:  "",
			xRealIP:        "",
			remoteAddr:     "192.168.1.1",
			expectedIP:     "192.168.1.1",
		},
		{
			name:           "Empty all",
			xForwardedFor:  "",
			xRealIP:        "",
			remoteAddr:     "",
			expectedIP:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetClientIP(tt.xForwardedFor, tt.xRealIP, tt.remoteAddr)
			assert.Equal(t, tt.expectedIP, result)
		})
	}
}

