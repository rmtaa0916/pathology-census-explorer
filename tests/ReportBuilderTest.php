<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/CensusData.php';
require_once __DIR__ . '/../src/ReportBuilder.php';

function verify(bool $ok, string $message): void {
    if (!$ok) throw new RuntimeException('ReportBuilder test failed: '.$message);
}
$data=CensusData::fromSheetRows(CensusData::mockRows());
verify(count($data['records'])===792,'records exposed');
$full=ReportBuilder::build($data,'all',false);
verify($full['fullCoverage']===true,'full coverage flag');
verify($full['dateStart']==='2023-12-01'&&$full['dateEnd']==='2023-12-31','full dates');
verify($full['totals']['examinations']===$data['summary_stats']['total_volume'],'count reconciliation');
verify(abs($full['totals']['amount']-$data['summary_stats']['reported_income'])<.001,'amount reconciliation');
verify($full['totals']['patient']+$full['totals']['qfs']===$full['totals']['examinations'],'patient vs QFS');
verify(count($full['examinations'])===22,'all examinations listed');
verify(count($full['categories'])===198,'all grouped source categories');
verify(count($full['periodTotals'])===4,'all period totals');
verify(array_sum(array_column($full['periodTotals'],'count'))===$full['totals']['examinations'],'period counts add up');
verify(abs(array_sum(array_column($full['periodTotals'],'amount'))-$full['totals']['amount'])<.001,'period amounts add up');

$periodVolume=0;$periodAmount=0;
for($i=0;$i<4;$i++){
    $r=ReportBuilder::build($data,(string)$i,true);
    verify($r['fullCoverage']===false,'individual period');
    verify($r['appendix']===true,'appendix');
    verify($r['rowsIncluded']===198,'period source record count');
    verify(count($r['examinations'])===22,'period examinations present');
    verify(count($r['categories'])===198,'period categories');
    verify($r['totals']['examinations']===$full['periodTotals'][$i]['count'],'period matches full totals');
    verify(abs($r['totals']['amount']-$full['periodTotals'][$i]['amount'])<.001,'period amount matches full totals');
    $periodVolume+=$r['totals']['examinations'];$periodAmount+=$r['totals']['amount'];
}
verify($periodVolume===$full['totals']['examinations'],'all volume preserved');
verify(abs($periodAmount-$full['totals']['amount'])<.001,'all money preserved');
try{ReportBuilder::build($data,'5');throw new RuntimeException('Invalid period accepted');}
catch(InvalidArgumentException $ok){}
echo "ReportBuilder tests passed: full and four periods, 22 tests, 198 categories, totals and amounts reconciled\n";
