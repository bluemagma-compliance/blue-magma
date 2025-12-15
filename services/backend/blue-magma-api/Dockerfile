# ---------- Stage 1: Build ----------
    FROM golang:1.25.4-alpine AS builder

    # Install Git (required if your Go modules pull from Git sources)
    RUN apk add --no-cache git

    WORKDIR /app

    # Cache dependencies
    COPY ./go.mod ./go.sum ./
    RUN go mod download

    # Copy source code
    COPY . .

    # Build binary statically
    RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o blue-magma-api .

# ---------- Stage 2: Run ----------
FROM alpine:3.20

# Install certificates and curl for HTTPS and health checks
RUN apk add --no-cache ca-certificates curl

# Create a non-root user (recommended)
RUN adduser -D -g '' appuser

WORKDIR /app

# Copy binaries and default-data from builder stage
COPY --from=builder /app/blue-magma-api .
COPY --from=builder /app/default-data ./default-data


# Use a non-root user
USER appuser

# Expose your app's port
EXPOSE 8080

# Container healthcheck hitting the public /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the app directly
CMD ["./blue-magma-api"]