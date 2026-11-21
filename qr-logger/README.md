# LCP Pathology — Hybrid QR Logger (synthetic pilot)

**Status:** source-ready proof of concept. **Not deployed. Not approved for real patient, instrument or inventory records.**
The separate QR Logger Apps Script project intentionally does not modify the existing Pathology Census Explorer's \`Code.gs\`, fixed December 2023 dataset, protected worksheet schema, or currently published deployment.

## What was implemented

- A phone-friendly HTML Service logging page. QR codes are scanned using the phone's **normal camera**; the encoded link opens \`/exec?ref=...\` and preselects the item/test. No iframe camera permissions are needed.
- Two printable A4 screens: a **laminated reference sheet** for five synthetic Immunology examination types plus pipette tips, and **unique physical kit labels** for five synthetic reagent kits plus a tip package.
- QR codes are rendered in the browser by a **locally bundled MIT-licensed QRCode.js**; no third-party QR-generation web service or CDN is called.
- Independent test events (\`TEST_PERFORMED\`, \`TEST_REPEAT\`, \`TEST_QC\`) and physical stock events (\`KIT_OPENED\`, \`CONSUMED\`, \`WASTED\`, \`RECEIVED\`).
- One authoritative append-only \`TRANSACTIONS\` ledger. Transactions are time-stamped in UTC. **Scanning a code never deducts stock**—only a confirmed validated event can do so.
- Each deliberate confirmation gets a new \`QR-...\` transaction ID. A network retry reuses its original ID and cannot be counted twice. Two actual uses get distinct IDs, even when they involve the same QR.
- Google \`LockService\` serializes stock changes and transaction-ID checks. A mismatch on an already used ID is rejected.
- Lot-specific stock validation: opening a kit does not reduce balance; consume/waste deduct; receive adds; negative stock, expired stock usage and consuming unopened kits are blocked.
- Owner-only pilot manifest and allowlisted staff email checks. Missing Google identity causes **access denied**.

## Synthetic Google Sheet

The separate pilot workbook is:
[Pathology QR Logger — SYNTHETIC Pilot Transactions](https://docs.google.com/spreadsheets/d/1v9KhrkTYZ_H8vvIHqlPYhaGCyXD_Ofw7aTqGm01QwmY/edit)

Tabs: \`TEST_CATALOG\`, \`ITEM_MASTER\`, \`ITEM_LOTS\`, \`TRANSACTIONS\`, \`STAFF_ACCESS\`, \`SETTINGS\`, \`README\`. Every seeded item and lot is fictional. \`TRANSACTIONS\` begins with a header row and no events.

## Deployment: separate Apps Script project

1. Open [script.google.com](https://script.google.com) under the **pilot workbook's owner account** and create a **new standalone Apps Script project** named \`Pathology QR Logger — Pilot\`. Do **not** replace files in the existing census script project.
2. Add the files from this folder: \`Code.gs\` (script), \`Index.html\` (HTML), and \`QrLibrary.html\` (HTML). Enable showing \`appsscript.json\` and use the provided manifest configured for signed-in user identity checks.
3. In **Project Settings → Script properties**, create \`QR_WORKBOOK_ID\` with value \`1v9KhrkTYZ_H8vvIHqlPYhaGCyXD_Ofw7aTqGm01QwmY\`. Keep account emails and credentials out of the GitHub repository.
4. The pilot workbook currently allows \`rmtaa0916@gmail.com\` (administrator) and \`rmtaa0917@gmail.com\` (technologist). Each signed-in user must also have **Editor** access to the separate pilot workbook because the web app runs using the accessing user's permissions.
5. Deploy **Web app**, **Execute as: User accessing the web app**, **Who has access: Anyone with a Google account**. The backend still rejects identities not explicitly active in \`STAFF_ACCESS\`. Each tester must authorize the app and must have access to the workbook. These settings are for a test-only workbook; review security and data architecture before broader hospital use.
6. From the QR Logger, select **A4 reference sheet** or **Kit labels** and **Print**. Print only **after deployment**—QR links are built from \`ScriptApp.getService().getUrl()\`, so development placeholders are not valid final links.
7. Scan a printed QR using an Android/iPhone camera, confirm a synthetic event, and verify the newly appended \`TRANSACTIONS\` row and balance in the web app.

**Important:** GitHub changes do not automatically deploy Apps Script. In **Deploy → Manage deployments → Edit**, update the existing deployment to **Execute as: User accessing the web app** and select **New version**. An Apps Script owner must deploy a version explicitly. If you redeploy to a new \`/exec\` URL, reprint codes (or introduce a stable redirect). For broader staff access, do not merely change the manifest: test that \`Session.getActiveUser().getEmail()\` exposes the actual signed-in identity under the selected deployment mode/domain. If it does not, the backend denies access by design. A multi-staff deployment needs approved identity architecture and appropriate Workspace privacy controls.

## Safety and design limitations

- **No patient identifier, specimen number, patient billing classification, clinical result or test result** belongs in QR labels or the pilot transaction notes.
- A test QR means an activity was *claimed*, not that an analyzer verified it. The pilot does **not** write to the Pathology Census Explorer and does not create official billable tests.
- Staff are told when a save fails or its status is uncertain. The **Retry SAME transaction** button preserves the original transaction ID; a **Use again / new event** button starts a distinct deliberate usage.
- The physical lot is required for inventory deductions. A generic item QR first resolves to an explicitly chosen kit/package; it cannot silently deduct from a random lot.
- Unlike a fully operational LIMS, the pilot does not yet handle reversals/approvals, offline transaction queues, instrument integration, exhaustive audit reporting, or high-volume ledger optimization. The \`TRANSACTIONS\` sheet is not an immutable database: a workbook editor can still alter it outside the app.
- The GitHub repo was public at implementation time. Do not commit confidential details, tokens, sheet contents or real clinical data.

## Test locally / in GitHub Actions

Run \`node qr-logger/tests/backend.test.cjs\` from repository root. The test suite mocks Google Sheets and checks repeated valid use, replay idempotency, stock limits, unopened and expired lots, unsafe notes, and authorization. It does not establish that a Google-hosted Apps Script deployment is operating correctly; that requires phone testing and authorization checks.

## Future integration with existing Census Explorer

Only after the pilot is accepted: design an explicit, reviewed mapping from **verified** test events to the reporting calendar and categories. Patient test counts and physical reagent consumption remain separate; do not auto-add a reagent scan into official census aggregates.
