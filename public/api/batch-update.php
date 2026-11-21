<?php
declare(strict_types=1);
require_once __DIR__.'/../../src/bootstrap.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
appAuthenticate();
try {
    if($_SERVER['REQUEST_METHOD']!=='POST'||currentMode()!=='live'||
        getenv('APP_WRITE_ENABLED')!=='1') {
        http_response_code(403);echo json_encode(['error'=>'Editing is disabled.']);exit;
    }
    if(session_status()!==PHP_SESSION_ACTIVE)
        session_start(['cookie_httponly'=>true,'cookie_samesite'=>'Strict','use_strict_mode'=>true]);
    $body=json_decode((string)file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);
    if(!is_array($body)||empty($_SESSION['csrf'])||
       !hash_equals($_SESSION['csrf'],(string)($body['csrf']??''))) {
        http_response_code(403);echo json_encode(['error'=>'Invalid CSRF token']);exit;
    }
    if(!is_array($body['changes']??null)){
        http_response_code(400);echo json_encode(['error'=>'Missing staged edits.']);exit;
    }
    $client=new SheetsClient();
    $result=$client->updateRecordsBatch($body['changes']);
    echo json_encode($result,JSON_THROW_ON_ERROR);
} catch(Throwable $ex){
    http_response_code(400);
    echo json_encode(['success'=>false,'error'=>$ex->getMessage()]);
}
