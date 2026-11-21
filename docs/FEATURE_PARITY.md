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
| Optional appendix | By examination × patient group × billing × priority | Same |
| PDF output | Browser Print → Save as PDF | Browser Print → Save as PDF |
| Source-change monitoring | Not yet ported as a PHP cron/email subsystem | \`apps-script/SchemaMonitor.gs\` (change trigger + hourly scan) |
| Local preview fixture | \`CensusData::mockRows()\` when \`APP_MODE\` is not \`live\` | Test fixture is in Node test suite; app itself reads the connected copy |

## Report data contract

Both report generators use **record-level source data**, not month-wide aggregates. Each source record has:

\`sheetRow\`, \`period\`, \`test\`, \`patientGroup\`, \`billing\`, \`priority\`, \`count\`, \`rate\`, and \`amount\`.

A reporting-period selection filters by one of \`Dec 1–7\`, \`Dec 8–14\`, \`Dec 15–21\`, \`Dec 22–31\`. Full coverage includes all four.

Report sections: LCP institutional header, reporting dates and generation timestamp, executive totals, interval comparison (full only), patient-group, billing, priority, examination totals, review/signature lines (unfilled), and optional category-detail appendix.

The report contains aggregated examination counts and amounts only. It does **not** include patient identifiers. It is marked for verification, not falsely signed or represented as an approved institutional document. Amounts are count × rate, not confirmed cash revenue.

PHP summary model: \`ReportBuilder::build($data, $periodId, $appendix)\`.
JavaScript summary model: \`reportAggregate(RECORDS, reportPeriod)\`.

There are four period selectors, indexed \`0\`–\`3\`; \`all\` means December 1–31. The reporting periods are fixed to the present December 2023 schema. Future months require a schema-aware enhancement.

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
