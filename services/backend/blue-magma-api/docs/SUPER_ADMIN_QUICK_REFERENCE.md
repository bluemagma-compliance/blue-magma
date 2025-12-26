# Super Admin Quick Reference

## Environment Variables

```bash
SUPER_ADMIN_LOGIN_IDENTIFIER=admin
SUPER_ADMIN_PASSWORD=your-secure-password
SUPER_ADMIN_ALLOWED_IPS=127.0.0.1,192.168.1.0/24
SUPER_ADMIN_2FA_EMAILS=admin@example.com,security@example.com
SUPER_ADMIN_JWT_SECRET=your-super-admin-jwt-secret-key-min-32-chars
```

## API Endpoints

### Login (Step 1)
```bash
POST /super-admin/auth/login
Content-Type: application/json

{
  "login_identifier": "admin",
  "password": "your-password"
}

Response: {
  "success": true,
  "message": "2FA code sent to configured email addresses"
}
```

### Verify 2FA (Step 2)
```bash
POST /super-admin/auth/verify-2fa
Content-Type: application/json

{
  "login_identifier": "admin",
  "code": "123456"
}

Response: {
  "success": true,
  "message": "Authentication successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1200
}
```

### Protected Endpoint
```bash
GET /super-admin/api/status
Authorization: Bearer YOUR_ACCESS_TOKEN

Response: {
  "message": "Super admin authenticated",
  "login_identifier": "admin",
  "origin_ip": "127.0.0.1"
}
```

## cURL Examples

### Complete Flow
```bash
# Step 1: Login
curl -X POST http://localhost:8080/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login_identifier": "admin", "password": "your-password"}'

# Step 2: Verify 2FA (check email for code)
curl -X POST http://localhost:8080/super-admin/auth/verify-2fa \
  -H "Content-Type: application/json" \
  -d '{"login_identifier": "admin", "code": "123456"}'

# Step 3: Use token
TOKEN="your-access-token-here"
curl -X GET http://localhost:8080/super-admin/api/status \
  -H "Authorization: Bearer $TOKEN"
```

## Code Examples

### Adding a Protected Endpoint

```go
// In routes/super_admin_routes.go
protectedGroup.Get("/users", func(c *fiber.Ctx) error {
    ctx := middleware.GetSuperAdminContext(c)
    // ctx.LoginIdentifier - who is making the request
    // ctx.OriginIP - IP they logged in from
    
    // Your logic here
    return c.JSON(fiber.Map{"users": users})
})
```

### Using Super Admin Context

```go
// In your handler
func MyHandler(c *fiber.Ctx) error {
    ctx := middleware.GetSuperAdminContext(c)
    if ctx == nil {
        return c.Status(403).JSON(fiber.Map{"error": "not authenticated"})
    }
    
    log.Infof("Super admin %s from IP %s accessed endpoint", 
        ctx.LoginIdentifier, ctx.OriginIP)
    
    // Your logic here
}
```

## Database Queries

### Check Super Admin Status
```sql
SELECT login_identifier, is_active, failed_login_count, 
       last_successful_login, last_login_ip
FROM super_admins;
```

### Unlock Account
```sql
UPDATE super_admins 
SET failed_login_count = 0, last_failed_login = NULL 
WHERE login_identifier = 'admin';
```

### Disable Account
```sql
UPDATE super_admins 
SET is_active = false 
WHERE login_identifier = 'admin';
```

### View Login History
```sql
SELECT login_identifier, last_successful_login, last_login_ip, 
       failed_login_count, last_failed_login
FROM super_admins
ORDER BY last_successful_login DESC;
```

## Common Issues & Solutions

### "IP address not whitelisted"
```bash
# Check your IP
curl https://api.ipify.org

# Update whitelist
SUPER_ADMIN_ALLOWED_IPS=127.0.0.1,YOUR_IP
```

### "2FA code expired"
- Codes expire after 5 minutes
- Request a new code by logging in again

### "Account is temporarily locked"
- Locked after 5 failed attempts
- Auto-unlocks after 15 minutes
- Or manually unlock with SQL query above

### "Origin IP mismatch"
- Your IP changed between login and request
- Login again from current IP

## Security Checklist

- [ ] Strong password (16+ characters)
- [ ] Secure JWT secret (32+ characters)
- [ ] Restrictive IP whitelist
- [ ] Multiple 2FA email addresses
- [ ] Email accounts have 2FA enabled
- [ ] Regular password rotation
- [ ] Monitor failed login attempts

## Token Information

- **Expiry**: 20 minutes
- **Algorithm**: HS256
- **Claims**: login_identifier, origin_ip, exp, iat, iss
- **Issuer**: blue-magma-super-admin

## IP Whitelist Format

```bash
# Single IP
SUPER_ADMIN_ALLOWED_IPS=192.168.1.100

# Multiple IPs
SUPER_ADMIN_ALLOWED_IPS=192.168.1.100,10.0.0.50,172.16.0.1

# CIDR range
SUPER_ADMIN_ALLOWED_IPS=192.168.1.0/24

# Mixed
SUPER_ADMIN_ALLOWED_IPS=192.168.1.100,10.0.0.0/16,172.16.0.1
```

## Testing

```bash
# Run all super admin tests
go test ./handlers -run TestSuperAdmin -v
go test ./authz -run TestSuperAdmin -v
go test ./utils -run TestIP -v

# Run specific test
go test ./handlers -run TestSuperAdminLogin_Success -v
```

## Files Reference

- **Model**: `models/super_admin.go`
- **Seeder**: `database/seed_super_admin.go`
- **JWT**: `authz/super_admin_jwt.go`
- **Handlers**: `handlers/super_admin_auth_handler.go`
- **Middleware**: `middleware/super_admin_auth.go`
- **Routes**: `routes/super_admin_routes.go`
- **Utils**: `utils/ip_utils.go`

## Documentation

- **Full Docs**: `docs/SUPER_ADMIN.md`
- **Setup Guide**: `docs/SUPER_ADMIN_SETUP.md`
- **Deployment**: `docs/SUPER_ADMIN_DEPLOYMENT_CHECKLIST.md`

