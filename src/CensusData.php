<?php
declare(strict_types=1);

final class CensusData
{
    private const TESTS = [
        'CRP','FERRITIN','PROCALCITONIN','INTERLEUKIN 6','DENGUE NS1 ANTIGEN',
        'DENGUE IgG / IgM','FT3','FT4','TSH','CEA','AFP','PSA','IGRA QUANTI FERON',
        'TPPA','HBsAg','ANTI-HCV','ANTI-HBS','ANTI-HAV IgM','ANTI-HBc TOTAL','ANTI HIV','CD4','SARS-CoV-2 Ag',
    ];
    private const PERIODS = ['Dec 1–7','Dec 8–14','Dec 15–21','Dec 22–31'];

    public static function mockRows(): array
    {
        // Entirely synthetic data: intentionally NOT copied from the actual laboratory census.
        $rows = [['Period','Start date','End date','Examination','Patient group','Billing','Priority','Test count','Example rate (₱)','Demo amount (₱)','Data status']];
        $ranges = [['2023-12-01','2023-12-07'],['2023-12-08','2023-12-14'],['2023-12-15','2023-12-21'],['2023-12-22','2023-12-31']];
        foreach (self::PERIODS as $w => $period) {
            foreach (self::TESTS as $i => $test) {
                foreach ([['Inpatient','CHA'],['Inpatient','PAY'],['Outpatient','CHA'],['Outpatient','PAY'],['Employee','QFS']] as $g => $cat) {
                    foreach ($g === 4 ? ['QFS'] : ['STAT','ROUTINE'] as $p => $priority) {
                        $seed = ($i * 17 + $w * 11 + $g * 7 + $p * 5) % 31;
                        $n = ($seed <= 8) ? 0 : (int)ceil(($seed-8) / 6);
                        if ($i === 2) $n *= 4;
                        $rate = 900 + 175 * ($i % 9) + 85 * $g;
                        $rows[] = [$period,$ranges[$w][0],$ranges[$w][1],$test,$cat[0],$cat[1],$priority,$n,$rate,$n*$rate,'SYNTHETIC / DEMO'];
                    }
                }
            }
        }
        return $rows;
    }

    public static function fromSheetRows(array $rows, ?string $spreadsheetId = null, bool $isDemo = true): array
    {
        $entries = [];
        $periods = array_flip(self::PERIODS);
        $categories = [];
        foreach ($rows as $idx => $row) {
            if ($idx === 0 && ($row[0] ?? '') === 'Period') continue;
            $period = (string)($row[0] ?? '');
            $test = trim((string)($row[3] ?? ''));
            $group = strtolower(trim((string)($row[4] ?? '')));
            $payer = strtoupper(trim((string)($row[5] ?? '')));
            $priority = strtoupper(trim((string)($row[6] ?? '')));
            $status = trim((string)($row[10] ?? ''));
            if (!isset($periods[$period]) || $test === '' || !in_array($group, ['inpatient','outpatient','employee'], true)) continue;
            if (!in_array($payer,['CHA','PAY','QFS'],true) || !in_array($priority,['STAT','ROUTINE','QFS'],true)) continue;
            if ($isDemo && $status !== 'SYNTHETIC / DEMO') continue;
            $volume = (int)($row[7] ?? 0);
            $amount = (float)($row[9] ?? 0);
            if ($volume < 0 || !is_finite($amount) || $amount < 0) continue;
            $section = $group === 'employee' ? 'operational' : $group;
            $channel = $payer . ' ' . ($priority === 'QFS' ? 'QFS' : ucfirst(strtolower($priority)));
            $key = implode('|',[$test,$section,$channel]);
            if (!isset($entries[$key])) {
                $entries[$key] = ['test'=>$test,'source_test'=>$test,'section'=>$section,'channel'=>$channel,
                    'volume'=>0,'reported_income'=>0,'unit_rate'=>0,'weeks'=>[0,0,0,0],
                    'source_row'=>0,'source_rows'=>[null,null,null,null],'source_sheet'=>'DEMO - Weekly Census','payer'=>$payer,
                    'priority'=>ucfirst(strtolower($priority))];
            }
            $entries[$key]['volume'] += $volume;
            $entries[$key]['reported_income'] += $amount;
            $entries[$key]['weeks'][$periods[$period]] += $volume;
            $entries[$key]['source_rows'][$periods[$period]] = $idx + 4;
            $categories[$test] = true;
        }
        foreach ($entries as &$e) {
            if ($e['volume'] > 0) $e['unit_rate'] = $e['reported_income'] / $e['volume'];
        } unset($e);
        $exams = [];
        foreach (array_keys($categories) as $test) {
            $matches = array_values(array_filter($entries, fn($e)=>$e['test'] === $test));
            $sum = fn($field,$filter)=>array_reduce($matches, fn($acc,$e)=>$acc+($filter($e)?$e[$field]:0),0);
            $exams[] = [
                'test'=>$test,'volume'=>$sum('volume',fn($e)=>true),
                'reported_income'=>$sum('reported_income',fn($e)=>true),
                'patient_volume'=>$sum('volume',fn($e)=>$e['section']!=='operational'),
                'stat_volume'=>$sum('volume',fn($e)=>$e['priority']==='Stat'),
                'routine_volume'=>$sum('volume',fn($e)=>$e['priority']==='Routine'),
                'qfs_volume'=>$sum('volume',fn($e)=>$e['section']==='operational')
            ];
        }
        $sumExam = fn($key)=>array_reduce($exams,fn($acc,$e)=>$acc+$e[$key],0);
        return [
            'title'=>'Immunology Census — SYNTHETIC DEMO, December 2023',
            'source'=>[
                'file'=>'DEMO - Weekly Census','source_period'=>'2023-12','received_date'=>null,
                'google_sheets_url'=>$spreadsheetId?('https://docs.google.com/spreadsheets/d/'.$spreadsheetId.'/edit'):'#',
                'source_sheets'=>['DEMO - Weekly Census'], 'blank_sheets'=>[], 'is_demo'=>$isDemo,
            ],
            'exams'=>$exams,'entries'=>array_values($entries),'blood_processing'=>[],
            'cautions'=>[['severity'=>'low','title'=>'Synthetic records only',
                'description'=>'These values are for workflow testing and are not actual laboratory results.']],
            'summary_stats'=>[
                'total_volume'=>$sumExam('volume'), 'reported_income'=>$sumExam('reported_income'),
                'patient_volume'=>$sumExam('patient_volume'),'qfs_volume'=>$sumExam('qfs_volume'),
                'stat_volume'=>$sumExam('stat_volume'),'routine_volume'=>$sumExam('routine_volume'),
            ],
        ];
    }
}
