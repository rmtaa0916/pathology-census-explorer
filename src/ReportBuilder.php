<?php
declare(strict_types=1);

/**
 * Period-selectable report model shared by the authenticated PHP reporting page.
 * Aggregation is based on the source row records, not on month-wide totals.
 */
final class ReportBuilder
{
    public const PERIODS = [
        ['id'=>'0','label'=>'Dec 1–7','start'=>'2023-12-01','end'=>'2023-12-07'],
        ['id'=>'1','label'=>'Dec 8–14','start'=>'2023-12-08','end'=>'2023-12-14'],
        ['id'=>'2','label'=>'Dec 15–21','start'=>'2023-12-15','end'=>'2023-12-21'],
        ['id'=>'3','label'=>'Dec 22–31','start'=>'2023-12-22','end'=>'2023-12-31'],
    ];

    public static function build(array $dataset, string $periodId='all', bool $appendix=false): array
    {
        if ($periodId !== 'all' && !in_array($periodId,['0','1','2','3'],true)) {
            throw new InvalidArgumentException('Unknown reporting period.');
        }
        $period = $periodId === 'all' ? null : self::PERIODS[(int)$periodId];
        $rows = array_values(array_filter($dataset['records'] ?? [], static fn(array $r): bool =>
            $period === null || $r['period'] === $period['label']
        ));
        $totals = ['examinations'=>0,'amount'=>0.0,'patient'=>0,'stat'=>0,'routine'=>0,'qfs'=>0];
        $groups = [];
        $billing = [];
        $priorities = [];
        $periodTotals = [];
        $examinations = [];
        $categories = [];

        foreach (self::PERIODS as $p) {
            $periodTotals[$p['label']] = ['label'=>$p['label'],'count'=>0,'amount'=>0.0];
        }
        foreach ($rows as $r) {
            $count = (int)$r['count'];
            $amount = (float)$r['amount'];
            $group = (string)$r['patientGroup'];
            $payer = (string)$r['billing'];
            $priority = (string)$r['priority'];
            $test = (string)$r['test'];
            $totals['examinations'] += $count;
            $totals['amount'] += $amount;
            if ($group !== 'Employee') $totals['patient'] += $count;
            if ($priority === 'STAT') $totals['stat'] += $count;
            if ($priority === 'ROUTINE') $totals['routine'] += $count;
            if ($priority === 'QFS') $totals['qfs'] += $count;
            self::add($groups,$group,$count,$amount);
            self::add($billing,$payer,$count,$amount);
            self::add($priorities,$priority,$count,$amount);
            self::add($examinations,$test,$count,$amount);
            self::add($categories,$test.'||'.$group.'||'.$payer.'||'.$priority,$count,$amount,
                ['test'=>$test,'group'=>$group,'billing'=>$payer,'priority'=>$priority]);
            if (isset($periodTotals[$r['period']])) {
                $periodTotals[$r['period']]['count'] += $count;
                $periodTotals[$r['period']]['amount'] += $amount;
            }
        }
        ksort($examinations, SORT_NATURAL|SORT_FLAG_CASE);
        ksort($categories, SORT_NATURAL|SORT_FLAG_CASE);
        foreach ([$groups, $billing, $priorities] as &$map) {ksort($map,SORT_NATURAL|SORT_FLAG_CASE);}
        unset($map);
        return [
            'periodId'=>$periodId,
            'periodLabel'=>$period === null ? 'Full coverage · December 1–31, 2023'
                : $period['label'].', 2023',
            'dateStart'=>$period['start'] ?? '2023-12-01',
            'dateEnd'=>$period['end'] ?? '2023-12-31',
            'fullCoverage'=>$period===null,
            'appendix'=>$appendix,
            'sourceIsFixture'=>(bool)($dataset['source']['is_demo']??false),
            'sourceUrl'=>(string)($dataset['source']['google_sheets_url']??''),
            'rowsIncluded'=>count($rows),
            'totals'=>$totals,
            'groups'=>$groups,
            'billing'=>$billing,
            'priorities'=>$priorities,
            'periodTotals'=>array_values($periodTotals),
            'examinations'=>array_values($examinations),
            'categories'=>array_values($categories),
        ];
    }

    private static function add(array &$map, string $key, int $count, float $amount, array $details=[]): void
    {
        if (!isset($map[$key])) {
            $map[$key] = ['label'=>$key,'count'=>0,'amount'=>0.0] + $details;
        }
        $map[$key]['count'] += $count;
        $map[$key]['amount'] += $amount;
    }
}
