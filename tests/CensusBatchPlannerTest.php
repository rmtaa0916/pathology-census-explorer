<?php
declare(strict_types=1);
require_once __DIR__.'/../src/CensusData.php';
require_once __DIR__.'/../src/CensusBatchPlanner.php';
$rows=CensusData::mockRows();
$formulas=array_map(static fn(int $row):array=>['=H'.$row.'*I'.$row],range(5,796));
function must(bool $condition,string $message):void {
    if(!$condition)throw new RuntimeException('CensusBatchPlanner: '.$message);
}
function sourceValues(array $row):array {
    return ['test'=>$row[3],'patientGroup'=>$row[4],'billing'=>$row[5],
      'priority'=>$row[6],'count'=>$row[7],'rate'=>(float)$row[8]];
}
function editRow(array $rows,int $row,array $overrides):array {
    $source=$rows[$row-4];
    $original=sourceValues($source);
    return ['sheetRow'=>$row,'period'=>$source[0],'expected'=>$original,
      'values'=>array_replace($original,$overrides)];
}
$one=editRow($rows,5,['count'=>11,'rate'=>123.45]);
$two=editRow($rows,7,['count'=>9]);
$plan=CensusBatchPlanner::plan($rows,$formulas,[$one,$two],2066158630);
must($plan['updatedCount']===2,'batch count');
must($plan['rows']===[5,7],'row identity');
must(count($plan['requests'])===2,'two requests in one Sheets API call');
$first=$plan['requests'][0]['updateCells'];
must($first['range']===[
 'sheetId'=>2066158630,'startRowIndex'=>4,'endRowIndex'=>5,
 'startColumnIndex'=>3,'endColumnIndex'=>9
],'D:I only');
must($first['fields']==='userEnteredValue','field mask only values');
must($first['rows'][0]['values'][4]['userEnteredValue']['numberValue']===11,'count correct');
must($first['rows'][0]['values'][5]['userEnteredValue']['numberValue']===123.45,'rate correct');
$bad=editRow($rows,5,['count'=>99]);$bad['expected']['count']=100;
try{CensusBatchPlanner::plan($rows,$formulas,[$bad],2066158630);throw new RuntimeException('stale accepted');}
catch(RuntimeException $e){must(str_contains($e->getMessage(),'changed'),'stale blocked');}
try{CensusBatchPlanner::plan($rows,$formulas,[$one,$one],2066158630);throw new RuntimeException('duplicate row accepted');}
catch(InvalidArgumentException $e){must(str_contains($e->getMessage(),'more than once'),'duplicate row blocked');}
try{CensusBatchPlanner::plan($rows,$formulas,[editRow($rows,5,['rate'=>123.456])],2066158630);throw new RuntimeException('fractional rate accepted');}
catch(InvalidArgumentException $e){must(str_contains($e->getMessage(),'Invalid'),'rate blocked');}
try{CensusBatchPlanner::plan($rows,$formulas,[editRow($rows,5,['test'=>'=HYPERLINK(1)'])],2066158630);throw new RuntimeException('formula injection accepted');}
catch(InvalidArgumentException $e){must(str_contains($e->getMessage(),'Invalid'),'text formula blocked');}
$wrong=$formulas;$wrong[0][0]='=SUM(H5:I5)';
try{CensusBatchPlanner::plan($rows,$wrong,[$one],2066158630);throw new RuntimeException('changed formula accepted');}
catch(RuntimeException $e){must(str_contains($e->getMessage(),'changed amount formula'),'formula blocked');}
$collision=editRow($rows,5,sourceValues($rows[2]));
try{CensusBatchPlanner::plan($rows,$formulas,[$collision],2066158630);throw new RuntimeException('duplicate category accepted');}
catch(RuntimeException $e){must(str_contains($e->getMessage(),'duplicate'),'collision blocked');}
$a=editRow($rows,5,sourceValues($rows[2]));
$b=editRow($rows,6,sourceValues($rows[1]));
$swap=CensusBatchPlanner::plan($rows,$formulas,[$a,$b],2066158630);
must($swap['updatedCount']===2,'swap accepted');
$wrongHeaders=$rows;$wrongHeaders[0][7]='Extra column';
try{CensusBatchPlanner::plan($wrongHeaders,$formulas,[$one],2066158630);throw new RuntimeException('column shift accepted');}
catch(RuntimeException $e){must(str_contains($e->getMessage(),'headings changed'),'header check');}
echo "CensusBatchPlanner tests passed: atomic request planning, stale/formula protection, swaps, and input checks\n";
