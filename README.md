# Pathology Census Explorer

A LCP-branded immunology census dashboard for the **Pathology and Laboratory Medicine Department, Lung Center of the Philippines**. Designed as a primary web interface for examining and editing the **connected Google Sheets working copy**, with period-specific reporting and protected batch editing.

## Application links

**[Open deployed Google Apps Script application](https://tinyurl.com/Pathology-Census-Explorer)**

This live link points to the Google Apps Script deployment, not the PHP code on this branch. GitHub is source-code hosting; PHP requires an independent PHP-capable HTTPS host.

## Supported features

| Workflow | PHP \`main\` | Apps Script \`apps-script\` |
|---|---|---|
| Institutional LCP letterhead and department header | Yes | Yes |
| Overview, reporting intervals and examination rankings | Yes | Yes |
| Edit existing examination inputs | Yes, when live editing enabled | Yes |
| **Stage several records and Save all once** | Yes — atomic Sheets batch request | Yes — guarded grouped writes |
| **A4 formal immunology census report** | Yes — \`report.php\` | Yes — in-app print preview |
| One reporting interval or **full December 2023 coverage** | Yes | Yes |
| Detailed category appendix | Optional | Optional |
| Browser Print / Save as PDF | Yes | Yes |
| Automatic source-schema email alerts | Not yet ported | Yes, after trigger installation |

See [Feature parity and implementation map](docs/FEATURE_PARITY.md) for concrete paths, data model and known limitations.

## A4 report generation

Open **Formal reports** in either dashboard. Select one interval (December 1–7, 8–14, 15–21, or 22–31) or **full coverage (December 1–31, 2023)**. Optionally include the grouped examination × patient-group × billing × priority appendix. Select **Generate A4 report**, review the draft, then use **Print / Save PDF**.

The report includes the LCP emblem and department header, reporting dates, generation timestamp, totals, patient-group/billing/priority breakdowns, examination table and **blank** prepared/reviewed sign-off lines. It is marked **for internal verification**, not institutional approval. Counts are examinations, not distinct patients; calculated amounts are not proof of collected revenue.

The PHP endpoint is authenticated and can also be reached as:

- \`/report.php?period=all\` — full coverage.
- \`/report.php?period=2\` — December 15–21.
- \`/report.php?period=2&detail=1\` — selected period with detailed appendix.

## Multi-record editing

In **Source records**, filter or search rows, edit the supported columns D–I, and **stage** changes. Review the pending changes and select **Save all**. The browser does not write each edit separately.

The PHP backend validates each proposed row, the old values, category combinations, duplicate identities and original formulas. It issues one atomic [Google Sheets spreadsheets.batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate) request for columns D–I, leaving reporting dates, amount formulas and source metadata untouched. A response can still be lost or another editor can change values between the preflight read and write; reconcile uncertain outcomes before resubmitting.

The Google Apps Script implementation applies a script lock and grouped range writes with best-effort rollback on failure.

## Data source and deployment

The PHP code is independent from the Apps Script deployment. It has two modes:

- **Local preview** (default \`APP_MODE=demo\`): generated sample records for development. These are not the connected worksheet's actual values, and A4 reports are marked **SAMPLE DATA ONLY**.
- **Connected working copy** (\`APP_MODE=live\`): reads the authorized Google Sheet on page load and reports current values. The working copy can be demonstrated without changing the application's data model. The original workbook is never accessed by this code.

**PHP 8.2+, HTTPS, sessions, OpenSSL, and a private Google service-account JSON are required for connected deployment.** Never commit credentials or institutional records.

Configure these server-side environment variables:

\`\`\`sh
APP_MODE=live
APP_ACCESS_USER=your-authorized-username
APP_ACCESS_PASSWORD_HASH='hash-from-php-password_hash'
GOOGLE_SPREADSHEET_ID='configured-working-copy-spreadsheet-id'
GOOGLE_SERVICE_ACCOUNT_FILE='/secure/path/outside/webroot/service-account.json'
APP_WRITE_ENABLED=0
\`\`\`

Start with \`APP_WRITE_ENABLED=0\` for read-only validation. Enable writes only after credential, permission, CSRF, and authorization checks have been verified. Set the web server document root to \`public/\`. Local sample preview:

\`\`\`sh
php -S 127.0.0.1:8000 -t public
\`\`\`

See [PHP and Google Cloud setup](docs/SETUP.md). The Google service-account credentials and PHP hosting are **not included** in this repository or automatically configured by the Google Apps Script connection.

## Project layout

\`\`\`text
public/index.php              PHP dashboard and staged-edit UI
public/report.php             Authenticated A4 report preview
public/api/update.php         Legacy single-count endpoint
public/api/batch-update.php   CSRF-protected multi-row save endpoint
src/CensusData.php            Source record and aggregate normalization
src/ReportBuilder.php         Period / full-coverage report computations
src/CensusBatchPlanner.php   Pure-PHP batch validation + Sheets updateCells requests
src/SheetsClient.php          Google Sheets API service-account client
src/bootstrap.php             Mode, dataset and authentication bootstrap
tests/                       Data, report, batch planner and browser script tests
docs/FEATURE_PARITY.md        PHP and Apps Script correspondence
\`\`\`

The \`apps-script\` branch contains \`Code.gs\`, \`SchemaMonitor.gs\`, \`Index.html\` and its own tests.

## Testing

\`\`\`sh
php -d zend.assertions=1 -d assert.exception=1 tests/CensusDataTest.php
php -d zend.assertions=1 -d assert.exception=1 tests/ReportBuilderTest.php
php -d zend.assertions=1 -d assert.exception=1 tests/CensusBatchPlannerTest.php
node tests/FrontendReportTest.cjs
\`\`\`

GitHub Actions runs these checks on \`main\`. The report layout was also exercised in headless Chromium and printed to A4 PDFs using a non-sensitive local fixture.

## Safety and scope

This is an editable pilot, not a patient-level laboratory system. Do not expose it publicly with real institutional data without organizational approval, per-user roles, audit logging and stronger authentication. The PHP version does **not yet** have the Apps Script source-monitor email triggers. Future months, additional tests or new columns require schema-aware changes and must be reviewed before use.
