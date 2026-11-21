# Pathology Census Explorer — Google Apps Script edition

This folder contains the **Apps Script web app** on the `apps-script` branch. The PHP edition remains intact on `main`.

The existing responsive dashboard is preserved in `Index.html`. Its five views, charts, search, examination drill-down, and reporting periods are implemented with the same HTML/CSS/JavaScript. `Code.gs` provides server-side `SpreadsheetApp` reads and protected write operations through `google.script.run`.

**Data isolation:** Only the separate synthetic-only Google Sheet `1JD4v8qENATuFeXRyBHzwfaIbJs7uw_W86wfQ-vQwdwE` and the `DEMO - Weekly Census` tab are used. The backend rejects unexpected tabs, non-synthetic rows, mismatched row identity, invalid counts and stale edits. Never swap in the original pathology census without an institutional security review.

## Deploy to Apps Script

1. Sign in as `rmtaa0916@gmail.com` and open [Google Apps Script](https://script.google.com/home/projects). Create a new standalone project, or use the official `clasp` CLI to push this directory.
2. Include `Code.gs`, `Index.html`, and `appsscript.json`. In the Apps Script editor, enable **Show appsscript.json manifest file in editor** under Project settings if necessary.
3. Select **Deploy → New deployment → Web app**. Set **Execute as: Me**, **Who has access: Only myself**. Do not use public or anonymous access. Approve the Google Sheets and identity permissions.
4. Visit the generated `/exec` URL while signed in. The owner must have access to the separate demo Sheet. The current baseline is **1,340 simulated tests** across 792 records.
5. Open **Source records** from the sidebar or **Edit data** in the header. Filter by reporting interval, patient group or test; select **Edit** for any row (including zero-count rows).
6. Edit the examination name, patient group, billing, priority, test count, or illustrative unit rate. **Save changes** updates only columns **D:I** in the synthetic Sheet. Column **J** retains its `=H×I` formula; overview metrics and charts are refreshed automatically.
7. The same editor is accessible from an examination's detail drawer, scoped to the selected reporting interval. Test one change, verify formula recalculation in Google Sheets, and restore the original values.
8. **Redeploy:** After updating the Apps Script editor with the latest `Code.gs` and `Index.html`, choose **Deploy → Manage deployments → Edit → Version: New version → Deploy**. Updating GitHub alone does not change the live `/exec` URL; publishing a new version of the existing deployment keeps the current URL and TinyURL alias.

### Security and deployment caveats

- The Apps Script service runs under the Google account used for deployment; no service-account JSON or PHP hosting is needed.
- **Owner-only** access is mandatory for this pilot. Server functions compare the active user email to `rmtaa0916@gmail.com` and fail closed if that email is unavailable.
- This project is synthetic-only, not appropriate for clinical production without institutional authorization, per-user roles, logging, privacy and cybersecurity review.
- HTML Service uses a sandboxed iframe; verify UI on the actual Apps Script deployment even though local previews passed.
- A GitHub branch does not automatically publish an Apps Script web app. After changes are pushed, update the Apps Script project/deployment.
- Never commit keys, private data, or the original clinical workbook.

To run local backend tests: `node tests/backend.test.cjs` (requires Node.js; Apps Script APIs are mocked).

## Source editing policy

| Field | Source column | Editable? |
|---|---|---|
| Reporting interval and start/end dates | A–C | No — fixed source schedule |
| Examination | D | Yes — validated name; no formulas |
| Patient group | E | Yes — Inpatient/Outpatient/Employee |
| Billing | F | Yes — CHA/PAY for patient rows, QFS for Employee |
| Priority | G | Yes — STAT/ROUTINE for patient rows, QFS for Employee |
| Test count | H | Yes — whole number, 0–100,000 |
| Illustrative unit rate | I | Yes — 0–1,000,000, maximum 2 decimals |
| Formula-based amount | J | No — recalculates as count × rate |
| Synthetic safety marker | K | No — immutable |

The server rechecks the previous values under a script lock before writing, rejects duplicate category identities within an interval, and checks the amount formula remains intact. All 792 source rows remain accessible even when their count is zero. A separate **Source records** table offers filtered, paginated editing. All dashboard KPIs and summary tables remain derived outputs, not separately editable fields.
