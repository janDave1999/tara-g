# Security Requirements

**Project:** Travel Trip Application (Walang Magawa)  
**Version:** 1.0  
**Date:** February 21, 2026

---

## Overview

This document captures security requirements derived from the security audit findings. Each requirement includes traceability to threats, acceptance criteria, and test specifications.

---

## Authentication

### SR-AUTH-001: Implement Proper JWT Token Verification

**Description:** All JWT tokens must be cryptographically verified using Supabase's built-in token verification instead of manual decoding without signature validation.

**Type:** Functional  
**Domain:** Authentication  
**Priority:** CRITICAL  
**Rationale:** Prevents attackers from crafting malicious tokens to impersonate users.

**Threat References:** Finding #2 (JWT Token Not Verified)

**Status:** ✅ IMPLEMENTED

**Implementation:**
- Updated `src/middleware/auth.ts` to use `supabase.auth.getUser()` for cryptographic verification
- Added proper error logging for security monitoring
- Maintains session refresh capability for expired tokens

**Acceptance Criteria:**
- [x] All JWT tokens are verified using `supabase.auth.getUser()` before use
- [x] Invalid/expired tokens are rejected with 401 response
- [x] Token verification failures are logged for security monitoring

**Test Cases:**
- [x] Valid JWT token is accepted and user context is set
- [x] Tampered JWT token is rejected with 401 Unauthorized
- [x] Expired JWT token triggers refresh or rejection
- [x] Invalid/malformed JWT token is rejected

---

### SR-AUTH-002: Secure Session Cookie Configuration

**Description:** All session cookies must include HttpOnly flag to prevent XSS token theft.

**Type:** Constraint  
**Domain:** Authentication  
**Priority:** HIGH  
**Rationale:** Prevents JavaScript access to session tokens, mitigating XSS attacks.

**Threat References:** Finding #5 (Session ID Cookie Missing HttpOnly)

**Acceptance Criteria:**
- [ ] `sb-session-id` cookie includes `httpOnly: true`
- [ ] All auth cookies include `secure: true` in production
- [ ] All auth cookies include `sameSite: 'strict'`

**Test Cases:**
- Test: Session cookie cannot be accessed via document.cookie
- Test: XSS payload cannot steal session cookie value

---

### SR-AUTH-003: Reduce Session Token Lifetime

**Description:** Access token lifetime should be reduced from 7 days to maximum 4 hours for enhanced security.

**Type:** Non-functional  
**Domain:** Authentication  
**Priority:** HIGH  
**Rationale:** Limits exposure window if tokens are compromised.

**Threat References:** Finding #4 (Session Token Lifetime Too Long)

**Status:** ✅ IMPLEMENTED

**Implementation:**
- Updated `src/pages/api/auth/signin.ts` to use 4-hour access token
- Updated `src/pages/api/auth/callback.ts` to use 4-hour access token
- Updated `src/middleware/auth.ts` to use 4-hour access token on refresh

**Acceptance Criteria:**
- [x] Access token maxAge is 4 hours (14400 seconds) or less
- [x] Refresh tokens maintain user session beyond access token expiry
- [x] Token refresh mechanism works correctly

**Test Cases:**
- [x] Access token expires after configured lifetime
- [x] User session persists via refresh token after access token expiry

---

## Authorization

### SR-AUTHZ-001: IDOR Protection for User-Specific Trip Operations

**Description:** Private user-specific trip operations (e.g., managing trips, viewing private trip data) must verify ownership. Public trip discovery is an intentional feature and does not require ownership verification.

**Type:** Functional  
**Domain:** Authorization  
**Priority:** HIGH  
**Rationale:** Prevents unauthorized access to private user data while preserving public trip discovery as a core community feature.

**Threat References:** Finding #1 (IDOR in Trips API)

**Exemption:** This requirement does NOT apply to:
- Public trip listings and discovery pages
- Trip detail pages visible to potential joiners
- Trip search/browse functionality

These are intentional business requirements for the community platform.

**Acceptance Criteria:**
- [ ] Private endpoints (e.g., trip management) verify authenticated user owns the resource
- [ ] Public endpoints return only trips where `is_public: true`
- [ ] Unauthorized requests to private endpoints return 403 Forbidden
- [ ] Clear distinction between public trip data and private user data

**Test Cases:**
- Test: User can access their own private trips
- Test: Public trips are visible to unauthenticated users
- Test: Public trips are visible to authenticated non-members
- Test: User cannot access another user's private trip management data (returns 403)
- Test: Request without authentication on private endpoint is rejected

---

### SR-AUTHZ-002: Trip Member Action Authorization

**Description:** Users must have appropriate permissions (owner/admin) to approve join requests, reject requests, or remove members.

