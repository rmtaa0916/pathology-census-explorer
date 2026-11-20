<?php
declare(strict_types=1);
require_once __DIR__ . '/SheetsClient.php';
require_once __DIR__ . '/CensusData.php';

function currentMode(): string { return getenv('APP_MODE') === 'live' ? 'live' : 'demo'; }
function appAuthenticate(): void {
    if (currentMode() !== 'live') return;
    $user = getenv('APP_ACCESS_USER');
    $hash = getenv('APP_ACCESS_PASSWORD_HASH');
    if (!$user || !$hash) { http_response_code(503); exit('Authentication must be configured before live data access.'); }
    $u = $_SERVER['PHP_AUTH_USER'] ?? '';
    $p = $_SERVER['PHP_AUTH_PW'] ?? '';
    if (!hash_equals($user, $u) || !password_verify($p, $hash)) {
        header('WWW-Authenticate: Basic realm="Pathology Census (authorized users only)"');
        http_response_code(401);exit('Authorization required');
    }
}
function fetchDataset(): array {
    if (currentMode() === 'demo') return CensusData::fromSheetRows(CensusData::mockRows());
    $api = new SheetsClient();
    return CensusData::fromSheetRows($api->readRows(),$api->spreadsheetId());
}
