<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/ReportBuilder.php';
appAuthenticate();
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
$period = isset($_GET['period']) && is_string($_GET['period']) ? $_GET['period'] : 'all';
$appendix = ($_GET['detail'] ?? '') === '1';
try {
    $report = ReportBuilder::build(fetchDataset(), $period, $appendix);
} catch (InvalidArgumentException $ex) {
    http_response_code(400);
    exit('Invalid reporting period.');
} catch (Throwable $ex) {
    http_response_code(503);
    exit('Unable to generate report. Check the configured source.');
}
function rh(string $s): string {return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function rn(int|float $n): string {return number_format((float)$n,0,'.',',');}
function rm(int|float $n): string {return '₱'.number_format((float)$n,2,'.',',');}
date_default_timezone_set('Asia/Manila');
$generated = date('F j, Y · g:i A');
$logo = 'data:image/webp;base64,UklGRuoEAABXRUJQVlA4IN4EAABwGQCdASpoADgAPsFQoUwnpKMiLJF+GPAYCWYAyBim0JSgbH3Og+v4lIT2/fO6t6r/Vct8fi/tPNj9PPGHam3y/RvBlvgtVNWBNG8p2bMxc1t8MLne3d7n+9pLitmylHF8GqrgZMwJtJLlC4gEWqLJ4Cx+M5BkshX4aCJqAr4TwBjZe3aDQWI3BFgHPC9YJxEtpG8NG9aOzxcisEOTEMLvZtctBSFQ4F0OLuESm/uj7l4TBk9QikDknh4MVkQnpAQeNxPWNnWPXZIn+YwJooeOWMh/AAD+/pOMW/UnViKtrj4EbjQ4Api7b1GUMtFRPFhSymgjiu6CzxRp5ehShohK4v4Q+/e/3o+ekL2cLA868WxEjDTB9dZbHkLT2CeJisDSdLNqcnh7Oob4zOwhiNnKLT5Q1+7O8l/FKlIZMVynlbJ6ng/fYmFF/qf23S/HUcjq4WQVFLpsc/u0xaZLuT7k4CuowIDrDok4GOF0x2rI9GmYg1wTtl2Vq16LduJGYZG+na53DuzGtxaFTz3qdqYk9PcweJOjRrIqbFFbwRMq/j5zMCTAI+YapITdypDb56POSLXUSLentRAXd/Sa1R2rdBQFxeZ6oGxbM3HdtBvAtYjpeOqx3w+Vxb4Tkr7jbC/v8VV0kYi9rSOu8TwM8z8htB+hXQq+O673SrE5DLicuGfYXzaTM38KFLMQBNB+dcdPIa+HPUMh9ZsawgJ53vi8tBHjGsuH+zvrP9RjGciMrv00mfXEF3i8P3TEzdJtKGOdGkjZpbKVddWouLLSrvMiAUkPP/g5a3ymJLe8606gNJR/Sk+HtIinYexbUADg4P1gEoQG4AL2btSAHwuFZ/OroF8yMyf/pJ4ptqvwKFu+KohUlOzXGOvdAbtzokVMTe4KBuXO5Bj1aBZZFuGTGsu8PHk38DWvxR6aD+V4WIfSJ0x1YlCkDrWSHYLEmBta4bBPNOOJ3leSaL//3t9NAUbhU2P8tKSkEFv79Tq+kq6TMW4jkJBfZRaPi5E7G/NJyDTQh+P5KUmhnE0zmBaeImU0kJyMN3ZKgbXdLftn8OT5vagunspq+VqwdmUP+ZdXwfssh985tT1XxEA5bq/CanOqt8NQx8JY+B6WL5kErOP6UoPTzbkQumec2EGK9i1oXhJu79943aiPtpBAUq8y3CCA/eO62jnQlVlLqIp8tzjX4LK9o+kaWXPq3sh3xbFnHC0zHvTUnT1aKWux0OJMe3/V++wpHWN4arHzxkhgCEj25h20g1dhPwswUwZlMt1r9ZYA52fKh91mvw/eIxvmfGd7oFX8vxVXFvz4cbZWJTinJy3VA/34FD2ptey6TTJRNtedq41LRRBh5BHWP5A50aIjvN1uGYpn4RaGqP+SoX0XMErkm8v8wUHae/aON4R6090dRIVooCVfxtapLDbET71NycG4t513fl/4Cufa3BbbuLwWBnFSnqo0TcyWpO5lgZvVjafvyzB+g3/cu4inGIeq1j53DmE/vqNuCkNOkiRzJ+wB8l+AD/Og1bCKrLnpImdeyOpY75/5zB828EZj/ifOaOJYwWNKW1JAe9j40C1uWdmlMD5wozRQYqASy0agYV+P7yoW6SLTX93qfnS6kLetLQ/0A2yn6PnQwNK8lO2gc8j28MBIgt2v+OwBsQAA';
?>
<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LCP Immunology Census Report — <?=rh($report['periodLabel'])?></title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}
body{margin:0;background:#edf2f5;color:#1c303b;font:11px/1.45 Arial,Helvetica,sans-serif}
.toolbar{max-width:210mm;margin:17px auto 12px;padding:12px 16px;background:white;border:1px solid #d8e3ea;border-radius:9px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;box-shadow:0 3px 17px #10283d12}
.toolbar strong{font-size:13px}.toolbar small{display:block;color:#567082;margin-top:3px}
.toolbar-actions{display:flex;gap:8px;flex-wrap:wrap}.toolbar a,.toolbar button{font:700 12px Arial;background:#145b8d;color:white;border:0;border-radius:6px;padding:11px 14px;text-decoration:none;cursor:pointer}
.toolbar a{background:#e6eff5;color:#1d557a}
.paper{width:210mm;max-width:100%;min-height:297mm;margin:0 auto 25px;background:#fff;padding:16mm 15mm 18mm;box-shadow:0 6px 30px #18364a18}
.letterhead{display:flex;gap:13px;align-items:center;padding-bottom:15px;border-bottom:2px solid #2a699c}
.emblem{width:77px;height:67px;object-fit:contain;flex:0 0 auto}
.institution{font-size:14px;font-weight:800;letter-spacing:.025em;color:#164875}
.department{font-size:12px;font-weight:700;margin-top:3px;color:#274a64}
.address{color:#667987;font-size:10px;margin-top:4px}
.doc-label{font-size:9px;letter-spacing:.12em;font-weight:bold;color:#58758d;margin:23px 0 4px;text-transform:uppercase}
h1{font-size:19px;letter-spacing:.015em;margin:0 0 6px;color:#163f5f}
.subtitle{font-size:12px;font-weight:bold;color:#2f536e;margin:0 0 12px}
.meta{display:flex;gap:13px;flex-wrap:wrap;padding:9px 0 12px;border-bottom:1px solid #e2e9ee;color:#526575;font-size:10px}
.meta b{color:#214c68}
.notice{background:#f0f6fa;border-left:3px solid #5c90b5;padding:9px 11px;margin:15px 0;font-size:10px;color:#42617a}
.notice.warning{background:#fff7eb;border-color:#c08d41;color:#73562b}
h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#1e597d;margin:21px 0 8px;padding-bottom:6px;border-bottom:1px solid #dbe6ed}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
.metric{border:1px solid #dfe9ef;padding:11px 9px;background:#fafcfe;min-width:0}
.metric span{display:block;color:#6b8191;font-size:9px;line-height:1.4}
.metric strong{display:block;font-size:17px;color:#1b4f70;margin:4px 0 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
table{width:100%;border-collapse:collapse;font-size:10px;font-variant-numeric:tabular-nums}
th{background:#eaf2f7;color:#264d67;padding:7px 6px;border-bottom:1px solid #bfceda;font-weight:bold;text-align:left}
td{padding:6px 6px;border-bottom:1px solid #e9eef2;vertical-align:top}
tr:nth-child(even) td{background:#fcfdfe}tr{break-inside:avoid;page-break-inside:avoid}
thead{display:table-header-group}.numeric{text-align:right;white-space:nowrap}
.total td{border-top:1px solid #8fa9ba;background:#f0f6fa;font-weight:bold}
.section{break-inside:avoid-page;page-break-inside:avoid}
.source-note{font-size:9px;color:#6a7882;line-height:1.55;margin-top:16px}
.signoff{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin:37px 0 4px}
.signoff div{border-top:1px solid #536d7c;padding-top:7px;color:#5d7282;font-size:10px}
.footer-note{border-top:1px solid #dce7ed;font-size:9px;color:#708491;margin-top:22px;padding-top:11px;line-height:1.6}
.appendix{break-before:page;page-break-before:always}.appendix tr{break-inside:avoid}
@media(max-width:650px){.paper{width:100%;min-height:0;padding:20px 16px}.emblem{width:56px}.institution{font-size:12px}.department{font-size:10px}.grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.toolbar{margin:0;border-radius:0}}
@page{size:A4 portrait;margin:14mm 13mm 16mm}
@media print{
 html,body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}
 .toolbar{display:none!important}
 .paper{width:auto;max-width:none;min-height:0;margin:0;padding:0;box-shadow:none}
 .letterhead{padding-top:0}.metrics{grid-template-columns:repeat(3,1fr)}
 .grid{grid-template-columns:1fr 1fr;gap:13px}
 h1,h2{break-after:avoid;page-break-after:avoid}
 .section,.metric,.notice{break-inside:avoid}
 .appendix{break-before:page;page-break-before:always}
}
</style></head><body>
<nav class="toolbar" aria-label="Report controls">
 <div><strong>A4 report preview</strong><small><?=rh($report['periodLabel'])?> · source snapshot at generation</small></div>
 <div class="toolbar-actions">
  <a href="index.php">Back to Explorer</a>
  <button type="button" onclick="window.print()">Print / Save PDF</button>
 </div>
</nav>
<main class="paper">
<header class="letterhead">
 <img class="emblem" src="<?=rh($logo)?>" alt="Lung Center of the Philippines emblem">
 <div><div class="institution">LUNG CENTER OF THE PHILIPPINES</div>
 <div class="department">Pathology and Laboratory Medicine Department</div>
 <div class="address">Quezon Avenue Extension, Quezon City, Philippines 1100</div></div>
</header>
<div class="doc-label">Census and workload report · Immunology</div>
<h1>IMMUNOLOGY CENSUS REPORT</h1>
<p class="subtitle"><?=rh($report['periodLabel'])?></p>
<div class="meta">
 <span><b>Reporting coverage:</b> <?=rh($report['dateStart'])?> to <?=rh($report['dateEnd'])?></span>
 <span><b>Generated:</b> <?=rh($generated)?> (PHT)</span>
 <span><b>Source:</b> <?= $report['sourceIsFixture']?'Local preview fixture':'Connected Google Sheets working copy' ?></span>
</div>
<?php if ($report['sourceIsFixture']): ?>
<div class="notice warning"><strong>SAMPLE DATA ONLY.</strong> This local PHP preview uses generated fixture records and must not be represented as an official LCP report. Connect the approved working-copy spreadsheet to use its current values.</div>
<?php else: ?>
<div class="notice"><strong>For internal verification.</strong> Figures are derived from the connected census working copy as of generation. This report is not an institutional approval or certification; verify totals and obtain the appropriate signatories before official circulation.</div>
<?php endif; ?>
<section>
<h2>1. Executive summary</h2>
<div class="metrics">
 <div class="metric"><span>Total examinations</span><strong><?=rn($report['totals']['examinations'])?></strong></div>
 <div class="metric"><span>Patient-section examinations</span><strong><?=rn($report['totals']['patient'])?></strong></div>
 <div class="metric"><span>Employee / QFS examinations</span><strong><?=rn($report['totals']['qfs'])?></strong></div>
 <div class="metric"><span>STAT examinations</span><strong><?=rn($report['totals']['stat'])?></strong></div>
 <div class="metric"><span>Routine examinations</span><strong><?=rn($report['totals']['routine'])?></strong></div>
 <div class="metric"><span>Calculated amount</span><strong><?=rm($report['totals']['amount'])?></strong></div>
</div>
<p class="source-note">Examination counts represent recorded tests, not distinct patients. Calculated amounts are based on source count × rate, not confirmation of revenue collected.</p>
</section>
<?php if ($report['fullCoverage']): ?>
<section class="section">
<h2>2. Reporting interval comparison</h2>
<table><thead><tr><th>Period</th><th class="numeric">Examinations</th><th class="numeric">Calculated amount</th></tr></thead><tbody>
<?php foreach($report['periodTotals'] as $r): ?><tr><td><?=rh($r['label'])?>, 2023</td><td class="numeric"><?=rn($r['count'])?></td><td class="numeric"><?=rm($r['amount'])?></td></tr><?php endforeach; ?>
<tr class="total"><td>Full coverage</td><td class="numeric"><?=rn($report['totals']['examinations'])?></td><td class="numeric"><?=rm($report['totals']['amount'])?></td></tr>
</tbody></table><p class="source-note">Reporting intervals have different lengths and are not normalized per day.</p>
</section>
<?php endif; ?>
<div class="grid">
<section class="section"><h2><?= $report['fullCoverage']?'3':'2' ?>. Patient-group breakdown</h2>
<table><thead><tr><th>Patient group</th><th class="numeric">Count</th><th class="numeric">Amount</th></tr></thead><tbody>
<?php foreach($report['groups'] as $r): ?><tr><td><?=rh($r['label'])?></td><td class="numeric"><?=rn($r['count'])?></td><td class="numeric"><?=rm($r['amount'])?></td></tr><?php endforeach; ?>
</tbody></table></section>
<section class="section"><h2><?= $report['fullCoverage']?'4':'3' ?>. Billing and priority</h2>
<table><thead><tr><th>Billing</th><th class="numeric">Count</th><th class="numeric">Amount</th></tr></thead><tbody>
<?php foreach($report['billing'] as $r): ?><tr><td><?=rh($r['label'])?></td><td class="numeric"><?=rn($r['count'])?></td><td class="numeric"><?=rm($r['amount'])?></td></tr><?php endforeach; ?>
</tbody></table>
<table style="margin-top:13px"><thead><tr><th>Priority</th><th class="numeric">Count</th><th class="numeric">Amount</th></tr></thead><tbody>
<?php foreach($report['priorities'] as $r): ?><tr><td><?=rh($r['label'])?></td><td class="numeric"><?=rn($r['count'])?></td><td class="numeric"><?=rm($r['amount'])?></td></tr><?php endforeach; ?>
</tbody></table></section>
</div>
<section><h2><?= $report['fullCoverage']?'5':'4' ?>. Examination-level census</h2>
<table><thead><tr><th>Examination</th><th class="numeric">Count</th><th class="numeric">Calculated amount</th></tr></thead><tbody>
<?php foreach($report['examinations'] as $r): ?><tr><td><?=rh($r['label'])?></td><td class="numeric"><?=rn($r['count'])?></td><td class="numeric"><?=rm($r['amount'])?></td></tr><?php endforeach; ?>
<tr class="total"><td>Total</td><td class="numeric"><?=rn($report['totals']['examinations'])?></td><td class="numeric"><?=rm($report['totals']['amount'])?></td></tr>
</tbody></table></section>
<section class="section">
<h2><?= $report['fullCoverage']?'6':'5' ?>. Verification and sign-off</h2>
<p class="source-note">Prepared for review based on source records at the time shown above. Recheck the working copy for subsequent edits before using this report in an official submission.</p>
<div class="signoff"><div>Prepared by: Name / position / date</div><div>Reviewed by: Name / position / date</div></div>
</section>
<?php if ($report['appendix']): ?>
<section class="appendix">
<h2>Appendix A. Examination × patient group × billing × priority</h2>
<p class="source-note">Grouped categories for <?=rh($report['periodLabel'])?>. Zero counts are included where present in the source.</p>
<table><thead><tr><th>Examination</th><th>Group</th><th>Billing</th><th>Priority</th><th class="numeric">Count</th><th class="numeric">Amount</th></tr></thead><tbody>
<?php foreach ($report['categories'] as $r): ?><tr><td><?=rh($r['test'])?></td><td><?=rh($r['group'])?></td><td><?=rh($r['billing'])?></td><td><?=rh($r['priority'])?></td><td class="numeric"><?=rn($r['count'])?></td><td class="numeric"><?=rm($r['amount'])?></td></tr><?php endforeach; ?>
</tbody></table></section>
<?php endif; ?>
<footer class="footer-note">Lung Center of the Philippines · Pathology and Laboratory Medicine Department · Immunology Census<br>
Generated from <?= $report['sourceIsFixture']?'local sample data':'the connected working-copy spreadsheet' ?>. No patient names or patient identifiers are included.</footer>
</main></body></html>
