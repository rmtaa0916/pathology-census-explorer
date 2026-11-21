# Pathology Census Explorer — cross-language feature map

The project has **two implementations** of the same census editing/reporting experience.

| Feature | PHP \`main\` branch | Google Apps Script \`apps-script\` branch |
|---|---|---|
| LCP/Pathology and Laboratory Medicine header | \`public/index.php\`, \`public/report.php\` | \`apps-script/Index.html\` |
| Overview, reporting intervals, examination tables | \`public/index.php\` + \`src/CensusData.php\` | \`apps-script/Index.html\` + \`apps-script/Code.gs\` |
| Existing source record edits | PHP Source records view | Apps Script Source records view |
| Multi-record staged edits and Save all | \`public/index.php\` + \`public/api/batch-update.php\` + \`src/CensusBatchPlanner.php\` + \`src/SheetsClient.php\` | \`apps-script/Index.html\` + \`apps-script/Code.gs:updateRecordsBatch\` |
| **A4 formal reports** | \`public/report.php\` (server-side printable HTML) + \`src/ReportBuilder.php\` | \`apps-script/Index.html:reportAggregate/reportDocument/generateA4Report\` |
| Report coverage | Four Dec 2023 intervals + full Dec 1–31 | Same |
| Optional appendix | Yes, A4 repeat pages | Same |
| Required name, position and date for both signers | Yes, entered before report creation | Same |
| Calculated amounts in census | Optional, off by default | Same |
| Institutional letterhead | Original full-color artwork every page | Same |
| PDF output | Browser Print → Save as PDF | Browser Print → Save as PDF |
| Source-change monitoring | Not yet ported as a PHP cron/email subsystem | \`apps-script/SchemaMonitor.gs\` (change trigger + hourly scan) |
| Local preview fixture | \`CensusData::mockRows()\` when \`APP_MODE\` is not \`live\` | Test fixture is in Node test suite; app itself reads the connected copy |

## Report parity and data contract

Both implementations produce the **Immunology Laboratory Census** using record-level source data, not month-wide estimates. Each source record contains `sheetRow`, `period`, `test`, `patientGroup`, `billing`, `priority`, `count`, `rate`, and `amount`. The fixed source schema has four December 2023 reporting periods. The report totals are derived by test, patient group, billing, priority, and period; each table includes a total row.

The current PHP and Apps Script report experiences share:

- **Original-color LCP letterhead** repeated at the top and bottom of every printed A4 page, including appendix pages; both embed the same institutional logo/letterhead data from Apps Script.
- **Arial 10 pt black report typography**, compact statistical tables, **47 mm top / 46 mm bottom / 16 mm side margins**.
- **Required full name, position and date for two signatories**; selectable second role (**Noted by**, **Reviewed by**, **Approved by**). Dates print without a “Date:” prefix and without instructional placeholders. Signatures follow the appendix if it is selected.
- **DOH-informed laboratory census structure** rather than a dashboard summary: reporting period, preparation date, examination totals, classifications and detailed examination counts. No “For internal verification” banners, spreadsheet-implementation labels, or numbered signatory chapter appear in the formal report.
- Optional category-detail appendix and separately optional **calculated amounts (off by default)**; amounts are count × rate, not confirmed collections.
- A4 page-by-page screen preview and printable, flowing HTML with repeat-margin letterhead graphics. On PHP, the signatory entry form POSTs to the authenticated `public/report.php` rather than embedding names into URLs.

The PHP data model is `ReportBuilder::build($data, $periodId, $appendix)`; Apps Script uses `reportAggregate(RECORDS, reportPeriod)`. Both calculate full-period and individual-interval totals. In PHP demo mode, **SAMPLE DATA ONLY** remains on printouts because simulated values must not be passed off as institutional data.

## Known implementation differences

- PHP uses independent HTTPS hosting, Basic authentication with protected server-side credentials, and an atomic Google Sheets batch update. Apps Script uses Google identity checks and Apps Script services.
- PHP does **not** yet implement the Apps Script **hourly/on-change schema monitoring and email alerts**. It performs local data-consistency checks and enforces row, category and formula protections at batch-save time. These are not equivalent to the Apps Script monitor.
- PHP uses a separate authenticated `report.php` route, while Apps Script opens its report within the current app. Neither project is automatically deployed by changes to the other.

## Multi-edit workflow

1. Open **Source records**, search or filter, and edit existing rows.
2. Stage up to **100** changed records without contacting Sheets for each form.
3. Review pending edits, then **Save all**.
4. Server verifies row numbers, period, previous values, allowed fields, valid category combinations, duplicate category identities, and unchanged amount formulas.
5. A single server request sends the changes. Source amount formulas in column J and metadata in K are not edited.
6. Reload/refresh to reconcile saved values. If the response is uncertain, avoid blindly submitting the same batch again.

Apps Script uses a script lock and groups adjacent source writes into fewer range operations. Its rollback on write failure is **best effort**, because multiple Sheet writes are not a database transaction.

PHP sends one **atomic** Google Sheets \`spreadsheets.batchUpdate\` operation of \`updateCells\` requests for D:I after validating current values. The read-to-write window remains optimistic; concurrent external edits between preflight read and atomic write can still race. Google describes the batch operation's atomic guarantees in its [API reference](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate).

## PHP hosting and security

- \`APP_MODE=live\` loads the configured working-copy spreadsheet. The default local preview uses generated sample records; those are **not** the connected Sheet's values.
- \`APP_ACCESS_USER\`, \`APP_ACCESS_PASSWORD_HASH\`, \`GOOGLE_SPREADSHEET_ID\`, \`GOOGLE_SERVICE_ACCOUNT_FILE\` must be configured server-side.
- \`APP_WRITE_ENABLED=1\` is required for edits. Public routes authenticate users and JSON writes require a session CSRF token.
- \`public/report.php\` calls \`appAuthenticate()\` and rejects unknown periods. Never host this with anonymous access to real institutional records.
- The browser never receives service-account credentials. Avoid storing private keys, actual patient records or spreadsheets in the Git repository.
- PHP hosting is **independent** from the Apps Script deployment at [Pathology Census Explorer](https://tinyurl.com/Pathology-Census-Explorer). Changes pushed to GitHub don't publish either runtime automatically.

## Smoke tests

PHP branch:

\`\`\`bash
php -d zend.assertions=1 -d assert.exception=1 tests/CensusDataTest.php
php -d zend.assertions=1 -d assert.exception=1 tests/ReportBuilderTest.php
php -d zend.assertions=1 -d assert.exception=1 tests/CensusBatchPlannerTest.php
node tests/FrontendReportTest.cjs
\`\`\`

Apps Script branch:

\`\`\`bash
node apps-script/tests/backend.test.cjs
node apps-script/tests/frontend.test.cjs
node apps-script/tests/schema-monitor.test.cjs
\`\`\`

GitHub Actions runs these suites. Browser print/PDF was also exercised in an isolated Chromium session for both implementations, using non-sensitive fixtures; validate hosted Google authentication and report output again after deploying.
