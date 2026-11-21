# Pathology Census Explorer — Apps Script working copy

**Live app shortcut:** [Pathology Census Explorer](https://tinyurl.com/Pathology-Census-Explorer) (subject to existing Google access permissions).

The `apps-script` branch implements the Google Apps Script web application. The original PHP version remains on `main`.

## Single working dataset

The app has **one data model**, regardless of whether it is used for exploration, editing, reporting previews or demonstrations. The connected Google Sheets **copy** is the working dataset. There is no special demo mode, no separate demo dataset, and no requirement that copied rows be artificially labeled.

- Connected spreadsheet: `1JD4v8qENATuFeXRyBHzwfaIbJs7uw_W86wfQ-vQwdwE`
- Data tab (existing physical tab name): `DEMO - Weekly Census`
- Summary tab (existing physical tab name): `DEMO - Weekly Overview`
- Current layout: December 2023, 792 source records across four reporting intervals
- Rows and amounts are displayed as the values in the connected copy, not as a separately generated demonstration overlay
- The original source workbook is **not edited** by the application
- Column K is source metadata, remains read-only, and is **not** an authorization or eligibility gate

The word “DEMO” remains in the existing physical Google Sheet tab titles to avoid changing any linked formulas or references. The interface calls the dataset the **working copy**.

Data from a copy can be used to demonstrate the full functionality. If the copy ever contains real clinical or other confidential records, do not make the deployment public or share its link with unauthorized users; copying does not anonymize data.

## Capabilities

Seven interactive views: Overview, Reporting intervals, Examinations, Workload & income, Source records, Formal reports and Data quality. Views share source data and support filters, rankings, drill-down, editing, and refresh.

Only columns **D:I** can be edited from the application:

| Column | Field | Rule |
|---|---|---|
| A–C | Period / start and end dates | Read-only |
| D | Examination | Validated name |
| E | Patient group | Inpatient, Outpatient or Employee |
| F | Billing | CHA/PAY for patients; QFS for Employee |
| G | Priority | STAT/ROUTINE for patients; QFS for Employee |
| H | Test count | Whole number from 0 through 100,000 |
| I | Unit rate | Nonnegative, maximum 2 decimal places |
| J | Calculated amount | Read-only formula `=H(row)*I(row)` |
| K | Original source metadata/status | Preserved, read-only, no demo-only gating |

The backend pins the spreadsheet ID and exact named tabs, checks source row identity and previous values, verifies the existing formula, uses a script lock, and rejects duplicate category identities when category fields change.

Saving confirms the write before refreshing the dashboard. Uncertain responses are resolved by rereading Sheets before another edit. The UI supports unsaved-change warnings, single-record Undo with stale-value protection, and quality checks of formulas, categories, duplicate keys, amounts, numeric inputs, reporting ranges and totals.


## LCP branding and A4 formal reports

The application header uses a clean, isolated **Lung Center of the Philippines** institutional emblem, without a cropped portion of the document stationery. Formal reports instead reproduce the **complete LCP letterhead** used in recent institutional correspondence—including its institutional marks and footer art—and identify the **Pathology and Laboratory Medicine Department** and Immunology Census. Both images are bundled within `Index.html`; no external image requests are needed. The complete original-color letterhead is shown in the A4 report preview. For printing, the header and footer regions are placed in repeating A4 page-margin boxes with 47 mm reserved above the content and 46 mm below it (16 mm side margins), including on all appendix continuation pages. This keeps the letterhead artwork separate from the body while allowing page breaks and repeating table column headings. These margin-box images are print content rather than CSS background graphics, so they do not depend on the browser's background-graphics print option. The report uses self-contained image data; no public image server or third-party CDN is required.

Open **Formal reports** in the app, choose one reporting interval or **full December 1–31, 2023 coverage**, and optionally include the detailed examination × group × billing × priority appendix. Select **Generate A4 report**. The app rereads Google Sheets before building a report; no pending unsaved edits or outstanding source-structure alerts are permitted. An on-screen report preview opens in the same tab; choose **Print / Save PDF** to use the browser's actual A4 pagination. Browser print preview is authoritative for multi-page layout; the on-screen HTML report is a continuous scroll view.

The report includes the complete institutional letterhead, coverage, report date, totals and calculated amounts, reporting interval breakdown (full coverage only), patient-group/billing/priority summaries, examination-level totals, and an optional appendix. **Formal report pages follow the typography of recent LCP correspondence: Arial 10-point body text with approximately 105% line spacing; black text throughout, 10-point bold section headings and signer names, and a restrained 12-point bold report title.** The LCP letterhead retains all its original institutional colors, independently of the colorful application dashboard. Before generating a report, complete the **Prepared by** and second signatory fields with each person's **full name, position and date**. The second label can be **Noted by**, **Reviewed by**, or **Approved by**. All six fields are required; the report generator will not print blank text placeholders. The printed output shows names, positions and dates below an unsigned signature line. The entries stay in the current browser session and are not written to Google Sheets. The report remains designated for verification, not as a signed/approved hospital report. Counts are examinations, not unique patients; amounts are not necessarily collected income.

**PHP parity:** The \`main\` branch implements the same reporting model using native \`src/ReportBuilder.php\` and authenticated \`public/report.php\`, so PHP collaborators can maintain the feature without rewriting the Apps Script implementation.

## Multi-edit Save all

Use **Source records → Edit → Stage for Save all** on as many existing records as required, up to 100. Changes remain local in the browser until **Save all**, with a review screen and unsaved markers. A batch generates one Apps Script server call, validates all changed rows and formulas first, and groups adjacent writes to reduce spreadsheet operations. A full data refresh runs once after saving.

The Apps Script API is \`updateRecordsBatch({changes:[...]})\` in \`Code.gs\`. Conflicts reject the batch before writing. Google Sheets is not a transactional database across separate \`setValues\` calls; if a write fails, rollback is best effort and an uncertain result requires reconciliation. Do not retry blindly.

**PHP parity:** \`main\` includes \`public/api/batch-update.php\`, \`src/CensusBatchPlanner.php\` and \`src/SheetsClient.php\` for the corresponding staged editing workflow. PHP sends one atomic Google Sheets \`spreadsheets.batchUpdate\` request after its preflight validation.

## Primary editing interface and source-change alerts

The **dashboard is the primary interface** for modifying supported census values. Google Sheets remains the backing database, not the normal data-entry screen. The current editor supports **existing row inputs D:I**. It does not yet add new examination rows, periods, columns, or formulas.

To protect users from unexpected spreadsheet revisions, the new `SchemaMonitor.gs` watches for tab, column, row, reporting-date and formula changes. The **Data quality** screen shows source compatibility and a **Check source** action. Unreviewed changes pause edits rather than risking a write to the wrong column.

To activate automatic email notifications, **copy `SchemaMonitor.gs` into the existing Apps Script project, update the OAuth manifest, then manually run `installSourceMonitor` once (if not already installed) and approve the permissions**. This creates a spreadsheet change trigger plus an hourly backup scan. Ordinary count/rate changes do not send schema-alert emails; structural changes do. It does not automatically rewrite application code.

See [Source monitor setup and change-handling guide](docs/SOURCE_MONITOR.md) for details, including how to approve a revised schema after code updates.

## Deployment

1. Open the existing Pathology Census Explorer Apps Script project as its authorized owner.
2. Paste the current `Code.gs`, `Index.html`, and `SchemaMonitor.gs` from this branch. Update `appsscript.json` to include trigger-management and email permissions.
3. Save. To preserve the existing public-facing alias, choose **Deploy → Manage deployments → Edit → New version → Deploy**. Do not create a new deployment unless you want a new `/exec` URL.
4. Keep **Execute as: Me** and **Who has access: Only myself** during this pilot. The server additionally verifies the active user's email.
5. If the source monitor is not already installed, run `installSourceMonitor` once and approve trigger/email permissions. Existing installed triggers do not need to be re-created.
6. Verify a staged multi-record save and undo/reconciliation using non-sensitive rows, then generate both selected-period and full-coverage A4 reports.

GitHub commits do **not** automatically update the live Apps Script deployment. The existing TinyURL forwards to the current `/exec` URL; updating that deployment keeps the alias.

## Tests

```sh
node tests/backend.test.cjs
node tests/frontend.test.cjs
node tests/schema-monitor.test.cjs
```

GitHub Actions runs these checks for changes to `apps-script`. Local browser tests exercise the asynchronous workflow with mocked `google.script.run`; they are not a substitute for verifying the published Google-hosted version.

## Boundaries

The existing December 2023 layout is intentionally fixed to 792 rows; adding months/rows requires a schema update. The app is not yet equipped with institutional approval, multi-user roles, immutable edit history or medical data governance controls. The working copy should not be treated as the official census solely because its values can be displayed or edited.
