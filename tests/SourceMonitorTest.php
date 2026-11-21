<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/SourceMonitor.php';

function check(bool $condition, string $label): void {
    if (!$condition) throw new RuntimeException('SourceMonitor test failed: ' . $label);
}
function kinds(array $result): array {
    return array_column($result['issues'], 'kind');
}
$base = [
    'schemaVersion' => SourceMonitor::SCHEMA_VERSION,
    'sourceHash' => SourceMonitor::digest('synthetic-source-id-not-a-real-spreadsheet'),
    'sheets' => SourceMonitor::SHEETS,
    'data' => [
        'headers' => SourceMonitor::HEADERS,
        'lastRow' => 796, 'lastColumn' => 11, 'maxRows' => 1000, 'maxColumns' => 26,
        'periodDigest' => 'period-1', 'formulaDigest' => 'formula-1', 'valueDigest' => 'records-1'
    ],
    'overview' => [
        'lastRow' => 20, 'lastColumn' => 9, 'maxRows' => 200, 'maxColumns' => 26,
        'formulaDigest' => 'summary-1', 'valueDigest' => 'summary-values-1'
    ]
];
$healthy=SourceMonitor::compare($base, null);
check(!$healthy['needsReview'] && $healthy['compatible'] && $healthy['severity']==='healthy','Static supported source recognized');
check(!SourceMonitor::compare($base,$base)['contentChanged'],'Identical baseline has no data change');

$edited=$base;
$edited['data']['valueDigest']='records-after-count-update';
$edited['overview']['valueDigest']='summary-after-count-update';
$updated=SourceMonitor::compare($edited,$base);
check(!$updated['needsReview'] && $updated['contentChanged'],'Routine count and rate changes do not alert');

$bad=$base;
$bad['data']['headers'][7]='Test quantity';
check(in_array('headers',kinds(SourceMonitor::compare($bad,$base)),true),'Unexpected header caught');
check(!SourceMonitor::compare($bad,$base)['compatible'],'Broken header is critical');
$bad=$base;$bad['data']['lastRow']=797;
check(in_array('row_count',kinds(SourceMonitor::compare($bad,$base)),true),'Source row addition caught');
$bad=$base;$bad['data']['lastColumn']=12;
check(in_array('column_count',kinds(SourceMonitor::compare($bad,$base)),true),'New source column caught');
$bad=$base;$bad['data']['periodDigest']='changed-dates';
check(in_array('reporting_dates',kinds(SourceMonitor::compare($bad,$base)),true),'Reporting date changed');
$bad=$base;$bad['data']['formulaDigest']='changed-formulas';
check(in_array('data_formulas',kinds(SourceMonitor::compare($bad,$base)),true),'Source formula edit detected');
check(SourceMonitor::compare($bad,$base)['severity']==='review','Formula edit classified for review');
$bad=$base;$bad['overview']['formulaDigest']='other-formulas';
check(in_array('summary_formulas',kinds(SourceMonitor::compare($bad,$base)),true),'Overview formula change detected');
$bad=$base;$bad['sheets'][]='New report';
check(in_array('new_tab',kinds(SourceMonitor::compare($bad,$base)),true),'New worksheet surfaced');
$bad=$base;$bad['sheets']=['DEMO - Weekly Census'];
check(in_array('missing_tab',kinds(SourceMonitor::compare($bad,$base)),true),'Deleted worksheet blocks review');
$bad=$base;$bad['sourceHash']='other-source-hash';
check(in_array('different_source',kinds(SourceMonitor::compare($bad,$base)),true),'Spreadsheet reassignment detected');
$bad=$base;$bad['data']['maxRows']=1100;
check(in_array('grid_size',kinds(SourceMonitor::compare($bad,$base)),true),'Grid expansion detected');
$bad=$base;$bad['overview']=null;
check(in_array('missing_overview',kinds(SourceMonitor::compare($bad,$base)),true),'Unreadable overview detected');
$bad=$base;$bad['schemaVersion']='future-schema';
check(in_array('schema_version',kinds(SourceMonitor::compare($bad,$base)),true),'Unknown schema refused');

$finger=SourceMonitor::alertFingerprint([['severity'=>'review','kind'=>'formula','message'=>'Changed formula']]);
check($finger===SourceMonitor::alertFingerprint([['severity'=>'review','kind'=>'formula','message'=>'Changed formula']]),'Issue hash stable');
check($finger!==SourceMonitor::alertFingerprint([['severity'=>'critical','kind'=>'formula','message'=>'Changed formula']]),'Changed issue severity changes alert fingerprint');

$tempDir=sys_get_temp_dir().'/pce-monitor-fixture-'.bin2hex(random_bytes(4));
mkdir($tempDir,0700);
$path=$tempDir.'/monitor-state.json';
try {
    SourceMonitor::writeState($path,['baseline'=>$base,'lastResult'=>$healthy]);
    $state=SourceMonitor::readState($path);
    check(($state['baseline']['data']['lastRow']??0)===796,'Private state round-trip');
    check((fileperms($path)&0777)===0600,'State file permissions are private');
} finally {
    @unlink($path);@rmdir($tempDir);
}
echo "SourceMonitor tests passed: schema drift, formulas, tabs, content changes, alerts and private state\n";
