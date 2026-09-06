# Nolan Electric V4 — Phone Setup

The Supabase URL and publishable key are already installed in `config.js`.

## On Android

1. Download `Nolan_Electric_App_V4_READY.zip`.
2. Extract it with your phone's Files app.
3. The app must be served by a web host; opening `index.html` directly with `file://` can prevent browser modules/auth behavior from working correctly.
4. Put the extracted folder on a static host such as Netlify, Vercel, Cloudflare Pages, or GitHub Pages.
5. Open the hosted URL on your phone.
6. Add it to your home screen from Chrome.

## Supabase accounts

Create the employee login accounts in Supabase Authentication. Then create a matching row in `public.profiles` using the same Auth user UUID.

Roles:
- admin
- manager
- crew_lead
- employee

Do not put a Supabase secret/service-role key in the app.

## Important

The included key is the publishable browser key, not a secret key. Supabase documents that publishable keys are intended for browser/mobile apps; RLS and authenticated user policies provide the data protection.
