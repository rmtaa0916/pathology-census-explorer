<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/CensusData.php';
$rows = CensusData::mockRows();
assert(count($rows) === 793);
$dataset = CensusData::fromSheetRows($rows);
assert(count($dataset['exams']) === 22);
assert(count($dataset['entries']) === 198);
$sum = array_sum(array_map(fn($e)=>$e['volume'], $dataset['entries']));
assert($sum === $dataset['summary_stats']['total_volume']);
$weekTotals = [0,0,0,0];
foreach ($dataset['entries'] as $e) for ($i=0;$i<4;$i++) $weekTotals[$i]+=$e['weeks'][$i];
assert(array_sum($weekTotals) === $sum);
assert(min($weekTotals)>0);
echo 'CensusData tests passed: '.count($dataset['entries']).' category entries, total '.$sum."\n";
