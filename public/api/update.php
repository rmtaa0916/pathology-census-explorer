<?php
declare(strict_types=1);
require_once __DIR__ . '/../../src/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
appAuthenticate();
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || currentMode() !== 'live' || getenv('APP_WRITE_ENABLED') !== '1') {
        http_response_code(403);echo json_encode(['error'=>'Editing is disabled']);exit;
    }
    // Same-origin + CSRF gate; no browser-trusted headers for cross-origin writes.
    if (!isset($_SESSION)) session_start(['cookie_httponly'=>true,'cookie_samesite'=>'Strict','use_strict_mode'=>true]);
    $body = json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], (string)($body['csrf'] ?? ''))) {
        http_response_code(403);echo json_encode(['error'=>'Invalid CSRF token']);exit;
    }
    $client = new SheetsClient();
    $result = $client->updateDemoCount((int)($body['sheetRow']??0),(int)($body['count']??-1),
        (string)($body['period']??''),(string)($body['test']??''),(int)($body['expectedCount']??-1));
    echo json_encode(['updatedRange'=>$result['updatedRange']??null,'success'=>true]);
} catch (Throwable $ex) {
    http_response_code(400); echo json_encode(['error'=>$ex->getMessage()]);
}
