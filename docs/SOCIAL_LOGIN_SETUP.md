# Social Login Setup Guide - Google & Facebook OAuth

## Overview

Your code is ready! You just need to configure OAuth providers in:
1. **Supabase Dashboard** (enable providers)
2. **Google Cloud Console** (get credentials)
3. **Facebook Developer Portal** (get credentials)

---

## Step 1: Configure Supabase Dashboard

### 1.1 Add Redirect URLs

Go to: **Authentication → URL Configuration**

Add these **Redirect URLs**:
```
https://your-project.supabase.co/auth/v1/callback
http://localhost:3001/api/auth/callback
https://your-production-domain.com/api/auth/callback
```

### 1.2 Set Site URL

**Authentication → General Settings → Site URL**:
```
http://localhost:3001  (for development)
https://your-production-domain.com  (for production)
```

### 1.3 Enable Providers

**Authentication → Providers → Google**: Toggle **Enable**
**Authentication → Providers → Facebook**: Toggle **Enable**

---

## Step 2: Google OAuth Setup

### 2.1 Create Google Project
1. Go to: https://console.cloud.google.com/
2. Create new project → Name it "Tara G"
3. Go to **APIs & Services → OAuth consent screen**
4. Select **External** → Fill in:
   - App name: "Tara G"
   - User support email: your email
   - Developer contact: your email

### 2.2 Configure Scopes
Add these scopes:
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`
- `openid`

### 2.3 Create Credentials
1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Add **Authorized redirect URIs**:
```
https://your-project.supabase.co/auth/v1/callback
```
(Replace `your-project` with your actual Supabase project ID)

4. Copy your:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxx`

### 2.4 Add to Supabase
1. Go to **Authentication → Providers → Google**
2. Paste:
   - **Client ID**: (from Google)
   - **Client Secret**: (from Google)
3. **Save**

---

## Step 3: Facebook OAuth Setup

### 3.1 Create Facebook App
1. Go to: https://developers.facebook.com/
2. My Apps → Create App → "Tara G"
3. App Type: **Consumer**

### 3.2 Configure OAuth
1. Go to **Settings → Basic** → Add Platform → **Website**
2. Add your site URL
3. Go to **Facebook Login → Settings**
4. Add **Valid OAuth Redirect URIs**:
```
https://your-project.supabase.co/auth/v1/callback
```
5. Save Changes

### 3.3 Get Credentials
1. Go to **Settings → Basic**
2. Copy:
   - **App ID**: `xxxxxxxxxxxxxxx`
   - **App Secret**: `xxxxxxxxxxxxxxx`

### 3.4 Add to Supabase
1. Go to **Authentication → Providers → Facebook**
2. Paste:
   - **App ID**: (from Facebook)
   - **App Secret**: (from Facebook)
3. **Save**

---

## Step 4: Environment Variables (Optional)

If you want to use env vars instead of Supabase Dashboard:

### astro.config.mjs
```javascript
env: {
  schema: {
    GOOGLE_CLIENT_ID: envField.string({ context: "server", access: "public" }),
    GOOGLE_CLIENT_SECRET: envField.string({ context: "server", access: "secret" }),
    FACEBOOK_CLIENT_ID: envField.string({ context: "server", access: "public" }),
    FACEBOOK_CLIENT_SECRET: envField.string({ context: "server", access: "secret" }),
  },
}
```

### Supabase Dashboard
In each provider settings, use:
```
Client ID: env(GOOGLE_CLIENT_ID)
Client Secret: env(GOOGLE_CLIENT_SECRET)
```

---

## URLs to Whitelist

### Development (Local)
- `http://localhost:3001/api/auth/callback`

### Cloudflare Preview/Deploy
- `https://your-project.pages.dev/api/auth/callback`

### Production
- `https://your-domain.com/api/auth/callback`

---

## Testing Checklist

| Test | URL |
|------|-----|
| ✅ Google Login (Dev) | Sign in with Google on localhost |
| ✅ Google Login (Prod) | Sign in with Google on production |
| ✅ Facebook Login (Dev) | Sign in with Facebook on localhost |
| ✅ Facebook Login (Prod) | Sign in with Facebook on production |
| ✅ New User | OAuth creates user in auth.users |
| ✅ Returning User | OAuth logs in existing user |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Redirect URL mismatch" | Add exact URL to provider's authorized redirect URIs |
| "Access blocked" | Complete OAuth consent screen verification |
| "User already exists" | User signed up with email, now trying OAuth - handle in code |
| Redirects to wrong URL | Check Site URL in Supabase Dashboard |
