# Security Audit Report

**Project:** Travel Trip Application (Astro + Cloudflare Workers + Supabase)  
**Date:** February 21, 2026  
**Auditor:** Automated Security Analysis

---

## Executive Summary

This report documents security findings identified during code review of the travel trip application. The application has a solid security foundation with proper input validation, authentication flows, and error handling. However, several areas require attention to strengthen the security posture.

**Overall Risk Rating:** Medium

---

## Critical Findings

### 1. Insecure Direct Object Reference (IDOR) in Trips API

**Location:** `src/pages/api/trips/owned.ts:6-16`

**Description:** The endpoint accepts `userId` directly from the request body without verifying that the authenticated user owns that ID. Any authenticated user can retrieve trip data for any other user.

```typescript
// Current vulnerable code
const body = await request.json() as {
  userId: string;  // No authorization check
  ...
};
const { userId, ... } = body;
```

**Impact:** Users can access private trip data of other users.

**Recommendation:** 
```typescript
export const POST: APIRoute = async ({ request, locals }) => {
  const authenticatedUserId = locals.user_id; // From auth middleware
  const { userId, ... } = await request.json();
  
  // Verify ownership
  if (authenticatedUserId !== userId) {
    return handleApiError(new AuthorizationError('Access denied'));
  }
  // Proceed...
};
```

---

### 2. JWT Token Not Verified

**Location:** `src/middleware/auth.ts:27`

**Description:** JWT tokens are decoded and used to set user context, but the signature is never verified. The code trusts any valid-looking JWT without checking cryptographic signatures.

```typescript
// Current - NO SIGNATURE VERIFICATION
const payload = decodeJwt(accessToken); // Line 27
// Token signature not verified!
locals.user_id = payload.sub;
```

**Impact:** Attackers could craft malicious tokens if they can guess the secret (which they cannot, but this is defense-in-depth failure).

**Recommendation:** Use Supabase's built-in token verification:
```typescript
const { data: { user }, error } = await supabase.auth.getUser(accessToken);
if (user) {
  locals.user_id = user.id;
}
```

---

### 3. In-Memory Rate Limiting Ineffective

**Location:** `src/lib/rateLimit.ts`

**Description:** Rate limiting uses in-memory `Map` which doesn't persist across Cloudflare Worker instances. Each request may hit a different worker with empty rate limit state.

```typescript
const store = new Map<string, Record>(); // Line 16
```

**Impact:** Rate limiting can be bypassed by distributing requests across workers.

**Recommendation:** Use Cloudflare Rate Limiting rules in `wrangler.jsonc` or use a distributed store like Redis/Supabase.

---

## High Findings

### 4. Session Token Lifetime Too Long

**Location:** `src/middleware/auth.ts:45` and `src/pages/api/auth/signin.ts:137`

**Description:** Access tokens have 7-day (604800 seconds) lifetime. Sensitive access tokens should have shorter lifespans.

```typescript
maxAge: 60 * 60 * 24 * 7, // 7 days - Line 45
```

**Recommendation:** Reduce access token maxAge to 1-4 hours. Use refresh tokens for extended sessions.

---

### 5. Session ID Cookie Missing HttpOnly Flag

**Location:** `src/pages/api/auth/signin.ts:142`

**Description:** The `sb-session-id` cookie is set without `httpOnly: true`, making it accessible to JavaScript and vulnerable to XSS theft.

```typescript
cookies.set("sb-session-id", sessionId, cookieOptions);
// cookieOptions doesn't include httpOnly: true
```

**Recommendation:**
```typescript
const cookieOptions = {
  path: "/",
  httpOnly: true,  // Add this
  secure: import.meta.env.PROD,
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 24 * 7,
};
```

---

### 6. IP Spoofing via X-Forwarded-For

**Location:** `src/lib/rateLimit.ts:36-40`

**Description:** Client IP is extracted from `X-Forwarded-For` header which can be easily spoofed by attackers.

```typescript
request.headers.get("X-Forwarded-For")?.split(",")[0].trim() // Can be spoofed
```

**Recommendation:** 
1. Trust only Cloudflare-provided headers (`CF-Connecting-IP`)
2. If using behind proxy, validate at proxy level

---

## Medium Findings

### 7. Missing Authorization in Trip Member Actions

**Location:** `src/actions/trips.ts` - multiple actions

**Description:** Several trip actions check user authentication but don't verify the user has proper permissions for the specific operation (e.g., removing members, approving requests).

**Affected Actions:**
- `approveJoinRequest` (line 1300)
- `rejectJoinRequest` (line 1331)
- `removeTripMember` (line 1361)

