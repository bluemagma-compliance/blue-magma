package rediscache

import (
	"context"
	"crypto/tls"
	"fmt"
	"os"
	"strings"

	"github.com/redis/go-redis/v9"
	log "github.com/sirupsen/logrus"
)

func ConnectToRedis() *redis.Client {
	// Build address and credentials
	host := os.Getenv("REDIS_HOST")
	port := os.Getenv("REDIS_PORT")
	address := host + ":" + port
	username := os.Getenv("REDIS_USERNAME")
	password := os.Getenv("REDIS_PASSWORD")

	// Enable TLS automatically for AWS managed Redis-compatible endpoints
	var tlsConfig *tls.Config
	if strings.Contains(host, ".memorydb.") || strings.Contains(host, ".cache.amazonaws.com") {
		tlsConfig = &tls.Config{
			MinVersion: tls.VersionTLS12,
			ServerName: host, // SNI
		}
	}

	// Create a Redis client
	rdb := redis.NewClient(&redis.Options{
		Addr:      address,  // host:port
		Username:  username, // Redis ACL username (e.g., appuser)
		Password:  password, // Redis ACL password
		DB:        0,        // default DB
		TLSConfig: tlsConfig,
	})

	// Test the connection
	ctx := context.Background()
	pong, err := rdb.Ping(ctx).Result()
	if err != nil {
		panic(fmt.Sprintf("Could not connect to Redis: %v", err))
	}
	log.Info("✅ Connected to Redis:", pong)

	return rdb
}