**Type:** Functional  
**Domain:** Authorization  
**Priority:** HIGH  
**Rationale:** Prevents regular members from performing administrative actions on trips.

**Threat References:** Finding #7 (Missing Authorization in Trip Member Actions)

**Acceptance Criteria:**
- [ ] approveJoinRequest verifies user is owner or admin
- [ ] rejectJoinRequest verifies user is owner or admin
- [ ] removeTripMember verifies user is owner or admin
- [ ] Unauthorized attempts return 403 Forbidden

**Test Cases:**
- Test: Trip owner can approve join request
- Test: Trip admin can approve join request
- Test: Regular member cannot approve join request (403)
- Test: Non-member cannot remove members (403)

---

### SR-AUTHZ-003: Eliminate User ID from Input

**Description:** Actions should not accept user_id as input. Use authenticated user's ID from context instead.

**Type:** Functional  
**Domain:** Authorization  
**Priority:** MEDIUM  
**Rationale:** Prevents race conditions and ensures users can only modify their own data.

**Threat References:** Finding #10 (Race Condition in User Settings)

**Acceptance Criteria:**
- [ ] updateSettings action uses user_id from auth context, not input
- [ ] No user_id field accepted in user-related action inputs
- [ ] Authorization check uses context user_id

**Test Cases:**
- Test: User can update their own settings
- Test: Manipulating user_id in request payload has no effect

---

## Data Protection

### SR-DATA-001: File Upload Magic Number Validation

**Description:** File uploads must validate magic numbers server-side to prevent MIME type spoofing attacks.

**Type:** Functional  
**Domain:** Data Protection  
**Priority:** MEDIUM  
**Rationale:** Client-provided MIME types can be spoofed; server-side validation ensures only allowed file types are processed.

**Threat References:** Finding #13 (File Upload Magic Number Validation)

**Acceptance Criteria:**
- [ ] Uploaded images are validated by magic number
- [ ] Only JPEG, PNG, GIF, WebP formats are accepted
- [ ] Invalid file types are rejected with appropriate error

**Test Cases:**
- Test: Legitimate JPEG image is accepted
- Test: File with spoofed MIME but invalid magic number is rejected
- Test: Executable files are rejected even with image extension

---

## Network Security

### SR-NET-001: Trusted IP Source for Rate Limiting

**Description:** Rate limiting must use only trusted IP sources to prevent spoofing.

**Type:** Functional  
**Domain:** Network Security  
**Priority:** HIGH  
**Rationale:** Prevents attackers from bypassing rate limits by spoofing X-Forwarded-For headers.

**Threat References:** Finding #6 (IP Spoofing via X-Forwarded-For)

**Acceptance Criteria:**
- [ ] Rate limiting uses `CF-Connecting-IP` header
- [ ] X-Forwarded-For is not used as primary IP source
- [ ] Cloudflare-provided IP is validated

**Test Cases:**
- Test: Requests are rate limited correctly using Cloudflare IP
- Test: Spoofed X-Forwarded-For header does not bypass rate limit

---

### SR-NET-002: Distributed Rate Limiting

**Description:** Rate limiting must work across all Cloudflare Worker instances.

**Type:** Non-functional  
**Domain:** Network Security  
**Priority:** CRITICAL  
**Rationale:** In-memory rate limiting can be bypassed by distributing requests across workers.

**Threat References:** Finding #3 (In-Memory Rate Limiting)

**Status:** ✅ IMPLEMENTED

**Implementation:**
- Updated `src/lib/rateLimit.ts` to use Cloudflare KV for distributed storage
- Added fallback to in-memory if KV unavailable
- Added `setRateLimitKV()` function to initialize KV from middleware
- Updated `src/middleware/auth.ts` to initialize KV store
- Updated all rate-limited API routes to use async/await
- Also fixes SR-NET-001 (IP Spoofing) by using only `CF-Connecting-IP`

**Acceptance Criteria:**
- [x] Rate limiting uses distributed store (Cloudflare KV)
- [x] Rate limit is enforced consistently across all workers
- [x] Configuration uses existing KV namespace (USER_CACHE)
- [x] Uses CF-Connecting-IP only (fixes IP spoofing issue)

**Test Cases:**
- [x] Distributed requests from same IP are rate limited
- [x] Rate limit persists across different worker instances

---

## Input Validation

### SR-INPUT-001: Enhanced Password Strength Requirements

**Description:** Password validation must enforce stronger requirements including special characters and minimum length of 12 characters.

**Type:** Constraint  
**Domain:** Input Validation  
**Priority:** MEDIUM  
**Rationale:** Weak passwords are susceptible to brute force and dictionary attacks.

**Threat References:** Finding #9 (Insufficient Password Strength)

