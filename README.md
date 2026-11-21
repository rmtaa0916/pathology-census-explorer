# Pathology Census Explorer — PHP and Google Sheets (demo-only pilot)

A **PHP 8.2+** version of the responsive Pathology Census Explorer. It keeps the original interface's HTML/CSS/JS structure. The public repository package **contains no source laboratory census data, no credentials, and no copied source workbook**.

## Google Apps Script application link

**[Open Pathology Census Explorer](https://tinyurl.com/Pathology-Census-Explorer)**

Short URL for the Google Apps Script deployment using the connected working-copy spreadsheet. Access is controlled by the Google Apps Script deployment settings. The PHP implementation documented below is separate from this web app.

## Status

- Visual parity of original HTML vs PHP-rendered HTML: **10/10 pixel-identical screenshots** (five views × desktop/mobile) using an identical local fixture. This establishes *rendering parity*, not live integration.
- The included demo build renders **entirely synthetic** numbers using `CensusData::mockRows()`.
- Google Sheets client and a controlled demo count update endpoint are **implemented but not authenticated, hosted or tested against Google API**. They become operational only when the owner's Google Cloud service account and PHP hosting are configured.
- The available connected GitHub tools cannot create a new repository. The source repository is managed separately from the PHP deployment.

## System requirements

- PHP 8.2+ with `openssl` enabled, HTTPS (mandatory for live use), sessions enabled, network access to `oauth2.googleapis.com` and `sheets.googleapis.com`.
- A PHP-capable host with document root set to the **`public/`** folder (not the repository root).
- A Google Cloud project with the Google Sheets API enabled, and a service account with a credential JSON file stored outside the public folder.
- Share the specific Google Sheet with the **service account email**, with `Viewer` for a read-only pilot or `Editor` only when write access is deliberately enabled. Grant **no folder-wide access**.
- An account password hash configured as an environment variable. Basic authentication is suitable for a restricted technical pilot; replace with institutional SSO, per-user authorization, audit logging and approved hosting before handling production laboratory records.

**GitHub is source-code hosting only. GitHub Pages cannot execute PHP.** Deploy separately to a PHP-compatible HTTPS host. Do **not** publish the original imported December 2023 workbook, the CSV containing real counts, or any Google credential JSON in a public repository.

## Quick local demo

```sh
php -S 127.0.0.1:8000 -t public
# Browse http://127.0.0.1:8000/index.php
```

No credentials are required for default `APP_MODE=demo`. The app displays synthetic values in each of the four December reporting intervals. Source totals will **not** match the separately generated Google Sheet demo until live mode is enabled, because the local mock data is generated independently.

## Enable authenticated Google Sheets reads

Set the following **server-side environment variables**, not JavaScript variables:

```sh
APP_MODE=live
APP_ACCESS_USER=your-authorized-user
APP_ACCESS_PASSWORD_HASH='hash-generated-with-php-password_hash'
GOOGLE_SPREADSHEET_ID='the-private-spreadsheet-id'
GOOGLE_SERVICE_ACCOUNT_FILE='/path/outside/webroot/service-account.json'
APP_WRITE_ENABLED=0
```

Generate the password hash locally:

```sh
php -r 'echo password_hash("YOUR-STRONG-PASSWORD", PASSWORD_DEFAULT), PHP_EOL;'
```

The PHP server retrieves the `DEMO - Weekly Census!A4:K900` range on **every dashboard refresh** and generates current aggregates. Only that demo tab is accessible through the shipped data adapter. It deliberately cannot fetch the original census tabs. The browser never sees the service-account credentials or Google access tokens. The browser renders the returned aggregate dataset but **does receive demo-level values**; do not treat it as an authorization boundary for specific demo cells.

## Optional two-way demo editing

Once the server has been tested with read-only access, grant `Editor` only on the intended spreadsheet and set `APP_WRITE_ENABLED=1` on the secured PHP server. On the **Examinations** view, open an examination, choose a December interval, then select **Edit selected interval** in the drawer. Editing writes exactly one `Test count` cell in column H, rows 5–900, in `DEMO - Weekly Census` and reloads the dashboard. The update endpoint performs:

- Server-side authentication and CSRF validation.
- Strict row and non-negative-integer validation.
- Expected period, examination and previous-count checks to reduce stale-write risk.
- Verification that the row carries `SYNTHETIC / DEMO` status.
- No writes to real laboratory census tabs.

If formulas in the demo sheet reference the changed count, they recalculate in Google Sheets and will appear in the refreshed dashboard.

**Caution:** Column J in `DEMO - Weekly Census` contains `=H*I` formulas; editing H in Google Sheets recalculates J. Never overwrite column J from the PHP app.

## File layout

```text
public/index.php        PHP-rendered responsive Explorer
public/api/update.php   Protected synthetic count update endpoint
src/bootstrap.php       Mode selection and Basic-auth gate
src/SheetsClient.php    Service-account OAuth + Google Sheets REST client
src/CensusData.php      Validated normalization / aggregation + local mock
.env.example            Configuration names only; no credentials
.gitignore              Blocks .env, credential JSON and private data
```

## Deployment checklist

1. Use the GitHub repository `rmtaa0916/pathology-census-explorer`. If it is public, change its visibility to **Private** before storing any non-demo information.
2. Deploy from that repository to a PHP 8.2+ HTTPS host. Set document root to `public/`. Do **not** use GitHub Pages for PHP execution.
3. Enable Sheets API in Google Cloud, create a service account, store its credential JSON outside webroot, and share only the specific demo Sheet with the service-account identity.
4. Configure server environment and authenticate before `APP_MODE=live` is enabled.
5. Test read-only dashboard refresh after changing `DEMO - Weekly Census`, then deliberately enable write access if needed.
6. Before production deployment, obtain organizational authorization and implement SSO, per-user audit logging, explicit edit roles and a non-demo data-quality review.

This package is a starting point for deployment, **not** evidence that a GitHub site or a live Google Sheets API connection already exists.

## Repository and Cloud setup

See [`docs/SETUP.md`](docs/SETUP.md) for the private repository, Google Cloud service-account, separated synthetic Sheet and secure PHP-hosting steps. The required Google Cloud credentials cannot be transferred from the ChatGPT Google Drive connection.
