# Pathology Census Explorer — Apps Script working copy

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

Six interactive views: Overview, Reporting intervals, Examinations, Workload & income, Source records and Data quality. Views share source data and support filters, rankings, drill-down, editing, and refresh.

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

## Deployment

1. Open the existing Pathology Census Explorer Apps Script project as its authorized owner.
2. Paste the current `Code.gs` and `Index.html` from this branch. If changing manifest permissions, update `appsscript.json`.
3. Save. To preserve the existing public-facing alias, choose **Deploy → Manage deployments → Edit → New version → Deploy**. Do not create a new deployment unless you want a new `/exec` URL.
4. Keep **Execute as: Me** and **Who has access: Only myself** during this pilot. The server additionally verifies the active user's email.
5. Confirm that the existing working Sheet is connected. Test a single edit, formula calculation, refresh, and Undo using a non-sensitive row.

GitHub commits do **not** automatically update the live Apps Script deployment. The existing TinyURL forwards to the current `/exec` URL; updating that deployment keeps the alias.

## Tests

```sh
node tests/backend.test.cjs
node tests/frontend.test.cjs
```

GitHub Actions runs these checks for changes to `apps-script`. Local browser tests exercise the asynchronous workflow with mocked `google.script.run`; they are not a substitute for verifying the published Google-hosted version.

## Boundaries

The existing December 2023 layout is intentionally fixed to 792 rows; adding months/rows requires a schema update. The app is not yet equipped with institutional approval, multi-user roles, immutable edit history or medical data governance controls. The working copy should not be treated as the official census solely because its values can be displayed or edited.
