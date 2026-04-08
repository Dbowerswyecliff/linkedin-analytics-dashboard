# Demo Deployment Guide

This document describes how to deploy the public website demo safely, isolated from all production resources.

## Branch

All demo code lives on `demo/public-website`. Never merge production secrets or backend config into this branch.

## Required Environment Variables

Set these in your hosting provider's environment settings:

| Variable | Value | Purpose |
|---|---|---|
| `VITE_DEMO_MODE` | `true` | Enables demo mode: lead gate, mock data, no live APIs |
| `VITE_SUPABASE_URL` | `https://<demo-project>.supabase.co` | Demo-only Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `<demo-anon-key>` | Demo-only Supabase anon key (insert-only) |

## Variables That MUST Be Absent

Do not set any of the following in the demo deployment. If any are set, the app could attempt to reach production services:

- `VITE_LINKEDIN_CLIENT_ID`
- `VITE_LINKEDIN_AUTH_FUNCTION_URL`
- `VITE_LINKEDIN_SYNC_URL`
- `VITE_MONDAY_CLIENT_ID`
- `VITE_MONDAY_AUTH_FUNCTION_URL`
- `VITE_TEST_USERNAME`
- `VITE_TEST_PASSWORD`

## Supabase Setup

1. Create a separate Supabase project for demo leads (do not use any production project).
2. Create the `demo_leads` table:

```sql
create table demo_leads (
  id bigint generated always as identity primary key,
  first_name text not null,
  last_name text not null,
  company text not null,
  email text not null,
  source text not null default 'website_demo',
  created_at timestamptz not null default now()
);

-- Insert-only RLS: visitors can only create rows, never read/update/delete
alter table demo_leads enable row level security;

create policy "Allow anonymous inserts"
  on demo_leads
  for insert
  to anon
  with check (true);

-- No SELECT, UPDATE, or DELETE policies = visitors cannot read leads
```

3. Copy the project URL and anon key into your demo deployment env vars.

## Build & Deploy

```bash
# From the demo/public-website branch
npm ci
npm run build
# Deploy the dist/ folder to your static host (Vercel, Netlify, S3+CloudFront, etc.)
```

## How Demo Mode Works

1. Visitor arrives at the site and sees the lead gate form.
2. They fill in first name, last name, company, and email.
3. The form POSTs to the Supabase REST API (insert-only) to log the lead.
4. A `sessionStorage` flag grants access for the current browser tab.
5. The dashboard loads with mock data only — no backend calls are made.
6. The Admin page, OAuth flows, sync triggers, and Monday integration are not rendered.
7. A "DEMO" badge appears in the nav bar.

## Safety Verification Checklist

After deploying, verify each of these:

- [ ] Opening the demo URL shows the lead gate form (not the Monday login page).
- [ ] After submitting the form, the dashboard shows mock employee data and charts.
- [ ] The nav bar shows "Dashboard" only — no "Admin" link.
- [ ] Opening browser DevTools > Network tab shows no requests to AWS Lambda, LinkedIn, or Monday APIs.
- [ ] The only external requests are to Supabase (lead insert) and static assets.
- [ ] Navigating to `/admin` redirects to `/` (dashboard).
- [ ] Navigating to `/login` redirects to `/` (dashboard).
- [ ] The Supabase `demo_leads` table receives new rows when visitors submit the form.
- [ ] The Supabase table is not readable via the anon key (test with a GET request to the REST API).
- [ ] The built JS bundle does not contain any production Lambda URLs or OAuth client secrets.
