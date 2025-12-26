# Super Admin Deployment Checklist

Use this checklist to ensure the super admin system is properly configured and deployed.

## Pre-Deployment

### Environment Configuration

- [ ] `SUPER_ADMIN_LOGIN_IDENTIFIER` is set
  - [ ] Not a common username (avoid "admin", "root", "superadmin")
  - [ ] Documented in secure location
  
- [ ] `SUPER_ADMIN_PASSWORD` is set
  - [ ] Minimum 16 characters
  - [ ] Contains uppercase, lowercase, numbers, and symbols
  - [ ] Not used anywhere else
  - [ ] Stored in password manager
  
- [ ] `SUPER_ADMIN_ALLOWED_IPS` is configured
  - [ ] Contains only necessary IPs/ranges
  - [ ] Tested and verified
  - [ ] Documented with purpose of each IP/range
  
- [ ] `SUPER_ADMIN_2FA_EMAILS` is configured
  - [ ] At least 2 email addresses
  - [ ] Email accounts have 2FA enabled
  - [ ] Email addresses are monitored
  - [ ] Documented who owns each email
  
- [ ] `SUPER_ADMIN_JWT_SECRET` is set
  - [ ] Minimum 32 characters
  - [ ] Cryptographically random
  - [ ] Not committed to version control
  - [ ] Stored in secure secrets manager

### Email Service Configuration

- [ ] Email service environment variables are set
  - [ ] `SMTP_HOST`
  - [ ] `SMTP_PORT`
  - [ ] `SMTP_USER`
  - [ ] `SMTP_PASSWORD`
  - [ ] `SMTP_FROM`
  
- [ ] Email service is tested and working
- [ ] Email delivery is monitored
- [ ] Spam filters are configured to allow 2FA emails

### Code Review

- [ ] All super admin code has been reviewed
- [ ] No hardcoded credentials
- [ ] No debug logging of sensitive data
- [ ] Error messages don't leak information
- [ ] Tests are passing

## Deployment

### Database

- [ ] Database migrations run successfully
- [ ] `super_admins` table exists
- [ ] Table has correct schema
- [ ] Indexes are created (if any)

### Application Startup

- [ ] Application starts without errors
- [ ] Super admin seeding completes successfully
- [ ] Log shows: "✅ Super admin seeded"
- [ ] No error messages in logs

### Initial Testing

- [ ] Can access login endpoint
  ```bash
  curl -X POST http://localhost:8080/super-admin/auth/login \
    -H "Content-Type: application/json" \
    -d '{"login_identifier": "YOUR_ID", "password": "YOUR_PASSWORD"}'
  ```
  
- [ ] 2FA email is received
- [ ] 2FA code works
  ```bash
  curl -X POST http://localhost:8080/super-admin/auth/verify-2fa \
    -H "Content-Type: application/json" \
    -d '{"login_identifier": "YOUR_ID", "code": "123456"}'
  ```
  
- [ ] JWT token is returned
- [ ] Protected endpoint works with token
  ```bash
  curl -X GET http://localhost:8080/super-admin/api/status \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```

## Security Verification

### IP Whitelisting

- [ ] Login from whitelisted IP succeeds
- [ ] Login from non-whitelisted IP fails with 403
- [ ] CIDR ranges work correctly
- [ ] Multiple IPs work correctly

### Authentication

- [ ] Invalid password fails with 401
- [ ] Invalid 2FA code fails with 401
- [ ] Expired 2FA code fails with 401
- [ ] Account lockout works after 5 failed attempts
- [ ] Account unlocks after 15 minutes

### JWT Token

- [ ] Token expires after 20 minutes
- [ ] Expired token fails with 401
- [ ] Token from different IP fails with 403
- [ ] Invalid token fails with 401
- [ ] Token contains correct claims

### Account Status

- [ ] Inactive account cannot login
- [ ] Locked account cannot login
- [ ] Failed login count increments
- [ ] Successful login clears failed count

## Monitoring Setup

### Logging

- [ ] Failed login attempts are logged
- [ ] Successful logins are logged
- [ ] IP mismatches are logged
- [ ] 2FA code generation is logged
- [ ] Token generation is logged

### Alerts

- [ ] Alert on multiple failed login attempts
- [ ] Alert on login from unexpected IP
- [ ] Alert on account lockout
- [ ] Alert on 2FA email delivery failure

### Metrics

- [ ] Track login attempts (success/failure)
- [ ] Track 2FA code generation
- [ ] Track token generation
- [ ] Track IP whitelist violations

## Documentation

- [ ] Super admin credentials documented in secure location
- [ ] IP whitelist documented with justification
- [ ] Email addresses documented with owners
- [ ] Recovery procedure documented
- [ ] Rotation schedule documented
- [ ] Team members trained on super admin system

## Post-Deployment

### Verification (24 hours after deployment)

- [ ] No unexpected errors in logs
- [ ] No failed login attempts (except testing)
- [ ] Email delivery working consistently
- [ ] No performance issues
- [ ] Monitoring alerts working

### Security Audit

- [ ] Review all super admin access logs
- [ ] Verify no unauthorized access attempts
- [ ] Confirm IP whitelist is appropriate
- [ ] Check for any security warnings
- [ ] Validate all security layers are working

## Ongoing Maintenance

### Weekly

- [ ] Review super admin access logs
- [ ] Check for failed login attempts
- [ ] Verify email delivery is working

### Monthly

- [ ] Review IP whitelist for changes
- [ ] Verify 2FA email addresses are current
- [ ] Check for any security updates needed
- [ ] Review and update documentation

### Quarterly

- [ ] Rotate super admin password
- [ ] Rotate JWT secret
- [ ] Review and update IP whitelist
- [ ] Audit super admin access patterns
- [ ] Update security documentation

### Annually

- [ ] Full security audit of super admin system
- [ ] Review and update all procedures
- [ ] Test disaster recovery procedures
- [ ] Update team training

## Emergency Procedures

### Account Locked

```sql
UPDATE super_admins 
SET failed_login_count = 0, 
    last_failed_login = NULL 
WHERE login_identifier = 'YOUR_ID';
```

### Password Reset

1. Update `SUPER_ADMIN_PASSWORD` environment variable
2. Restart application
3. Seed script will update password hash

### JWT Secret Rotation

1. Update `SUPER_ADMIN_JWT_SECRET` environment variable
2. Restart application
3. All existing tokens will be invalidated
4. Notify all super admins to login again

### IP Whitelist Update

1. Update `SUPER_ADMIN_ALLOWED_IPS` environment variable
2. Restart application
3. Seed script will update IP whitelist

### Email Address Update

1. Update `SUPER_ADMIN_2FA_EMAILS` environment variable
2. Restart application
3. Seed script will update email addresses

## Rollback Plan

If issues are encountered:

1. [ ] Document the issue
2. [ ] Revert code changes
3. [ ] Restore previous environment variables
4. [ ] Restart application
5. [ ] Verify regular functionality restored
6. [ ] Investigate and fix issue
7. [ ] Re-deploy with fixes

## Sign-Off

- [ ] Development team lead approval
- [ ] Security team approval
- [ ] Operations team approval
- [ ] Deployment date: _______________
- [ ] Deployed by: _______________
- [ ] Verified by: _______________

## Notes

Use this section to document any deployment-specific notes, issues encountered, or deviations from the standard process.

---

**Last Updated**: [Date]
**Next Review**: [Date]

