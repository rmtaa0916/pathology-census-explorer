# Source change monitoring and schema revision workflow

## Goal

The Pathology Census Explorer web app is the main place to edit and analyze the **connected Google Sheets copy**. The spreadsheet is the data store. Users should not normally need to edit cells directly in Sheets.

Structural changes are different from ordinary edits. Adding columns, inserting reporting periods, modifying formulas or changing tabs can require code changes. The monitor detects those changes, warns inside the dashboard and can email the owner.

## Detection

| Change | Result |
|---|---|
| Count, rate or examination value changes in existing supported input columns | Routine data change; no schema-alert email |
| Added/deleted/renamed worksheet | Review alert; app may pause editing |
| Added/removed/shifted populated columns | Critical alert and edit pause |
| Added blank rows or columns, even outside the used range | Review alert via grid-size fingerprint |
| Appended or removed used source rows | Critical alert and edit pause |
| Changed column headings or reordered source columns | Critical alert and edit pause |
| Changed reporting dates or period labels | Critical alert and edit pause |
| Changed any formula in the source or overview worksheet | Review alert and edit pause |
| Changed overall overview worksheet dimensions | Review alert and edit pause |
| Routine changes to cells not part of the fixed schema | Values are checked; not all changes require code updates |

The monitor reports **possible** incompatibility; it does not automatically rewrite application code or prove that a change requires code revision. Formula and header checks use the fixed December 2023 working-copy schema. New months and dynamic columns still require implementation.

## Initial installation (once)

1. In the existing Google Apps Script project, add/update **all three source files**: \`Code.gs\`, \`Index.html\`, and \`SchemaMonitor.gs\`. Update \`appsscript.json\` with the version in GitHub.
2. Save and select the function **\`installSourceMonitor\`** in the Apps Script editor's Run dropdown. Run it **once** while signed in as the authorized owner.
3. Approve the requested permissions for the configured Google Sheet, installable triggers and sending notification email. A trigger may not work if these authorizations are denied.
4. The function installs one spreadsheet \`onChange\` trigger and one **hourly** scheduled backup check. It captures the current schema as its initial baseline.
5. Open the web app and visit **Data quality → Source compatibility monitor**. It should say monitoring is active.
6. Publish the latest code under **Deploy → Manage deployments → Edit → New version → Deploy**. Reusing the existing deployment preserves the Apps Script URL and the saved TinyURL.

**Important:** GitHub commits do **not** update the Apps Script web app. Notification triggers are **not active** until \`installSourceMonitor\` is run successfully on the real project.

## Notifications

- Structural differences are emailed to the authorized account in \`CENSUS.allowedEmail\`. The email includes reasons and a link to the configured working Sheet, **not laboratory data or cell values**.
- Duplicate notifications for the same detected change are suppressed using Script Properties. A different change can generate another notification.
- Spreadsheet change triggers catch many user-driven structural changes. Apps Script executions and Google API writes do **not** reliably trigger Sheets edit/change triggers, so the **hourly check** is essential.
- Email delivery is subject to authorization, Google quotas, and the continued operation of the Apps Script project.
- The website can display alerts on the next page load or when the user selects **Check source**; it is not a background-push live feed.
- Errors in the monitoring script may prevent notification; inspect Apps Script → Executions if the last successful check becomes stale.

## Responding to an alert

1. Open the dashboard's Data quality page or the email alert to see what changed.
2. Review the affected worksheet. If the change was accidental, restore the previous layout and verify the dashboard again.
3. If the change is intentional, update the code contracts and any affected data processing, forms, formulas or reporting UI.
4. Test the new code against the revised Sheet and publish it to the existing deployment.
5. **Only after code supports the changed schema**, manually run \`approveSourceBaseline\` in the Apps Script editor. This replaces the comparison baseline without silently approving incompatible layouts.

The edit functions reject source updates while an incompatible or unreviewed structural change is detected. They never update the original census workbook.

## Current limitations

The editor currently updates existing rows only, and only input fields D–I. It does **not** yet insert new examinations, periods, columns or formulas from the website. Those features require a schema-aware editor and controlled migration support, not merely a monitor.

Changing spreadsheet data by a third-party tool while a record is being edited is handled through stale-value checks, but simultaneous collaboration needs a full activity log and user roles before operational deployment.
