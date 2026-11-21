# Render deployment: public synthetic preview only

The PHP app can run on a Render **Free** Web Service using the repository's `Dockerfile`. It needs no database or other paid service for a read-only **synthetic-data preview**.

**Security:** This deployment must use `APP_MODE=demo` and `APP_WRITE_ENABLED=0`. Do not provide a service-account key, spreadsheet ID or clinical data. The resulting onrender.com URL is publicly accessible.

## Deployment settings

- Workspace: select only the Render workspace the account owner confirms.
- Repository: `rmtaa0916/pathology-census-explorer` (Render must have permission to clone it).
- Branch: `main`.
- Runtime: `Docker`.
- Dockerfile: `./Dockerfile`.
- Service plan: **Free** only; do not upgrade or provision a database, disk or cron service.
- Suggested region: Singapore.
- Environment: `APP_MODE=demo`, `APP_WRITE_ENABLED=0`.
- Service health endpoint: `/health.php`, expected HTTP 204.

The image uses Apache and PHP 8.3, listens on Render's provided `PORT` and serves only the `public/` directory. The Docker build copies only `src/` and `public/`, not the repository's untrusted files or private credentials.

## Verify after deployment

Open the Render URL and verify the dashboard explicitly identifies itself as **synthetic demonstration data**. Open **Formal reports**, enter test signatory data and generate the A4 census with the detailed appendix. The document must display the same original-color LCP letterhead on every page, black Arial text, and **SAMPLE DATA ONLY**.

The on-screen preview, browser print dialog, and PDF output must be checked separately. The GitHub Actions workflow validates code; it does not guarantee a browser's print layout.

## Costs and limitations

Render's Free web services can spin down after 15 minutes of inactivity and use an ephemeral filesystem. Source-monitor scheduling is **not** supported by this read-only demo; no cron job will be provisioned.

**Do not assume the whole workspace cannot incur charges.** Render's documentation says accounts with an attached payment method can incur bandwidth and build-pipeline overage charges after included amounts are exhausted. Before service creation, review the workspace's Billing page and configure any appropriate spend limits. Without a payment method, Render generally suspends services/builds on usage exhaustion rather than billing. Neither the connector nor this repository independently certifies a zero-billing-risk account.

Do not move the public demo to `APP_MODE=live` without institutional security review, suitable authentication, private credentials handling, and an approved hosting plan. The Render app does not deploy or update the Google Apps Script web app.
