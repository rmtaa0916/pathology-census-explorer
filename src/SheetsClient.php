<?php
declare(strict_types=1);

final class SheetsClient
{
    private string $sheetId;
    private array $credentials;
    private ?string $accessToken = null;
    public const TAB = 'DEMO - Weekly Census';

    public function __construct()
    {
        $this->sheetId = trim((string)getenv('GOOGLE_SPREADSHEET_ID'));
        if (!preg_match('/^[A-Za-z0-9_-]{20,}$/', $this->sheetId)) {
            throw new RuntimeException('GOOGLE_SPREADSHEET_ID must be configured.');
        }
        $file = trim((string)getenv('GOOGLE_SERVICE_ACCOUNT_FILE'));
        if ($file === '' || !is_file($file)) {
            throw new RuntimeException('GOOGLE_SERVICE_ACCOUNT_FILE must point to a private credential JSON file.');
        }
        $this->credentials = json_decode((string)file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
        if (($this->credentials['type'] ?? '') !== 'service_account' || empty($this->credentials['private_key']) || empty($this->credentials['client_email'])) {
            throw new RuntimeException('Invalid service-account credentials.');
        }
    }

    public function spreadsheetId(): string { return $this->sheetId; }

    public function readRows(): array
    {
        // Read only the configured working-copy tab; never fetch the original workbook.
        $range = "'" . self::TAB . "'!A4:K900";
        $uri = 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($this->sheetId)
             . '/values/' . rawurlencode($range) . '?valueRenderOption=UNFORMATTED_VALUE';
        $result = $this->request('GET', $uri);
        return $result['values'] ?? [];
    }

    public function updateDemoCount(int $row, int $count, string $period, string $test, int $expectedCount): array
    {
        if ($row < 5 || $row > 900 || $count < 0 || $count > 100000 || $expectedCount < 0) {
            throw new InvalidArgumentException('Invalid worksheet row, count or previous value.');
        }
        // Optimistic concurrency check; prevents accidental overwrite when another editor changed the row.
        $checkRange = "'" . self::TAB . "'!A{$row}:K{$row}";
        $check = $this->request('GET', 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($this->sheetId)
            . '/values/' . rawurlencode($checkRange) . '?valueRenderOption=UNFORMATTED_VALUE');
        $v = $check['values'][0] ?? [];
        if (($v[0] ?? null) !== $period || ($v[3] ?? null) !== $test || (int)($v[7] ?? -1) !== $expectedCount
            ) {
            throw new RuntimeException('The source entry changed. Reload and review before editing.');
        }
        $range = "'" . self::TAB . "'!H{$row}";
        return $this->request('PUT', 'https://sheets.googleapis.com/v4/spreadsheets/' . rawurlencode($this->sheetId)
            . '/values/' . rawurlencode($range) . '?valueInputOption=RAW',
            ['range' => $range, 'majorDimension' => 'ROWS', 'values' => [[$count]]]);
    }


    /**
     * Save up to 100 staged source records using ONE atomic Sheets API
     * spreadsheets.batchUpdate request. Preflight checks are optimistic;
     * a different editor could still modify a row between read and write.
     */
    public function updateRecordsBatch(array $changes): array
    {
        require_once __DIR__ . '/CensusBatchPlanner.php';
        $spreadsheetUri='https://sheets.googleapis.com/v4/spreadsheets/'.rawurlencode($this->sheetId);
        // Fetch the live tab ID and require the expected working-copy layout.
        $info=$this->request('GET',$spreadsheetUri.'?fields=sheets(properties(title,sheetId))');
        $tabs=[];
        foreach(($info['sheets']??[]) as $item){
            $p=$item['properties']??[];
            if(isset($p['title'],$p['sheetId']))$tabs[$p['title']]=(int)$p['sheetId'];
        }
        if(count($tabs)!==2||!isset($tabs[self::TAB],$tabs['DEMO - Weekly Overview'])){
            throw new RuntimeException('Spreadsheet tabs changed. Review the source before batch editing.');
        }
        $rows=$this->readRows();
        $formulaRange="'".self::TAB."'!J5:J796";
        $formulas=$this->request('GET',$spreadsheetUri.'/values/'.
            rawurlencode($formulaRange).'?valueRenderOption=FORMULA');
        $plan=CensusBatchPlanner::plan($rows,$formulas['values']??[],$changes,$tabs[self::TAB]);
        // Atomic at the Google Sheets batchUpdate request level; only D:I.
        $this->request('POST',$spreadsheetUri.':batchUpdate',['requests'=>$plan['requests']]);
        return ['success'=>true,'updatedCount'=>$plan['updatedCount'],
            'rows'=>$plan['rows']];
    }

    private static function base64url(string $data): string { return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); }

    private function token(): string
    {
        if ($this->accessToken !== null) return $this->accessToken;
        $now = time();
        $header = self::base64url(json_encode(['alg' => 'RS256','typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $claims = self::base64url(json_encode([
            'iss' => $this->credentials['client_email'], 'scope' => 'https://www.googleapis.com/auth/spreadsheets',
            'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $now, 'exp' => $now + 3600,
        ], JSON_THROW_ON_ERROR));
        $toSign = $header . '.' . $claims;
        if (!openssl_sign($toSign, $signature, $this->credentials['private_key'], OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('Service account signing failed.');
        }
        $assertion = $toSign . '.' . self::base64url($signature);
        $response = $this->rawRequest('POST', 'https://oauth2.googleapis.com/token',
            http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $assertion]),
            ['Content-Type: application/x-www-form-urlencoded']);
        $token = json_decode($response, true, 512, JSON_THROW_ON_ERROR)['access_token'] ?? null;
        if (!is_string($token)) throw new RuntimeException('Google OAuth token exchange failed.');
        return $this->accessToken = $token;
    }

    private function request(string $method, string $url, ?array $body = null): array
    {
        $headers = ['Authorization: Bearer ' . $this->token()];
        if ($body !== null) $headers[] = 'Content-Type: application/json';
        $raw = $this->rawRequest($method, $url, $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR), $headers);
        return json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    }

    private function rawRequest(string $method, string $url, ?string $body, array $headers): string
    {
        $options = ['http' => [
            'method' => $method, 'header' => implode("\r\n", $headers), 'timeout' => 20,
            'ignore_errors' => true, 'content' => $body ?? '',
        ]];
        $context = stream_context_create($options);
        $result = @file_get_contents($url, false, $context);
        $status = $http_response_header[0] ?? 'HTTP/1.1 000 No response';
        if (!is_string($result) || !preg_match('/^HTTP\/\S+ 2\d\d /', $status)) {
            throw new RuntimeException('Google API request failed: ' . substr($status, 0, 90));
        }
        return $result;
    }
}
