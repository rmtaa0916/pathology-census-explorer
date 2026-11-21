# Render PHP synthetic preview

This is a **public synthetic-data-only preview**, not an institutional production deployment. The Docker image runs PHP 8.3's built-in web server and serves `public/`. It does not load real spreadsheet credentials, patients, or restricted records.

## Configuration

- Runtime: Docker
- Repository: `https://github.com/rmtaa0916/pathology-census-explorer`
- Branch: `main`
- Dockerfile: `./Dockerfile`
- Region: Singapore
- Plan: Free (only when manually approved)
- Environment: `APP_MODE=demo` and `APP_WRITE_ENABLED=0`

The site will show sample records and mark A4 documents as **SAMPLE DATA ONLY**. Do not use this URL for real patient/census data or authorize institutional records on a publicly accessible development instance.

## Important cost warning

Render's **Free compute** has zero monthly compute price but not zero financial risk. Render documentation says outbound bandwidth beyond the workspace included quota can result in billing; build minutes also consume included usage. Review your Render usage and billing settings before provisioning. The free plan also spins down after idle and lacks persistent storage.

## Live mode

Do **not** change `APP_MODE` to `live` on a public demo. Real census data requires an organization-approved private hosting, authentication/security review, server-side Sheets service-account handling, logging/audit policy, and verified access roles. A public preview is for visual testing only.

A Render free web service should not be used for cron-monitor baseline state because its filesystem is ephemeral and there is no built-in persistent disk on the free tier.
