<?php
declare(strict_types=1);

/**
 * PHP monitor command; run only on the authorized PHP host using CLI + cron.
 *
 * php bin/check-source.php --init     (one-time baseline, only for compatible source)
 * php bin/check-source.php --check    (compare to approved baseline; alert on new issues)
 * php bin/check-source.php --status   (print stored status; no network)
 * php bin/check-source.php --approve  (manual baseline reset after reviewed code changes)
 *
 * This command never updates Google Sheets. No email is sent unless
 * SOURCE_MONITOR_ALERT_EMAIL and SOURCE_MONITOR_MAIL_FROM are explicitly set.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}
require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/SourceMonitor.php';

$allowed = ['--init', '--check', '--status', '--approve'];
$action = $argv[1] ?? '--check';
if (!in_array($action, $allowed, true)) {
    fwrite(STDERR, "Usage: php bin/check-source.php --init|--check|--status|--approve\n");
    exit(64);
}
if (currentMode() !== 'live') {
    fwrite(STDERR, "Source monitoring requires APP_MODE=live on a private PHP host.\n");
    exit(3);
}
try {
    $file = SourceMonitor::statePathFromEnv();
    $lock = fopen($file . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Cannot acquire source monitor lock.');
    }
    chmod($file . '.lock', 0600);
    $state = SourceMonitor::readState($file);
    $checkedAt = gmdate('c');
    if ($action === '--status') {
        echo json_encode([
            'initialized' => isset($state['baseline']),
            'lastCheckedAt' => $state['lastCheckedAt'] ?? null,
            'lastResult' => $state['lastResult'] ?? null,
            'alertSentAt' => $state['lastAlertSentAt'] ?? null,
            'schedule' => 'host-managed (not installed by this command)' // Cron is external.
        ], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR), "\n";
        exit(isset($state['baseline']) ? 0 : 3);
    }
    if ($action === '--check' && !isset($state['baseline'])) {
        fwrite(STDERR, "Monitor baseline not initialized; run --init after reviewing the worksheet.\n");
        exit(3);
    }
    if ($action === '--init' && isset($state['baseline'])) {
        fwrite(STDERR, "Baseline already exists. Use --check; --approve is deliberate after a reviewed change.\n");
        exit(3);
    }
    $api = new SheetsClient();
    $snapshot = $api->readSourceMonitorSnapshot();
    $baseline = $state['baseline'] ?? null;
    $static = SourceMonitor::compare($snapshot, null);
    if ($action === '--init' || $action === '--approve') {
        if ($static['needsReview']) {
            throw new RuntimeException('Source still violates the supported schema; refusing to approve the baseline. Issues: ' .
                implode(', ', array_column($static['issues'], 'kind')));
        }
        $state['baseline'] = $snapshot;
        $state['lastAlertFingerprint'] = null;
        $state['lastResult'] = $static;
        $state['lastCheckedAt'] = $checkedAt;
        SourceMonitor::writeState($file, $state);
        echo "Source schema baseline " . ($action === '--init' ? 'initialized' : 'approved') .
             " after validation; private metadata digests stored.\n";
        exit(0);
    }

    $result = SourceMonitor::compare($snapshot, $baseline);
    // Only issue kinds and severity are included in status; never source-cell values.
    $state['lastResult'] = $result;
    $state['lastCheckedAt'] = $checkedAt;
    if (!$result['needsReview']) {
        // A fixed issue must alert again if it reappears later.
        $state['lastAlertFingerprint'] = null;
    } else {
        $fingerprint = SourceMonitor::alertFingerprint($result['issues']);
        $to = trim((string)getenv('SOURCE_MONITOR_ALERT_EMAIL'));
        $from = trim((string)getenv('SOURCE_MONITOR_MAIL_FROM'));
        if ($to !== '' && $from !== '' &&
            filter_var($to, FILTER_VALIDATE_EMAIL) && filter_var($from, FILTER_VALIDATE_EMAIL) &&
            ($state['lastAlertFingerprint'] ?? null) !== $fingerprint) {
            $subject = '[Pathology Census Explorer] Source change requires review';
            $body = "The census source structure or formulas changed and need review.\n\n" .
                implode("\n", array_map(
                    static fn(array $issue): string => '- ' . strtoupper($issue['severity']) . ': ' . $issue['message'],
                    $result['issues']
                )) .
                "\n\nRoutine count/rate edits do not trigger these notices.\n" .
                "Review the PHP source monitor and approved source schema.\n";
            // PHP mail() requires a working local MTA on the deployment host.
            if (mail($to, $subject, $body, 'From: ' . $from . "\r\nContent-Type: text/plain; charset=UTF-8")) {
                $state['lastAlertFingerprint'] = $fingerprint;
                $state['lastAlertSentAt'] = $checkedAt;
            } else {
                fwrite(STDERR, "A source issue was detected, but the host could not accept the email alert.\n");
            }
        }
    }
    SourceMonitor::writeState($file, $state);
    echo json_encode([
        'checkedAt' => $checkedAt,
        'severity' => $result['severity'],
        'needsReview' => $result['needsReview'],
        'contentChanged' => $result['contentChanged'],
        'issues' => $result['issues'],
        'emailConfigured' => filter_var((string)getenv('SOURCE_MONITOR_ALERT_EMAIL'), FILTER_VALIDATE_EMAIL) !== false && filter_var((string)getenv('SOURCE_MONITOR_MAIL_FROM'), FILTER_VALIDATE_EMAIL) !== false
    ], JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR), "\n";
    exit($result['needsReview'] ? 2 : 0);
} catch (Throwable $error) {
    // Persist failure rather than leaving an old healthy state as the last scan.
    if (isset($file, $state) && is_string($file) && is_array($state)) {
        try {
            $state['lastCheckedAt'] = gmdate('c');
            $state['lastResult'] = [
                'compatible' => false, 'needsReview' => true,
                'severity' => 'critical', 'contentChanged' => false,
                'issues' => [['severity' => 'critical', 'kind' => 'monitor_error',
                    'message' => 'The source scan could not complete. Check host/API access.']]
            ];
            SourceMonitor::writeState($file, $state);
        } catch (Throwable $ignored) {
            // The command still exits nonzero if private state is unavailable.
        }
    }
    fwrite(STDERR, 'Monitor failed: ' . $error->getMessage() . "\n");
    exit(2);
}
