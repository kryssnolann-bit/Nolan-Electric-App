# Nolan Electric App V4

This is the first live-backend V4 build. It uses the Nolan Electric Supabase project and the database schema built in Stage 4.

## Setup
1. Open `config.js`.
2. Replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with the project's **publishable/anon key**.
3. Do NOT use a service-role or secret key in the browser.
4. Serve the folder from a web server (not `file://`). For example, VS Code Live Server, Netlify, Vercel, Cloudflare Pages, or another static host.
5. Create employee accounts in Supabase Auth. Their Auth user UUID must match a row in `public.profiles`.
6. Set each profile's role to `admin`, `manager`, `crew_lead`, or `employee`.

## Current live features
- Supabase authentication
- Admin/field role-aware navigation
- Live customer list
- Live job list
- Create customers
- Create jobs
- Job detail
- Live job tasks and task completion
- Field notes
- Material requests
- Live database reads/writes
- Mobile-first field UI

## Next V4 build targets
- Supabase Storage photo upload
- Camera capture from field devices
- Employee management screen
- Crew assignment screen
- Estimate builder
- Change-order approval workflow
- Invoice/payment screens
- Profitability dashboard
- Realtime activity updates
- PWA install/offline support
