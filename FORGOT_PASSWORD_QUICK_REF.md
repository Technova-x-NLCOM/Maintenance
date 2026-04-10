# Forgot Password Feature - Quick Reference

## What Was Added

### 1. **Database Migration**
- File: `database/migrations/2026_04_10_000000_create_password_reset_tokens_table.php`
- Creates `password_reset_tokens` table to store reset tokens

### 2. **Email Mailable**
- File: `app/Mail/ResetPasswordMail.php`
- Handles email sending with custom HTML template

### 3. **Email Template**
- File: `resources/views/emails/reset-password.blade.php`
- Professional HTML email with inline styling

### 4. **Controller Methods** (in `AuthController.php`)
- `forgotPassword()` - Sends reset email
- `resetPassword()` - Completes password reset

### 5. **API Routes** (in `routes/web.php`)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Submit new password

---

## Quick Start for Developers

### Step 1: Run Migration
```bash
php artisan migrate
```

### Step 2: Configure Environment
Add to `.env`:
```
FRONTEND_URL=http://localhost:4200
MAIL_MAILER=smtp
MAIL_HOST=your-smtp-host
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM_ADDRESS=noreply@nlcom.com
```

### Step 3: Test Endpoints
```bash
# Request password reset
curl -X POST http://localhost:8000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Reset password (use token from email)
curl -X POST http://localhost:8000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "token": "60-char-token-here",
    "password": "NewPass123!",
    "password_confirmation": "NewPass123!"
  }'
```

### Step 4: Frontend Implementation
1. Create forgot password form
2. Call `POST /api/auth/forgot-password` with email
3. User receives reset link via email
4. Extract token and email from URL
5. Call `POST /api/auth/reset-password` with new password

---

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/forgot-password` | - | Send reset email |
| POST | `/api/auth/reset-password` | - | Complete reset |

---

## Security Features

✅ 60-minute token expiration
✅ SHA-256 token hashing
✅ Single-use tokens (deleted after reset)
✅ Email confidentiality (success message regardless)
✅ Strong password validation
✅ Bcrypt password hashing
✅ Null password handling

---

## Files Modified

1. `app/Http/Controllers/AuthController.php` - Added 2 methods
2. `routes/web.php` - Added 2 routes
3. `config/app.php` - Added frontend_url config
4. `.env` - Added FRONTEND_URL variable

## Files Created

1. `database/migrations/2026_04_10_000000_create_password_reset_tokens_table.php`
2. `app/Mail/ResetPasswordMail.php`
3. `resources/views/emails/reset-password.blade.php`

---

## Testing Checklist

- [ ] Migration runs successfully
- [ ] Forgot password endpoint returns 200
- [ ] Email is sent (check mail logs)
- [ ] Reset password endpoint validates token
- [ ] Reset password endpoint validates password strength
- [ ] Password is successfully updated in database
- [ ] Token is deleted after successful reset
- [ ] Expired tokens are rejected
- [ ] Invalid tokens are rejected

---

## Documentation

For detailed API documentation, see: `API Endpoints/PASSWORD_RESET_API.md`

---

**Ready to deploy!** 🚀
