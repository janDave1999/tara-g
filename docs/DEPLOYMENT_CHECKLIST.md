# Beta Release Deployment Checklist

> Last updated: February 2026

---

## 1. Infrastructure Requirements

### 1.1 Supabase Project

| Requirement | Status Needed |
|-------------|---------------|
| Supabase Project | ✅ Must exist |
| PostgreSQL Database | ✅ Must exist |
| PostGIS Extension | ✅ Must be enabled |
| Auth | ✅ Configured |
| R2 Bucket (or S3) | ✅ Configured for image storage |

### 1.2 Cloudflare

| Requirement | Status Needed |
|-------------|---------------|
| Cloudflare Account | ✅ Must exist |
| Workers & Pages | ✅ Must be enabled |
| R2 Bucket | ✅ Must be configured |
| KV Namespace | ✅ Must be configured |

### 1.3 External Services

| Service | Purpose | Status Needed |
|---------|---------|---------------|
| Mapbox | Maps & geocoding | ✅ API key required |
| MailerSend | Email notifications | Optional (MVP) |

---

## 2. Environment Variables

### 2.1 Required Variables

Create a `.env` file with the following:

```bash
# Supabase
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Mapbox
PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token

# R2 / S3
PUBLIC_R2_URL=https://your-bucket.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
PUBLIC_R2_BUCKET=your-bucket-name

# App
PUBLIC_SITE_URL=https://your-domain.com
```

### 2.2 Cloudflare Pages / Worker Secrets

```bash
# Set via wrangler or Cloudflare dashboard
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

---

## 3. Database Migrations

### 3.1 Required Migrations

Run all migrations in `database-migrations/` in order:

| # | Migration | Purpose |
|---|-----------|---------|
| 001 | Core schema | Users, trips, locations tables |
| 002 | Search functions | `search_trips_optimized` RPC |
| 004 | Itinerary tables | Stops, activities |
| 005 | Performance indexes | Indexes for queries |
| 006 | User social tables | Friends, blocks, notifications |
| 008 | Trip creation RPC | `create_trip_with_details` |
| 010 | Discover trips RPC | `get_discover_trips` |
| 011 | Trip listing RPCs | `get_user_owned_trips`, etc. |
| 017 | User trigger | Auto-populate `public.users` |
| 018 | Onboarding RPCs | Profile, interests, preferences |
| 025 | Login protection | Rate limiting |
| 026-035 | Trip enhancements | Various fixes |

### 3.2 Run Migrations

```bash
# Using Supabase CLI
supabase db push

# Or manually via SQL editor in Supabase dashboard
```

---

## 4. Pre-Deployment Testing

### 4.1 Functional Tests

| Test | Steps | Expected |
|------|-------|----------|
| Registration | Register new user → confirm email | User created, email sent |
| Onboarding | Complete 3-step wizard | Profile populated |
| Create Trip | 5-step wizard → publish | Trip visible in listing |
| Join Trip | Request → owner approves | Member added |
| Itinerary | Add stops, activities | Displayed correctly |
| Maps | Load map → search area | Trips shown on map |

### 4.2 Security Tests

| Test | Expected |
|------|----------|
| Unauthenticated access to protected routes | Redirect to signin |
| IDOR - view other user's private trip | 404 error |
| SQL injection attempts | Handled by parameterized queries |
| Rate limiting on login | Cooldown enforced |

---

## 5. Build & Deploy

### 5.1 Build

```bash
npm run build
```

### 5.2 Deploy to Staging

```bash
npm run deploy-staging
```

### 5.3 Deploy to Production

```bash
npm run deploy-production
```

---

## 6. Post-Deployment Verification

### 6.1 Health Checks

| Check | URL/Method |
|-------|------------|
| Homepage loads | `/` |
| Registration works | `/register` |
| Login works | `/signin` |
| Trip listing loads | `/trips` |
| Maps page loads | `/maps` |

### 6.2 Monitoring

- Check Cloudflare Workers logs for errors
- Monitor R2 bucket for uploaded images
- Verify KV cache is working

---

## 7. Known Gaps (Post-MVP)

| Feature | Priority | Notes |
|---------|----------|-------|
| Trip Delete | P2 | No delete action exists |
| Drag-drop Itinerary | P2 | Not in MVP spec |
| Date Filters (Maps) | P2 | UI exists, not wired |
| Social Login | P2 | Buttons exist, not configured |
| Friend System UI | P2 | Tables exist, no UI |
| Email Notifications | P2 | MVP uses in-app only |

---

## 8. Rollback Plan

If issues occur:

1. **Revert to previous deployment**
   ```bash
   # In Cloudflare dashboard
   # Go to Workers & Pages → your-worker → Deployments
   # Click "Roll back" on a previous deployment
   ```

2. **Database rollback**
   ```bash
   # Use Supabase dashboard
   # Go to SQL Editor → run previous migration version
   ```

---

## 9. Sign-Off Checklist

Before declaring beta launch ready:

- [ ] All MVP features tested and working
- [ ] No critical errors in production logs
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Build succeeds without errors
- [ ] Health checks pass
- [ ] Performance acceptable (< 3s load time)
