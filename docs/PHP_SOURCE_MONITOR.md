# PHP source-change monitoring

The PHP implementation now has a **read-only structural monitor** equivalent in purpose to the Apps Script `SchemaMonitor.gs`. It detects:

- Deleted/renamed/extra source or overview worksheets
- Changed headings, unexpected row or column counts
- Changes to the fixed December 2023 reporting-date fields
- Changes to source and overview sheet formulas
- Changes to sheet grid dimensions, and changes to the configured spreadsheet ID

Ordinary edits to **counts or rates** do not generate an issue or email. The monitor still reports `contentChanged: true` when values change. Alerts identify only structural issue types/messages—**never worksheet cell values or patient records**.

## Requirements and costs

- An existing **private PHP host** with PHP 8.2+, command-line PHP, and the configured Google Sheets service account.
- A **private directory** outside the web document root for the monitor state JSON and lock.
- A task scheduler (cron or hosting equivalent). The repository does **not** start a scheduler, purchase hosting, or create paid services.
- Optional: a working local mail transport for `mail()`. No mail is sent until both sender and recipient variables are explicitly set.

The same service account is used for read-only monitoring. Each check calls the Google Sheets API to inspect metadata, source values, and formulas. Monitoring cannot run without the PHP host and credentials.

## Configuration

On the authorized PHP host, configure the existing environment variables:

```sh
APP_MODE=live
GOOGLE_SPREADSHEET_ID=the-authorized-synthetic-test-sheet-id
GOOGLE_SERVICE_ACCOUNT_FILE=/absolute/private/path/service-account.json
```

Create a private directory outside the webroot, and add:

```sh
SOURCE_MONITOR_STATE_FILE=/absolute/private/path/source-monitor.json
# Optional; requires an actual working mail transport on the host:
SOURCE_MONITOR_ALERT_EMAIL=
SOURCE_MONITOR_MAIL_FROM=
```

**Never** put credentials, the private JSON, email destinations, or the actual census data in GitHub. Make sure the PHP process can write to the state directory. The monitor saves SHA-256 digests and structural metadata, not the underlying worksheet cells.

## First run, monitoring, and schema approval

Run from the repository root on the host:

```sh
php bin/check-source.php --init
php bin/check-source.php --check
php bin/check-source.php --status
```

Initialization **fails closed** if the source does not match the supported 2023 structure. It is not a migration tool. A subsequent `--check` compares the latest worksheet with the approved snapshot and returns:

- Exit code **0**: schema matches the baseline (routine numeric changes are fine).
- Exit code **2**: structural/formula issues or a failed source scan require attention.
- Exit code **3**: not initialized, wrong mode, or a blocked operation.
- Exit code **64**: invalid CLI command.

After reviewing a legitimate layout or formula change, updating the code mapping if needed, and rerunning all tests, use:

```sh
php bin/check-source.php --approve
```

This explicitly replaces the stored reference. **Never approve an unreviewed source change.** An incompatible schema cannot be approved.

If your host provides cron, an hourly scan could be configured as:

```cron
17 * * * * /usr/bin/php /absolute/private/repo/bin/check-source.php --check >> /absolute/private/logs/census-monitor.log 2>&1
```

The path and cadence must be set on your own host; this example is **not installed by GitHub**. If email environment variables and an MTA are configured, the monitor sends an alert only for a **new set of issues**. Repeated scans of the same unresolved issue do not resend it. After a source returns to healthy, a later recurrence may alert again.

## Write safeguards

When `SOURCE_MONITOR_STATE_FILE` is configured, the PHP single-record and batch-edit endpoints also compare the live source with the approved baseline before changing any cells. If the layout or formulas require review—or if the baseline is missing—writes are blocked. Existing category and formula validation remain in place.

This check adds extra Google Sheets API calls at save time. For a read-only demonstration, leave `APP_WRITE_ENABLED=0` as before.

## Scope and limitations

- The Apps Script version has spreadsheet **on-change triggers plus hourly polling**. PHP uses **CLI polling only**, and it is not active until the host operator installs cron.
- The PHP scan examines source values and formula coordinates in **A4:AZ1000**, and the overview in **A1:AZ500**. Populated content beyond these explicit ranges will not be inspected. A future schema version requires expanding those ranges and revisiting the baseline.
- PHP `mail()` returns whether the host accepts an email for delivery, not whether the recipient received it. Without a mail transport, use logs or hosting notifications instead.
- This is a **synthetic source-copy pilot**. Do not connect it to real institutional or patient-level records without approved hosting, security review, and appropriate access controls.