**Acceptance Criteria:**
- [ ] Minimum 12 characters
- [ ] At least one uppercase letter
- [ ] At least one lowercase letter
- [ ] At least one number
- [ ] At least one special character

**Test Cases:**
- Test: Password with all requirements is accepted
- Test: Password missing special character is rejected
- Test: Password with 11 characters is rejected

---

## Error Handling

### SR-ERROR-001: Secure Error Message Handling

**Description:** Production environments must not expose sensitive error details to users.

**Type:** Functional  
**Domain:** Error Handling  
**Priority:** MEDIUM  
**Rationale:** Error messages revealing implementation details can aid attackers.

**Threat References:** Finding #8 (Development Error Messages)

**Acceptance Criteria:**
- [ ] Production uses `import.meta.env.PROD` for environment check
- [ ] Generic error messages shown to users
- [ ] Detailed errors logged server-side only
- [ ] Stack traces never exposed

**Test Cases:**
- Test: Production shows generic error message
- Test: Development shows detailed error information

---

## Security Headers

### SR-HEAD-001: Implement Security Headers

**Description:** Application must include recommended security headers in all responses.

**Type:** Constraint  
**Domain:** Security Configuration  
**Priority:** LOW  
**Rationale:** Security headers provide additional protection against common web vulnerabilities.

**Threat References:** Finding #12 (Missing Security Headers)

**Acceptance Criteria:**
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Referrer-Policy: strict-origin-when-cross-origin
- [ ] Content-Security-Policy implemented

**Test Cases:**
- Test: Response includes X-Content-Type-Options header
- Test: Response includes X-Frame-Options header
- Test: CSP header is present and configured

---

## Compliance Mapping

| Requirement | OWASP Top 10 2021 | NIST CSF | ISO 27001 | Priority |
|-------------|-------------------|----------|-----------|----------|
| SR-AUTH-001 | A01: Broken Access Control | PR.AC-1 | A.9.4.1 | HIGH (with exemption) |
| SR-AUTH-002 | A01: Broken Access Control | PR.AC-1 | A.9.4.1 | HIGH |
| SR-DATA-001 | A01: Broken Access Control | PR.DS-1 | A.10.1.2 | MEDIUM |
| SR-NET-002 | A04: Insecure Design | PR.PT-3 | A.12.3.1 | CRITICAL |
| SR-INPUT-001 | A07: Auth Failures | PR.AC-1 | A.9.4.3 | MEDIUM |

---

## Threat-to-Requirement Traceability Matrix

| Threat ID | Threat Description | Requirements |
|-----------|-------------------|--------------|
| T-001 | Unauthorized access to private/user-specific trip operations | SR-AUTHZ-001 |
| T-002 | JWT tokens not cryptographically verified | SR-AUTH-001 |
| T-003 | Rate limiting bypassed via distributed requests | SR-NET-002 |
| T-004 | Long session token exposure window | SR-AUTH-003 |
| T-005 | XSS theft of session cookie | SR-AUTH-002 |
| T-006 | IP spoofing bypasses rate limiting | SR-NET-001 |
| T-007 | Unauthorized member actions | SR-AUTHZ-002 |
| T-008 | Error messages expose sensitive info | SR-ERROR-001 |
| T-009 | Weak password policy | SR-INPUT-001 |
| T-010 | Race condition in user settings | SR-AUTHZ-003 |
| T-011 | MIME type spoofing in uploads | SR-DATA-001 |

---

## Priority Implementation Plan

### Phase 1: Critical (Week 1)
1. ✅ SR-AUTH-001: Implement proper JWT verification (COMPLETED)
2. ✅ SR-NET-002: Implement distributed rate limiting (COMPLETED)

### Phase 2: High (Week 2)
1. ⚠️ SR-AUTH-002: Fix session cookie HttpOnly (already implemented)
2. ✅ SR-AUTH-003: Reduce token lifetime (COMPLETED)
3. ✅ SR-NET-001: Fix IP source for rate limiting (included in SR-NET-002 - COMPLETED)
4. SR-AUTHZ-001: Implement ownership verification for private endpoints (with public exemption)

### Phase 3: Medium (Week 3-4)
7. SR-AUTHZ-002: Add member action authorization
8. SR-INPUT-001: Enhance password requirements
9. SR-AUTHZ-003: Remove user_id from input

### Phase 4: Low (Month 2)
10. SR-DATA-001: Add magic number validation
11. SR-ERROR-001: Fix error message handling
12. SR-HEAD-001: Implement security headers

---

## Definition of Done

All requirements must meet:
- [ ] Implementation complete
- [ ] Unit tests passing
- [ ] Security tests passing
- [ ] Code review approved
- [ ] Documentation updated
