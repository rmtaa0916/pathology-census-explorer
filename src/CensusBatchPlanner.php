<?php
declare(strict_types=1);

/**
 * Pure-PHP planning/validation for multi-record changes in the configured
 * December 2023 working-copy Sheet. Makes no network calls.
 *
 * A caller must reread current source values/formulas before every batch.
 * The resulting Google Sheets spreadsheets.batchUpdate request is atomic.
 * Cross-client races between preflight read and write remain possible.
 */
final class CensusBatchPlanner
{
    public const PERIODS=['Dec 1–7','Dec 8–14','Dec 15–21','Dec 22–31'];
    public const HEADER=[
        'Period','Start date','End date','Examination','Patient group',
        'Billing','Priority','Test count','Example rate (₱)',
        'Demo amount (₱)','Data status'
    ];
    public const FIELDS=['test','patientGroup','billing','priority','count','rate'];
    public const FIRST_ROW=5;
    public const LAST_ROW=796;

    public static function plan(array $rows, array $formulas, array $changes, int $sheetId): array
    {
        $n=count($changes);
        if($n<1||$n>100)throw new InvalidArgumentException('Select 1 to 100 records to save.');
        if(count($rows)!==793||count($formulas)!==792||$sheetId<0) {
            throw new RuntimeException('The source range changed. Stop and review the worksheet layout.');
        }
        foreach(self::HEADER as $col=>$expectedHeader) {
            if(($rows[0][$col]??null)!==$expectedHeader)
                throw new RuntimeException('Column headings changed. Review the worksheet layout before saving.');
        }
        $selected=[];
        foreach($changes as $change) {
            if(!is_array($change)||!is_int($change['sheetRow']??null)||
               $change['sheetRow']<self::FIRST_ROW||$change['sheetRow']>self::LAST_ROW||
               !is_string($change['period']??null)||!in_array($change['period'],self::PERIODS,true)) {
                throw new InvalidArgumentException('Invalid batch row or reporting period.');
            }
            $row=$change['sheetRow'];
            if(isset($selected[$row]))throw new InvalidArgumentException('A source row appears more than once.');
            $expected=self::validatedInputs($change['expected']??null);
            $values=self::validatedInputs($change['values']??null);
            $source=$rows[$row-4]??[];
            if(($source[0]??null)!==$change['period']||
               !self::matchesRow($source,$expected)) {
                throw new RuntimeException('Row '.$row.' has changed. Refresh and review your pending edits.');
            }
            if(($formulas[$row-self::FIRST_ROW][0]??null)!=='=H'.$row.'*I'.$row) {
                throw new RuntimeException('Row '.$row.' contains a changed amount formula. No data was saved.');
            }
            $selected[$row]=['row'=>$row,'period'=>$change['period'],'values'=>$values];
        }
        // Verify proposed final identities across the complete December copy.
        $keys=[];
        for($row=self::FIRST_ROW;$row<=self::LAST_ROW;$row++){
            $source=$rows[$row-4]??[];
            $values=$selected[$row]['values']??self::sourceInputs($source);
            $key=json_encode([$source[0]??null,$values['test'],$values['patientGroup'],
              $values['billing'],$values['priority']],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
            if(isset($keys[$key]))throw new RuntimeException('Changes would produce duplicate examination/category records in one interval.');
            $keys[$key]=true;
        }
        ksort($selected,SORT_NUMERIC);
        $requests=[];
        foreach($selected as $entry) {
            $row=$entry['row'];
            $v=$entry['values'];
            $cellValues=[
                ['stringValue'=>$v['test']],['stringValue'=>$v['patientGroup']],
                ['stringValue'=>$v['billing']],['stringValue'=>$v['priority']],
                ['numberValue'=>$v['count']],['numberValue'=>$v['rate']]
            ];
            $requests[]=['updateCells'=>[
                'range'=>[
                    'sheetId'=>$sheetId,
                    'startRowIndex'=>$row-1,'endRowIndex'=>$row,
                    'startColumnIndex'=>3,'endColumnIndex'=>9,
                ],
                'rows'=>[['values'=>array_map(
                    static fn(array $cell):array=>['userEnteredValue'=>$cell],$cellValues)]],
                'fields'=>'userEnteredValue'
            ]];
        }
        return ['requests'=>$requests,'updatedCount'=>count($selected),
          'rows'=>array_keys($selected)];
    }

    private static function sourceInputs(array $row): array {
        return [
            'test'=>(string)($row[3]??''),'patientGroup'=>(string)($row[4]??''),
            'billing'=>(string)($row[5]??''),'priority'=>(string)($row[6]??''),
            'count'=>(int)($row[7]??-1),'rate'=>(float)($row[8]??-1)
        ];
    }
    private static function matchesRow(array $row, array $expected): bool {
        $actual=self::sourceInputs($row);
        foreach(['test','patientGroup','billing','priority'] as $k){
            if($actual[$k]!==$expected[$k])return false;
        }
        return $actual['count']===$expected['count']&&
            abs($actual['rate']-$expected['rate'])<0.000001;
    }
    private static function validatedInputs(mixed $input): array {
        if(!is_array($input))throw new InvalidArgumentException('Incomplete record values.');
        foreach(self::FIELDS as $name){
            if(!array_key_exists($name,$input))throw new InvalidArgumentException('Missing '.$name.'.');
        }
        $test=$input['test'];
        $count=$input['count'];
        $rate=$input['rate'];
        if(!is_string($test) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9 .()+\\/_-]{0,79}$/D',$test)||
           trim($test)!==$test||!is_int($count)||$count<0||$count>100000||
           !(is_int($rate)||is_float($rate))||!is_finite((float)$rate)||$rate<0||
           $rate>1000000||abs((float)$rate*100-round((float)$rate*100))>0.000001) {
            throw new InvalidArgumentException('Invalid examination, count or rate.');
        }
        foreach(['patientGroup','billing','priority'] as $k)if(!is_string($input[$k])){
            throw new InvalidArgumentException('Invalid category values.');
        }
        $g=$input['patientGroup'];$b=$input['billing'];$p=$input['priority'];
        $patient=in_array($g,['Inpatient','Outpatient'],true) &&
            in_array($b,['CHA','PAY'],true) && in_array($p,['STAT','ROUTINE'],true);
        $employee=$g==='Employee'&&$b==='QFS'&&$p==='QFS';
        if(!$patient&&!$employee)throw new InvalidArgumentException('Invalid patient group, billing or priority combination.');
        return ['test'=>$test,'patientGroup'=>$g,'billing'=>$b,
                'priority'=>$p,'count'=>$count,'rate'=>(float)$rate];
    }
}
