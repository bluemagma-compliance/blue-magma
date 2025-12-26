# Super Admin System

## Overview

The Super Admin system provides a secure, separate authentication mechanism for system administrators with elevated privileges. It is completely independent from the regular user authentication system and includes multiple layers of security.

## Security Features

1. **Separate Authentication System**: Super admin authentication is completely separate from regular user authentication
2. **IP Whitelisting**: Super admins can only login from pre-configured IP addresses or CIDR ranges
3. **Email-based 2FA**: Two-factor authentication codes are sent to configured email addresses
4. **Short-lived JWT Tokens**: Access tokens expire after 20 minutes
5. **Origin IP Binding**: JWT tokens are bound to the IP address they were issued from
6. **Account Lockout**: Accounts are temporarily locked after multiple failed login attempts
7. **Audit Logging**: All super admin actions are logged

## Environment Variables

The following environment variables must be configured:

```bash
# Super Admin Credentials
SUPER_ADMIN_LOGIN_IDENTIFIER=your-super-admin-username
SUPER_ADMIN_PASSWORD=your-secure-password

# IP Whitelist (comma-separated IPs or CIDR ranges)
SUPER_ADMIN_ALLOWED_IPS=127.0.0.1,192.168.1.0/24,10.0.0.1

# 2FA Email Addresses (comma-separated)
SUPER_ADMIN_2FA_EMAILS=admin@example.com,security@example.com

# JWT Secret (must be at least 32 characters)
SUPER_ADMIN_JWT_SECRET=your-super-admin-jwt-secret-key-min-32-chars
```

## Database Schema

### SuperAdmin Table

```sql
CREATE TABLE super_admins (
    id SERIAL PRIMARY KEY,
    login_identifier VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    allowed_ips TEXT NOT NULL,
    two_factor_emails TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- 2FA fields
    two_factor_code VARCHAR(6),
    two_factor_code_expiration TIMESTAMP,
    two_factor_code_attempts INTEGER DEFAULT 0,
    
    -- Security tracking
    failed_login_count INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP,
    last_successful_login TIMESTAMP,
    last_login_ip VARCHAR(45),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Authentication Flow

### Step 1: Login Request

**Endpoint**: `POST /super-admin/auth/login`

**Request**:
```json
{
    "login_identifier": "super-admin",
    "password": "your-password"
}
```

**Process**:
1. Validates credentials
2. Checks if IP is in whitelist
3. Checks if account is active and not locked
4. Generates 6-digit 2FA code
5. Sends code to all configured email addresses
6. Code expires in 5 minutes

**Response** (Success):
```json
{
    "success": true,
    "message": "2FA code sent to configured email addresses"
}
```

### Step 2: 2FA Verification

**Endpoint**: `POST /super-admin/auth/verify-2fa`

**Request**:
```json
{
    "login_identifier": "super-admin",
    "code": "123456"
}
```

**Process**:
1. Validates 2FA code
2. Checks if code is not expired
3. Verifies IP is still whitelisted
4. Generates JWT token with origin IP embedded
5. Clears 2FA code
6. Records successful login

**Response** (Success):
```json
{
    "success": true,
    "message": "Authentication successful",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 1200
}
```

## Using Super Admin Endpoints

### Making Authenticated Requests

Include the JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.example.com/super-admin/api/status
```

### Token Validation

The super admin middleware validates:
1. Token is present and valid
2. Token is not expired
3. Origin IP in token matches current request IP
4. Super admin account is still active

### Example Protected Endpoint

```go
// In routes/super_admin_routes.go
protectedGroup := superAdminGroup.Group("/api")
protectedGroup.Use(middleware.AuthenticateSuperAdmin(db))
protectedGroup.Use(middleware.RequireSuperAdmin())

protectedGroup.Get("/users", superAdminHandler.ListAllUsers)
```

## Security Considerations

### IP Whitelisting

- Supports individual IPs: `192.168.1.1`
- Supports CIDR ranges: `192.168.1.0/24`
- Multiple entries separated by commas
- Always use the most restrictive whitelist possible

### Password Requirements

- Minimum 12 characters recommended
- Use a strong, unique password
- Store securely (e.g., in a password manager)
- Rotate regularly

### JWT Secret

- Must be at least 32 characters
- Use a cryptographically secure random string
- Never commit to version control
- Rotate periodically

### 2FA Email

- Use multiple email addresses for redundancy
- Use secure email accounts with 2FA enabled
- Monitor for suspicious 2FA codes

## Seeding Super Admin

The super admin is automatically seeded on application startup if the environment variables are configured. The seed script:

1. Checks if super admin with the login identifier exists
2. If exists, updates password, IPs, and emails to match env vars
3. If not exists, creates new super admin
4. Always ensures account is active

## Testing

Run the super admin tests:

```bash
cd services/backend/blue-magma-api
go test ./handlers -run TestSuperAdmin
go test ./authz -run TestSuperAdmin
go test ./utils -run TestIP
```

## Troubleshooting

### "IP address not whitelisted"

- Verify your current IP address
- Check SUPER_ADMIN_ALLOWED_IPS environment variable
- Ensure IP format is correct (individual IP or CIDR)

### "2FA code expired"

- 2FA codes expire after 5 minutes
- Request a new code by logging in again

### "Account is temporarily locked"

- Account locks after 5 failed login attempts
- Wait 15 minutes for automatic unlock
- Or manually update the database to unlock

### "Origin IP mismatch"

- Your IP address changed between login and API request
- This is a security feature to prevent token theft
- Login again from your current IP address

## Future Enhancements

- [ ] TOTP-based 2FA (Google Authenticator, Authy)
- [ ] Hardware security key support (WebAuthn)
- [ ] Session management and revocation
- [ ] Audit log viewer
- [ ] IP whitelist management UI
- [ ] Multi-factor authentication options

