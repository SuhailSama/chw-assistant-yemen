# مساعد العاملين الصحيين — Community Health Worker Assistant

An Arabic-language clinical decision support tool for community health workers in Yemen. Provides AI-assisted diagnosis guidance and treatment recommendations for common conditions, with offline capability via a Progressive Web App.

## Features

- AI-assisted differential diagnosis (Google Gemini, called through a server-side proxy)
- Arabic-language interface designed for CHW workflows
- Offline-capable PWA: records are saved on the phone first and synced when a connection returns
- Role-based access: CHW, Supervisor, and Admin
- Admin panel for user management (create, assign roles, enable/disable)
- Supervisor dashboard for oversight
- Runs entirely on free tiers with no payment method on file

## Architecture

```
Browser (React PWA, hosted on GitHub Pages)
    │
    ▼
Supabase project (free plan, eu-central-1)
    ├── Auth            username + password, role stored in the JWT (app_metadata)
    ├── Postgres        visits + referrals, protected by row-level security
    └── Edge Functions
         ├── diagnose     → Google Gemini API (key stays server-side)
         └── admin-users  → create users, change roles, enable/disable
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, Tailwind CSS 4 |
| Hosting | GitHub Pages |
| Auth + Database | Supabase Auth, Postgres with row-level security |
| AI | Google Gemini Flash-Lite (via Supabase Edge Function) |
| CI/CD | GitHub Actions |
| Security | DOMPurify (XSS), row-level security, server-side role checks |

## Project Structure

```
chw-assistant-yemen/
├── app/                    # React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── AdminPanel.jsx  # User management UI
│   │   ├── SupervisorView.jsx
│   │   ├── auth/           # Supabase client, login, session
│   │   ├── hooks/          # Local-first record sync, offline queue
│   │   └── data/           # Conditions and medicines reference data
│   ├── .env.example
│   └── vite.config.js
├── supabase/
│   ├── migrations/         # Schema + row-level security policies
│   └── functions/          # diagnose, admin-users
└── .github/workflows/
    ├── deploy.yml          # Build and publish to GitHub Pages
    └── keepalive.yml       # Stops the free Supabase project from pausing
```

## Local Development

**Prerequisites:** Node.js 20+

```bash
cd app
npm install
cp .env.example .env   # fill in the two values below
npm run dev
```

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (public, safe in the browser) |

## Deployment

Pushing to `main` builds the app and publishes it to GitHub Pages. See
[`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) for the one-time setup.

Backend changes are applied to Supabase separately:

```bash
supabase db push                       # apply supabase/migrations
supabase functions deploy diagnose --no-verify-jwt
supabase functions deploy admin-users --no-verify-jwt
```

Both functions authenticate the caller themselves, so platform JWT verification is off.

## Edge Function Secrets

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key. Required for diagnosis. |
| `GEMINI_MODEL` | Optional. Defaults to `gemini-3.5-flash-lite`. |

## Free-Tier Limits to Know

- **Supabase** pauses a free project after 7 days without activity and keeps no backups. `keepalive.yml` handles the first; export data regularly for the second.
- **Gemini free tier** is rate-limited per day, and Google may use free-tier prompts to improve its products. The app never sends the patient's name to the AI.
