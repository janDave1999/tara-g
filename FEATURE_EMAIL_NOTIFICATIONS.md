# Email Notifications Feature Specification

## Overview

Implement email notification system using MailerSend to send transactional emails to users. This system will handle welcome emails on signup and future notifications like trip reminders.

## Current State

- **Auth Provider**: Supabase Auth
- **Email Service**: MailerSend (already have account)
- **Deployment**: Cloudflare Pages with Edge Functions
- **Framework**: Astro

---

## Requirements

### 1. Environment Configuration

Add to `astro.config.mjs` and `.env`:

| Variable | Description | Required |
|----------|-------------|----------|
| `MAILERSEND_API_KEY` | MailerSend API key | Yes |
| `MAILERSEND_FROM_EMAIL` | Verified sender email | Yes |
| `MAILERSEND_FROM_NAME` | Sender display name | Yes (default: "Tara G") |

### 2. Email Types

| Email Type | Trigger | Priority |
|------------|---------|----------|
| Welcome Email | User completes registration | High |
| Trip Reminder | X days before trip date | Medium |
| Trip Update | Trip details changed | Medium |

### 3. Technical Components

#### 3.1 Email Utility Library
- **File**: `src/lib/email.ts`
- **Functions**:
  - `sendEmail(to, subject, html)` - Base send function
  - `sendWelcomeEmail(email, name)` - Welcome email
  - `sendTripReminder(email, trip)` - Trip reminder

#### 3.2 Email Templates
- Welcome email HTML template
- Trip reminder HTML template

#### 3.3 Integration Points
| Action | Integration | Method |
|--------|-------------|--------|
| Welcome email | Registration | Call email function in `/api/auth/register.ts` |

---

## Implementation Plan

### Phase 1: Setup ✅ COMPLETED

1. **Add environment variables** ✅
   - Updated `astro.config.mjs` schema
   - Added to `.env` file

2. **Install MailerSend SDK** ✅
   ```bash
   npm install mailersend
   ```

3. **Create email utility** ✅
   - `src/lib/email.ts` - Base send function + welcome/confirmation emails

### Phase 2: Integration ✅ COMPLETED

1. **Modify registration flow** ✅
   - Updated `/api/auth/register.ts` - uses custom confirmation via MailerSend
   - Uses `supabaseAdmin.auth.admin.createUser` with `email_confirm: false`

2. **Create confirmation endpoint** ✅
   - `/api/auth/confirm.ts` - handles token verification
   - Confirms user in Supabase Auth after token validation

3. **Update resend confirmation** ✅
   - Updated `/api/auth/resend-confirmation.ts`
   - Now uses MailerSend API instead of Supabase built-in

4. **Database migration** ✅
   - `database-migrations/036_add_confirmation_tokens.sql`
   - Adds columns: `confirmation_token`, `confirmation_token_expires_at`, `email_confirmed_at`

### Phase 3: Trip Reminders (Priority: Medium) - Pending

- Create scheduled function or database trigger
- Send reminders X days before trip

### Phase 3: Future Enhancements (Priority: Medium)

1. **Trip reminders**
   - Create scheduled function or database trigger
   - Send reminders X days before trip

2. **Email templates**
   - Move HTML to template files
   - Support templates with variables

---

## API Reference

### sendEmail()

```typescript
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>
```

### sendWelcomeEmail()

```typescript
interface WelcomeEmailParams {
  email: string;
  name: string;
}

sendWelcomeEmail(params: WelcomeEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }>
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/lib/email.ts` | Email utility library |
| `src/lib/email-templates/welcome.html` | Welcome email HTML |

### Modified Files
| File | Change |
|------|--------|
| `astro.config.mjs` | Add MAILERSEND env vars |
| `src/pages/api/auth/register.ts` | Call sendWelcomeEmail on signup |

### Environment Variables (in .env)
```
MAILERSEND_API_KEY=mlsn.xxxxxx
MAILERSEND_FROM_EMAIL=your-verified-email@domain.com
MAILERSEND_FROM_NAME=Tara G
```

> ⚠️ **IMPORTANT**: You must verify your sender email/domain in MailerSend before sending. Go to MailerSend Dashboard → Domains → Add and verify your domain, or verify a single email address.

---

## MailerSend Setup Checklist

- [ ] Create MailerSend account
- [ ] Verify sender domain or email
- [ ] Get API key
- [ ] Test API connection
- [ ] Design welcome email template
- [ ] Note: Free tier: 12,000 emails/month

---

## Acceptance Criteria

1. User receives welcome email after successful registration
2. Email contains user name personalization
3. Email renders correctly on desktop and mobile
4. API errors are logged but don't break user flow
5. Environment variables properly configured in production

---

## Notes

- MailerSend has a free tier: 12,000 emails/month
- Verified sender required - cannot send from unverified email
- HTML templates should be inline-styled for best email client support
- Consider adding unsubscribe link for compliance
