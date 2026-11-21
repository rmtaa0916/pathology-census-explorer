<?php
declare(strict_types=1);

/**
 * Read-only Google Sheets structural/source monitor.
 *
 * This is deliberately independent of the editor, and captures only
 * non-sensitive metadata plus SHA-256 hashes: no cell values are persisted.
 * It mirrors the Apps Script SchemaMonitor contract for the December 2023
 * synthetic census workbook. Alerts are opt-in via an external CLI schedule.
 */
final class SourceMonitor
{
    public const SHEETS = ['DEMO - Weekly Census', 'DEMO - Weekly Overview'];
    public const HEADERS = [
        'Period', 'Start date', 'End date', 'Examination', 'Patient group',
        'Billing', 'Priority', 'Test count', 'Example rate (₱)',
        'Demo amount (₱)', 'Data status'
    ];
    public const LAST_DATA_ROW = 796;
    public const DATA_COLUMNS = 11;
    public const SCHEMA_VERSION = 'dec-2023-copy-v1';

    public static function digest(mixed $value): string
    {
        return hash('sha256', json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }

    /**
     * @return array{compatible:bool,needsReview:bool,issues:array,
     *   contentChanged:bool,severity:string}
     */
    public static function compare(array $current, ?array $baseline = null): array
    {
        $issues = [];
        $flag = static function (string $severity, string $kind, string $message) use (&$issues): void {
            $issues[] = compact('severity', 'kind', 'message');
        };
        $names = $current['sheets'] ?? [];
        if (!is_array($names)) $names = [];
        $missing = array_values(array_diff(self::SHEETS, $names));
        $added = array_values(array_diff($names, self::SHEETS));
        if ($missing) $flag('critical', 'missing_tab', 'Required worksheet missing or renamed: ' . implode(', ', $missing));
        if ($added) $flag('review', 'new_tab', 'Additional worksheet detected; review the application mappings.');
        if (($current['schemaVersion'] ?? null) !== self::SCHEMA_VERSION) {
            $flag('critical', 'schema_version', 'The worksheet schema version is not recognized.');
        }
        if ($baseline && ($current['sourceHash'] ?? null) !== ($baseline['sourceHash'] ?? null)) {
            $flag('critical', 'different_source', 'The configured spreadsheet changed. Revalidate it before editing.');
        }
        $data = $current['data'] ?? null;
        if (!is_array($data)) {
            $flag('critical', 'missing_data', 'The census worksheet cannot be inspected.');
        } else {
            $head = $data['headers'] ?? [];
            for ($i=0;$i<count(self::HEADERS);$i++) {
                if (($head[$i] ?? null) !== self::HEADERS[$i]) {
                    $flag('critical', 'headers', 'The census header at column ' . ($i+1) . ' changed.');
                }
            }
            if (($data['lastRow'] ?? null) !== self::LAST_DATA_ROW) {
                $flag('critical', 'row_count', 'Expected 792 source entries ending at row 796; worksheet row range changed.');
            }
            if (($data['lastColumn'] ?? null) !== self::DATA_COLUMNS) {
                $flag('critical', 'column_count', 'The census worksheet data column count changed.');
            }
            if ($baseline && is_array($baseline['data'] ?? null)) {
                $before = $baseline['data'];
                if (($data['periodDigest'] ?? null) !== ($before['periodDigest'] ?? null)) {
                    $flag('critical', 'reporting_dates', 'Reporting periods or the fixed source date columns changed.');
                }
                if (($data['formulaDigest'] ?? null) !== ($before['formulaDigest'] ?? null)) {
                    $flag('review', 'data_formulas', 'A census formula changed since the approved baseline.');
                }
                if (($data['maxRows'] ?? null) !== ($before['maxRows'] ?? null) ||
                    ($data['maxColumns'] ?? null) !== ($before['maxColumns'] ?? null)) {
                    $flag('review', 'grid_size', 'The census worksheet grid dimensions changed.');
                }
            }
        }
        $overview = $current['overview'] ?? null;
        if (!is_array($overview)) {
            $flag('critical', 'missing_overview', 'The overview worksheet cannot be inspected.');
        } elseif ($baseline && is_array($baseline['overview'] ?? null)) {
            $before = $baseline['overview'];
            if (($overview['formulaDigest'] ?? null) !== ($before['formulaDigest'] ?? null)) {
                $flag('review', 'summary_formulas', 'A summary worksheet formula changed.');
            }
            foreach (['lastRow','lastColumn','maxRows','maxColumns'] as $prop) {
                if (($overview[$prop] ?? null) !== ($before[$prop] ?? null)) {
                    $flag('review', 'overview_layout', 'The overview worksheet layout changed.');
                    break;
                }
            }
        }

        $contentChanged = $baseline !== null && (
            ($current['data']['valueDigest'] ?? null) !== ($baseline['data']['valueDigest'] ?? null) ||
            ($current['overview']['valueDigest'] ?? null) !== ($baseline['overview']['valueDigest'] ?? null)
        );
        $critical = array_filter($issues, static fn(array $i): bool => $i['severity'] === 'critical');
        return [
            'compatible' => !$critical,
            'needsReview' => (bool)$issues,
            'issues' => $issues,
            'contentChanged' => $contentChanged,
            'severity' => $critical ? 'critical' : ($issues ? 'review' : 'healthy')
        ];
    }

    public static function alertFingerprint(array $issues): string
    {
        // Hash only the issue kind and severity, so routine value changes
        // never create alerts or flood notifications.
        $keys = array_map(static fn(array $i): array => [$i['severity'], $i['kind'], $i['message']], $issues);
        return self::digest($keys);
    }

    /**
     * Refuse to store state within the public document root.
     * The state contains hashes only, but revealing its location is unnecessary.
     */
    public static function statePathFromEnv(): string
    {
        $path = trim((string)getenv('SOURCE_MONITOR_STATE_FILE'));
        if ($path === '' || !str_starts_with($path, '/')) {
            throw new RuntimeException('Set SOURCE_MONITOR_STATE_FILE to an absolute path outside the webroot.');
        }
        $parent = realpath(dirname($path));
        $public = realpath(__DIR__ . '/../public');
        if (!$parent || !$public ||
            $parent === $public || str_starts_with($parent . '/', $public . '/')) {
            throw new RuntimeException('Monitor state must be in an existing private directory outside public/.');
        }
        return $parent . '/' . basename($path);
    }

    public static function readState(string $path): array
    {
        if (!is_file($path)) return [];
        $data = file_get_contents($path);
        if (!is_string($data)) throw new RuntimeException('Unable to read monitor state.');
        $state = json_decode($data, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($state)) throw new RuntimeException('Invalid monitor state.');
        return $state;
    }

    public static function writeState(string $path, array $state): void
    {
        $bytes = json_encode($state, JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE);
        $temp = tempnam(dirname($path), '.monitor-');
        if (!is_string($temp)) throw new RuntimeException('Could not create private monitor state.');
        try {
            if (file_put_contents($temp, $bytes, LOCK_EX) === false) {
                throw new RuntimeException('Unable to save monitor state.');
            }
            chmod($temp, 0600);
            if (!rename($temp, $path)) throw new RuntimeException('Unable to replace monitor state.');
        } finally {
            if (is_file($temp)) @unlink($temp);
        }
    }
}
