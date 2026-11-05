# Nolan Electric Job Command Center — V108.9 Polish & Access Hardening

Built from the supplied V108.7 50% Deposit Workflow package. This is a frontend replacement package plus production Supabase security updates already deployed separately.

## Frontend changes
- Inactive, missing, or unsupported-role profiles are signed out locally and shown an access-denied message.
- Profile active status is rechecked at startup, on auth changes, on data reload, and when the app regains focus.
- Field/admin role gating now requires an active profile.
- Deposit invoice payment terms and memo now use the estimate's actual configured deposit percentage instead of hardcoding 50%.
- Updated boot diagnostics and version markers to V108.9.

## Supabase changes already deployed
- `employee-admin` Edge Function now has platform JWT verification enabled (v9).
- `claim-push` now rejects inactive profiles (v6).
- `send-push` now rejects inactive senders and has platform JWT verification enabled (v10).
- Admin-only RLS policies for employee labor rates, closeouts, and time entries are restricted to the `authenticated` role.
- `current_user_role()` can no longer be executed by anonymous users; authenticated execution remains for RLS checks.
- Unused `is_job_member()` and legacy `claim_push_subscription()` RPC execution has been revoked.

## Deploy to GitHub
Replace these files in the same app folder:
- `index.html`
- `app-v1089.js`
- `styles-v1088.css`

Keep your existing `config.js`, `manifest.webmanifest`, service worker (`sw-v86.js`), icons, and other existing assets. Do not overwrite or publish `config.js`.

## Verification performed
- `node --check app-v1089.js` passed.
- Static assertions confirmed the inactive-account gate and configured deposit percentage are present.
- Supabase policy and function grants were queried after deployment and matched the intended restrictions.
- Edge Function versions and `verify_jwt` settings were re-read after deployment.

## Remaining owner-side security settings
- Enable leaked-password protection in Supabase Auth settings (the current project advisor reports it disabled).
- Review whether the `job-photos` bucket should remain public. It currently allows public URL access to stored photos; making it private requires a coordinated signed-URL and policy change.
- Run end-to-end tests on a real phone for sign-in, employee view, time clock, photo upload, estimate approval, deposit invoice, payment recording, and closeout. This package has not been browser-tested against a live device.


Invoice workflow update: final contract invoices now show itemized original estimate and approved change orders, calculate prior job payments as credits, and show the remaining balance. The final invoice amount defaults to the full current contract rather than subtracting prior billed amounts a second time.
