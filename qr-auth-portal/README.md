# QR Logger — Google verified-sign-in prototype

## Simplified owner deployment (single-file bundle)

If the Apps Script editor is easier than a command-line deployment, use
[DeploymentBundle/Code.gs](DeploymentBundle/Code.gs) and
[DeploymentBundle/appsscript.json](DeploymentBundle/appsscript.json).
These are copies of the two backend source files combined into one \`Code.gs\`;
**do not install the combined file together with \`QrCore.gs\` and \`AuthEndpoint.gs\`**,
or you will introduce duplicate declarations. The combined bundle was prepared
for the pilot in November 2026. The owner still must configure four Script
properties and approve the Google authorization once.

- Create a **new standalone Apps Script project** under the owner's account; never
  overwrite the existing working QR Logger deployment.
- Replace the new project's default \`Code.gs\` with the bundled \`Code.gs\`.
  Configure the bundled \`appsscript.json\` under Project Settings.
- Enter Script properties listed in step C below.
- Deploy the web app with **Execute as: Me** and **Who has access: Anyone**,
  then paste its new \`/exec\` URL into the public \`qr-auth-portal/config.js\`.
- **Do not enable Google Cloud Billing**, purchase anything, store client secrets
  in the frontend, or enter real laboratory activity until live verification passes.


**Status: experimental source code, NOT deployed or validated on an actual Android scanner. Use fictional inventory records only.** The existing \`feature/qr-logger-pilot\` app and its deployment have **not** been changed.

The goal is to remove the per-user **"QR (Unverified)" Apps Script Google Sheets authorization screen**: users authenticate through **Sign in with Google** for basic identity only, while the owner-authorized Apps Script backend writes to a separate test workbook. **No request to access the staff member's Google Sheets or Gmail** is made by the frontend. Identity must be confirmed by Google's server, not by an email entered into the form.

## Architecture

\`\`\`text
QR scan → GitHub Pages portal (?ref=TEST-CRP)
       → Google Identity Services (ID token + nonce)
       → hidden HTTPS POST form → standalone Apps Script web app (execute as owner)
       → Google's tokeninfo checks signature + app audience + issuer + expiration + email_verified + nonce
       → STAFF_ACCESS allowlist by verified Google email
       → QrCore.gs transaction ledger in private test Google Sheet
       → Apps Script HTMLService response → window.top.postMessage to exact portal origin
       → portal displays accepted result, balance, or error
\`\`\`

A normal browser \`fetch()\` to Apps Script can fail due to CORS and redirect handling. This prototype deliberately uses a form POST plus a sandboxed response frame, verified reply IDs, and an exact \`postMessage\` target origin. **Test this transport on real devices before making it operational.** The app does not support offline mode.

The signed ID token is handled only in browser memory; each server call revalidates it. The backend does not trust client-provided email or staff name. The data functions end in underscore and are not remotely callable through \`google.script.run\`.

## Configuration needed before testing

### A. Google Cloud Console: create an OAuth client

1. Visit [Google Cloud Console — Credentials](https://console.cloud.google.com/apis/credentials) using an administrator-controlled Cloud project. Do not reuse confidential projects without approval.
2. Set up **Google Auth Platform → Branding / Audience** (External test audience for the two Gmail test accounts). Add \`rmtaa0916@gmail.com\` and \`rmtaa0917@gmail.com\` as testing users if required by the Google Cloud console. Request only the **OpenID Connect / basic profile + email** information; no Sheets or Drive scopes for front-end sign-in.
3. Create **OAuth client ID → Web application** and add the authorized **JavaScript origin** for your site. Example for GitHub Pages: \`https://rmtaa0916.github.io\`. The repository path belongs to the page URL, not the authorized origin.
4. Record the public **Client ID** ending in \`.apps.googleusercontent.com\`. Do **not** commit an OAuth client secret, access token, service account key, or private key.

### B. Host the static portal over HTTPS

- Example using GitHub Pages: repository **Settings → Pages → Deploy from a branch**. Choose \`feature/qr-verified-signin\` and \`/(root)\`. Pages had not been enabled in this repository when this prototype was created.
- Expected path **after Pages is enabled and published**:
  \`https://rmtaa0916.github.io/pathology-census-explorer/qr-auth-portal/\`
- You can instead host \`index.html\`, \`config.js\`, and \`qrcode.min.js\` together on another verified HTTPS domain. Adjust the origin and app URL in the next step.

### C. Create a second, standalone Apps Script project (do not overwrite your existing QR Logger)

1. In [Google Apps Script](https://script.google.com/home), create a separate project named **LCP QR Verified Sign-In Prototype**.
2. Copy in the complete contents of \`AppsScript/QrCore.gs\` and \`AppsScript/AuthEndpoint.gs\`. Use \`AppsScript/appsscript.json\` for the manifest.
3. Add these **Script properties** (Project settings) to the new project:

   | Key | Value |
   | --- | --- |
   | \`QR_WORKBOOK_ID\` | \`1v9KhrkTYZ_H8vvIHqlPYhaGCyXD_Ofw7aTqGm01QwmY\` |
   | \`QR_GOOGLE_CLIENT_ID\` | The Google OAuth client ID created in A |
   | \`QR_PORTAL_ORIGIN\` | \`https://rmtaa0916.github.io\` (or the real HTTPS portal origin) |
   | \`QR_PORTAL_URL\` | Full portal URL, ending in \`/qr-auth-portal/\` (or equivalent) |

4. **Deploy → New deployment → Web app**. Set **Execute as: Me** (the owner's Google account) and **Who has access: Anyone** (including anonymous visitors). This is required because Apps Script itself must never ask each visitor to authorize its Sheets scopes. It does **not** grant application access: each POST is rejected unless it has a valid Google-signed ID token for the configured client, matching nonce, and an active \`STAFF_ACCESS\` entry. If your organization blocks public web-app endpoints, do not bypass the organization policy; use organization-approved hosting.
5. Authorize Sheets access as the owner when deploying the backend. Do not grant anonymous or public access to the workbook.

### D. Connect the static website to the backend

Edit the public \`config.js\` values:

\`\`\`js
window.QR_PORTAL_CONFIG = Object.freeze({
  clientId: "YOUR_WEB_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  endpoint: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
});
\`\`\`

Neither value is a secret. Leave all secrets and any future backend keys **outside GitHub**. GitHub commits don't automatically update a live Apps Script project.

### E. Test safely on your phone

1. Open the published static portal via HTTPS.
2. Sign in with the authorized \`rmtaa0917@gmail.com\` Google account. It should show the Google account selector/button rather than the Apps Script's Sheets permission screen.
3. Confirm that the portal header shows \`rmtaa0917@gmail.com\`.
4. Open **A4 reference sheet**, display it on a second device, then use the swipe-down phone QR Scanner. Scan CRP. The QR should return to the **GitHub Pages portal** with \`?ref=TEST-CRP\`, not \`script.google.com\`.
5. Confirm quantity 1, then verify that a new row appears in \`TRANSACTIONS\` in the **separate pilot workbook**. Repeat the same test intentionally and confirm the second event receives a new transaction ID. Simulate a retry and verify no double count.
6. Test a non-allowlisted Google account and verify that **access is denied**. Test a missing/expired token and ensure the backend returns no data.

## Security boundaries and open items

- **Proof of concept only.** Google's \`tokeninfo\` endpoint is recommended by Google for troubleshooting/development, not high-volume production validation. Before storing real operational data, migrate to a supported server-side ID-token verifier (e.g., Google's auth library with cached signature keys), add monitoring and rate limits, audit staff access by stable Google \`sub\`, and test token renewal.
- The use of \`HtmlService.XFrameOptionsMode.ALLOWALL\` is confined to a response relay that targets the exact configured HTTPS origin; the main server page exposes no data. The cross-origin transport requires a **real Android browser test**.
- Existing sample reagent kits and stock balances are fictional and require proper reconciliation before any official activity logging.
- The original QR Logger deployment **remains the fallback**. This development branch does not modify it, revoke previously granted staff access or alter the Pathology Census Explorer.
- The GitHub repository is public. No credentials, patient data, staff records beyond the established synthetic pilot, or personal health information should be committed.
- A visually clean Google Sign-In dialog is **not guaranteed** until the Google Cloud OAuth consent configuration and a real browser sign-in have been tested. The main value of this design is avoiding the script's per-user Sheets OAuth scope prompt.

## Tests

Run from repository root:

\`\`\`bash
node qr-auth-portal/tests/auth.test.cjs
\`\`\`

GitHub Actions checks syntax, server-side ID token claim validation, allowlist denial, separate repeated usage events, request replay and stock balance. They **mock Google tokeninfo and Google Sheets** and cannot prove live cross-origin POST behavior or Google's actual consent experience.
