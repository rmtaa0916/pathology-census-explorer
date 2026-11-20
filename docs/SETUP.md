# Pathology Census Explorer — GitHub & Google Sheets connection setup

## Safety and current status

- This application is **not published** or hosted until a GitHub repository and PHP web host are configured.
- The live Google Sheets API is **not connected** until a Google Cloud project, service account and server-side private credentials are configured.
- This demo should connect only to the **separate synthetic-only Google Sheet**, never to the original immunology census workbook.
- Do not upload Google service-account JSON keys, `.env`, original pathology files, clinical records or screenshots containing personal details to GitHub.

## GitHub repository: one owner action

1. Log into GitHub and visit https://github.com/new
2. Confirm repository visibility. Use **Private** for any non-demo development.
3. Keep the new repository empty (without generated README or `.gitignore`) to simplify the initial upload.
4. The connected GitHub integration can then create files and commits. GitHub Pages **cannot run PHP**. This repository stores code, not the running web application.

## Google Cloud: required owner actions

The existing Google Drive / Docs connector in ChatGPT cannot mint or export credentials to a different application. A live PHP application requires its **own** Google Cloud service account. A one-click Google account consent URL cannot be generated until the application identity exists, and the current PHP build uses server-to-server service account credentials, rather than a per-user OAuth consent flow.

1. Sign in to https://console.cloud.google.com/ and create or select a Google Cloud project.
2. Enable **Google Sheets API**: https://console.cloud.google.com/apis/library/sheets.googleapis.com .
3. Create a **service account** under **IAM & Admin > Service Accounts**: https://console.cloud.google.com/iam-admin/serviceaccounts .
4. Open the new service account, copy its email address (e.g., `example@project.iam.gserviceaccount.com`).
5. Open the *separate synthetic-only demo spreadsheet* (provided in the conversation) and share it directly with that email as **Viewer** for initial tests. Do **not** share the original pathology workbook.
6. If the deployment host has no workload identity integration, create a **JSON key** for the service account, following Google's guidance, and install it **only on the private PHP server, outside the web root**. Do not upload it to GitHub, Gmail, ChatGPT, or public paste services. Prefer keyless authentication where supported by the host; adapting the PHP client is required for keyless operation.
7. On the PHP host, configure `APP_MODE=live`, `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_FILE`, `APP_ACCESS_USER`, and `APP_ACCESS_PASSWORD_HASH` as server environment settings. Keep `APP_WRITE_ENABLED=0` at first.
8. Deploy to a **PHP 8.2+ HTTPS host** with its document root set to `public/` and verify that `APP_MODE=live` shows the saved synthetic totals.
9. For **demo editing only**, change the service account's share role to **Editor**, set `APP_WRITE_ENABLED=1` on the host, and test one count change. The API is still scoped by the Google identity to its *whole* demo spreadsheet; the PHP application's edit code limits updates to count cells.

## What refresh does

In live mode, every page refresh causes PHP to read `DEMO - Weekly Census!A4:K900` via Google Sheets API and reaggregate examination totals. Edits made in Google Sheets appear after refreshing the PHP website. Browser filtering occurs immediately on the data already loaded. Google Sheets edits in the PHP dashboard require Editor access and explicitly enabling the write endpoint.

## Operations

- Keep the original pathology workbook private and unchanged; review data completeness before connecting actual reports.
- Do not use the Basic Auth pilot as a hospital production authentication/authorization system. Institutional SSO, approved hosting, audit logs and an organization data-handling review are needed before real clinical data is connected.
- Recheck visuals in your actual PHP hosting environment even though local PHP and static HTML renders matched at 390px and 1366px.

Official references:
- https://developers.google.com/workspace/guides/create-credentials
- https://developers.google.com/workspace/guides/enable-apis
- https://docs.cloud.google.com/iam/docs/service-accounts-create
