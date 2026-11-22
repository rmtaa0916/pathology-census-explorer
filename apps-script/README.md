# Pathology Census Explorer — Apps Script working copy

**Existing app shortcut:** [Pathology Census Explorer](https://tinyurl.com/Pathology-Census-Explorer). The shortcut will allow anonymous viewing/editing only after the owner publishes a new version with public access enabled.

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

**Public-edit demo warning:** All visitors, even without Google sign-in, can view these rows and edit existing supported census values when the deployed app is public. The Google Sheet itself does not need anonymous sharing because the app runs under the deploying owner's credentials. This is appropriate **only** for confirmed non-sensitive synthetic records. If the copy ever contains real clinical or other confidential records, revert the deployment to owner-only access immediately; copying a spreadsheet does not anonymize its contents.

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

The backend pins the spreadsheet ID and exact named tabs, checks source row identity and previous values, verifies the existing formula, uses a script lock, and rejects duplicate category identities when category fields change. **These are data-integrity checks, not user-login restrictions.**

Saving confirms the write before refreshing the dashboard. Uncertain responses are resolved by rereading Sheets before another edit. The UI supports unsaved-change warnings, single-record Undo with stale-value protection, and quality checks of formulas, categories, duplicate keys, amounts, numeric inputs, reporting ranges and totals.


## LCP branding and A4 formal reports

The application header uses a clean, isolated **Lung Center of the Philippines** institutional emblem, without a cropped portion of the document stationery. Formal reports instead reproduce the **complete LCP letterhead** used in recent institutional correspondence—including its institutional marks and footer art—and identify the **Pathology and Laboratory Medicine Department** and Immunology Census. Both images are bundled within `Index.html`; no external image requests are needed. The complete original-color letterhead is shown in the A4 report preview. For printing, the header and footer regions are placed in repeating A4 page-margin boxes with 47 mm reserved above the content and 46 mm below it (16 mm side margins), including on all appendix continuation pages. This keeps the letterhead artwork separate from the body while allowing page breaks and repeating table column headings. These margin-box images are print content rather than CSS background graphics, so they do not depend on the browser's background-graphics print option. The report uses self-contained image data; no public image server or third-party CDN is required.

Open **Formal reports**, select December 1–31, 2023 or an individual reporting interval, and enter both signatories' full names, positions and dates. Optional controls are **Include full category-detail appendix** and **Include calculated amounts based on listed rates**. Financial figures are excluded by default so the regular census is focused on numbers of examinations; selecting the financial option adds labeled calculated-amount columns and a concise basis note. Reports are generated only after rereading the connected Sheets data and reconciling outstanding source changes.

The printed report follows a tabular laboratory census rather than an executive dashboard: **Immunology Laboratory Census**, reporting period, date prepared, summary of examination counts, period totals (full-coverage reports), patient group, billing classification, priority, and examination-by-test counts. Every classification table includes a total row. The optional appendix contains examination × patient group × billing × priority rows. **Prepared by** and the configurable second signer (**Noted by**, **Reviewed by**, **Approved by**) appear at the end without a separate numbered heading or prefatory disclaimer. Each block has a signature line, printed name, position and the date without a 'Date:' label. Report copy omits references to Google Sheets, working copies, internal-verification banners, and repeated rechecking instructions.

This format was informed by the Department of Health's tabulated hospital statistics and its use of laboratory-examination counts as a service-output measure; **it is not the DOH OHSRS submission form**. Counts represent examinations, not unique patients, while optional calculated amounts are count × unit rate rather than collected revenue.

Report typography follows recent LCP correspondence: Arial 10-point black text, restrained bold headings and signer names, and a 12-point bold report title. The complete, **original-color** LCP letterhead repeats on every A4 printed page. The print layout reserves 47 mm at the top, 46 mm at the bottom and 16 mm at the sides. The on-screen preview paginates content into separate A4 sheets; the browser's Print / Save PDF preview remains authoritative for final paper pagination.

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

1. In the Google Apps Script project, replace **`Code.gs`**, **`Index.html`** (the HTML file named `Index`), and **`SchemaMonitor.gs`** with the files from this branch. Under Project Settings, show the `appsscript.json` manifest and copy that as well.
2. **This deployment intentionally permits anonymous viewing AND editing of the synthetic working-copy spreadsheet.** Do not use it for genuine clinical or confidential records. Keep the original workbook private. Anyone who knows the web-app link may submit validated edits to the working copy.
3. Save. To preserve the existing short link, select **Deploy → Manage deployments → Edit → New version → Deploy**. Choose **Execute as: Me** and **Who has access: Anyone** (including anonymous visitors). The manifest's `webapp.access` is `ANYONE_ANONYMOUS` and `executeAs` is `USER_DEPLOYING`; a changed GitHub file does not change an already-published deployment.
4. The application no longer checks the visitor's email to load data, update a count, save an existing record, or save multiple records. Source-schema checks, stale-value protection and the D:I-only write boundary remain in force. Only owner-authorized executions may install monitoring triggers or approve a new schema baseline.
5. If the source monitor is not yet installed, run `installSourceMonitor` **from the Apps Script editor as the owner** and approve the trigger/email permissions. Existing triggers do not need to be re-created.
6. Test in a private/incognito browser session (signed out), use **Source records** to edit an expendable synthetic row and save; verify the working-copy Sheet changed and that restoring the value works. Test report generation as well. Never test on real institutional records.

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