**Recommendation:** Add authorization checks to verify the user has permission:
```typescript
// Verify user is trip owner or admin before allowing member removal
const { data: member } = await supabaseAdmin
  .from('trip_members')
  .select('role')
  .eq('trip_id', input.tripId)
  .eq('user_id', user.id)
  .single();

if (member?.role !== 'owner' && member?.role !== 'admin') {
  throw new ActionError({ code: 'FORBIDDEN', message: 'Not authorized' });
}
```

---

### 8. Development Error Messages in Production

**Location:** `src/lib/errorHandler.ts:75`

**Description:** Error details are exposed in production when `NODE_ENV === 'development'`, but this check may not work as expected in Cloudflare Workers.

```typescript
message: process.env.NODE_ENV === 'development' ? error.message : undefined
```

**Recommendation:** Use Cloudflare's `import.meta.env.PROD` instead and ensure proper environment variable configuration.

---

### 9. Insufficient Password Strength Requirements

**Location:** `src/lib/validation.ts:99-103`

**Description:** Password policy requires only 8 chars + uppercase + lowercase + number. Consider:
- Adding special character requirement
- Not allowing commonly breached passwords
- Implementing password strength meter

**Recommendation:**
```typescript
password: z.string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
```

---

### 10. Race Condition in User Settings Update

**Location:** `src/actions/user.ts:561-600`

**Description:** The `updateSettings` action accepts any `user_id` in the input and only checks after auth verification. Could allow race conditions.

```typescript
// Verify user can only update their own settings
if (userId !== input.user_id) { // Check done AFTER getting user input
  throw new ActionError({ code: 'FORBIDDEN', ... });
}
```

**Recommendation:** Don't accept `user_id` in input at all - use authenticated user's ID from context.

---

## Low Findings

### 11. No CSRF Protection for State-Changing Operations

**Description:** The application doesn't implement explicit CSRF tokens. However, since cookies are set with `sameSite: strict`, CSRF is partially mitigated.

**Recommendation:** Consider implementing double-submit cookie pattern for sensitive operations.

---

### 12. Missing Security Headers

**Description:** Application doesn't explicitly set all recommended security headers.

**Recommendation:** Add to all responses:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: (implement as needed)
```

---

### 13. File Upload - Magic Number Validation Missing

**Location:** `src/actions/user.ts` and `src/actions/trips.ts`

**Description:** File type validation only checks MIME type from client, which can be spoofed.

**Recommendation:** Validate file magic numbers server-side:
```typescript
async function validateImageMagicNumber(buffer: Buffer): boolean {
  const signatures = [
    [0xFF, 0xD8, 0xFF], // JPEG
    [0x89, 0x50, 0x4E, 0x47], // PNG
    [0x47, 0x49, 0x46, 0x38], // GIF
  ];
  // Check buffer against signatures
}
```

---

## Positive Security Observations

1. **Input Validation:** Comprehensive Zod schemas validate all inputs
2. **Error Handling:** Well-structured error classes with appropriate HTTP status codes
3. **Password Storage:** Using Supabase Auth (handled securely)
4. **SQL Injection:** Using parameterized queries via Supabase SDK
5. **Path Traversal:** Filenames properly sanitized in uploads
6. **File Size Limits:** Proper limits on uploaded files (5MB)
7. **Content-Type Validation:** Checking Content-Type headers
8. **Cookie Security:** `httpOnly: true` and `secure: true` for auth tokens (except session ID)

---

## Recommended Priority Fixes

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 | Fix IDOR in trips/owned.ts | Low |
| 2 | Implement proper JWT verification | Medium |
| 3 | Fix session ID httpOnly | Low |
| 4 | Add distributed rate limiting | Medium |
| 5 | Add authorization checks to member actions | Medium |

---

## Compliance Mapping

| OWASP Top 10 | Finding |
|--------------|---------|
| A01:2021 Broken Access Control | #1, #7 |
| A02:2021 Cryptographic Failures | #4, #5 |
| A03:2021 Injection | N/A (parameterized queries) |
| A04:2021 Insecure Design | #3 |
| A05:2021 Security Misconfiguration | #8, #12 |
| A06:2021 Vulnerable Components | N/A |
| A07:2021 Auth Failures | #2, #6, #9 |
| A08:2021 Software/Data Integrity Failures | N/A |
| A09:2021 Security Logging Failures | N/A |
| A10:2021 SSRF | N/A |

---

## Conclusion

The application demonstrates good security practices in many areas, particularly input validation and error handling. The critical and high findings should be addressed to improve the overall security posture, with particular attention to the IDOR vulnerability and JWT verification issues.
