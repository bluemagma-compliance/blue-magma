# Super Admin Setup Guide

This guide will walk you through setting up the super admin system for Blue Magma.

## Prerequisites

- Access to the server environment variables
- Email service configured (for 2FA codes)
- Knowledge of your server's IP address or IP range

## Step 1: Configure Environment Variables

Add the following environment variables to your `.env` file or deployment configuration:

```bash
# Super Admin Login Credentials
SUPER_ADMIN_LOGIN_IDENTIFIER=admin
SUPER_ADMIN_PASSWORD=YourSecurePassword123!

# IP Whitelist
# Examples:
# - Single IP: 192.168.1.100
# - Multiple IPs: 192.168.1.100,10.0.0.50
# - CIDR range: 192.168.1.0/24
# - Mixed: 192.168.1.100,10.0.0.0/16,172.16.0.1
SUPER_ADMIN_ALLOWED_IPS=127.0.0.1

# 2FA Email Addresses (comma-separated)
SUPER_ADMIN_2FA_EMAILS=admin@yourcompany.com,security@yourcompany.com

# JWT Secret (minimum 32 characters)
# Generate with: openssl rand -base64 32
SUPER_ADMIN_JWT_SECRET=your-super-admin-jwt-secret-key-min-32-chars
```

### Generating a Secure JWT Secret

On Linux/Mac:
```bash
openssl rand -base64 32
```

On Windows (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Step 2: Determine Your IP Address

You need to whitelist the IP address(es) from which you'll access the super admin endpoints.

### Find Your Public IP

```bash
curl https://api.ipify.org
```

Or visit: https://whatismyipaddress.com/

### For Development (Local)

If running locally, use:
```bash
SUPER_ADMIN_ALLOWED_IPS=127.0.0.1,::1
```

### For Production

Use your office/VPN IP or CIDR range:
```bash
# Single office IP
SUPER_ADMIN_ALLOWED_IPS=203.0.113.50

# Office IP range
SUPER_ADMIN_ALLOWED_IPS=203.0.113.0/24

# Multiple locations
SUPER_ADMIN_ALLOWED_IPS=203.0.113.50,198.51.100.0/24,192.0.2.10
```

## Step 3: Start the Application

The super admin will be automatically created/updated on application startup.

```bash
cd services/backend/blue-magma-api
go run main.go
```

Look for this log message:
```
✅ Super admin seeded
```

## Step 4: Test the Login Flow

### 4.1 Request 2FA Code

```bash
curl -X POST http://localhost:8080/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "login_identifier": "admin",
    "password": "YourSecurePassword123!"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "2FA code sent to configured email addresses"
}
```

Check your email for the 6-digit code.

### 4.2 Verify 2FA Code

```bash
curl -X POST http://localhost:8080/super-admin/auth/verify-2fa \
  -H "Content-Type: application/json" \
  -d '{
    "login_identifier": "admin",
    "code": "123456"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Authentication successful",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 1200
}
```

### 4.3 Test Protected Endpoint

```bash
curl -X GET http://localhost:8080/super-admin/api/status \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected response:
```json
{
  "message": "Super admin authenticated",
  "login_identifier": "admin",
  "origin_ip": "127.0.0.1"
}
```

## Step 5: Verify Security Features

### Test IP Whitelisting

Try logging in from a non-whitelisted IP (should fail):
```bash
curl -X POST http://localhost:8080/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Real-IP: 1.2.3.4" \
  -d '{
    "login_identifier": "admin",
    "password": "YourSecurePassword123!"
  }'
```

Expected: `403 Forbidden` with message about IP not whitelisted.

### Test Token Expiry

Wait 20 minutes after getting a token, then try to use it (should fail).

### Test Origin IP Binding

Get a token from one IP, then try to use it from a different IP (should fail).

## Common Issues

### Issue: "Email service not configured"

**Solution**: Ensure your email service environment variables are set:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourcompany.com
```

### Issue: "IP address not whitelisted"

**Solutions**:
1. Verify your current IP: `curl https://api.ipify.org`
2. Check if IP is in SUPER_ADMIN_ALLOWED_IPS
3. If behind a proxy, check X-Forwarded-For header
4. For development, add `127.0.0.1` to whitelist

### Issue: "2FA code not received"

**Solutions**:
1. Check spam/junk folder
2. Verify SUPER_ADMIN_2FA_EMAILS is correct
3. Check email service logs
4. Verify email service is configured correctly

### Issue: "Origin IP mismatch"

**Cause**: Your IP changed between login and API request (e.g., VPN reconnect, mobile network switch)

**Solution**: Login again from your current IP

## Production Deployment Checklist

- [ ] Strong password set (minimum 16 characters, mixed case, numbers, symbols)
- [ ] JWT secret is cryptographically random (32+ characters)
- [ ] IP whitelist is as restrictive as possible
- [ ] Multiple 2FA email addresses configured
- [ ] Email service is working and monitored
- [ ] Environment variables are stored securely (not in code)
- [ ] Logs are monitored for failed login attempts
- [ ] Regular password rotation policy in place
- [ ] Backup access method documented

## Updating Super Admin Configuration

To update the super admin configuration:

1. Update the environment variables
2. Restart the application
3. The seed script will automatically update the super admin with new values

## Security Best Practices

1. **Use a VPN**: Always access super admin endpoints through a VPN
2. **Rotate Credentials**: Change password and JWT secret regularly
3. **Monitor Logs**: Watch for suspicious login attempts
4. **Limit Access**: Only whitelist necessary IPs
5. **Use Strong Passwords**: Minimum 16 characters with complexity
6. **Secure Email**: Use 2FA on email accounts receiving codes
7. **Document Access**: Keep a secure record of who has super admin access

## Next Steps

After setup, you can:

1. Create additional super admin endpoints in `routes/super_admin_routes.go`
2. Add super admin handlers in `handlers/`
3. Use the middleware to protect sensitive endpoints
4. Monitor super admin activity through audit logs

For more information, see [SUPER_ADMIN.md](./SUPER_ADMIN.md)

