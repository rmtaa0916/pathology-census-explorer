<?php
declare(strict_types=1);
require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/ReportBuilder.php';
appAuthenticate();
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

function rh(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function rn(int|float $value): string { return number_format((float)$value, 0, '.', ','); }
function rm(int|float $value): string { return '₱' . number_format((float)$value, 2, '.', ','); }
function requestString(array $source, string $key): string {
    return isset($source[$key]) && is_string($source[$key]) ? trim($source[$key]) : '';
}
function signatureDate(string $input): ?string {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $input)) return null;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $input, new DateTimeZone('Asia/Manila'));
    if (!$date || $date->format('Y-m-d') !== $input) return null;
    return $date->format('F j, Y');
}
function validSigner(array $s): bool {
    return strlen($s['name']) <= 240 && strlen($s['position']) <= 240
        && $s['name'] !== '' && $s['position'] !== ''
        && !preg_match('/[\x00-\x1f\x7f]/', $s['name'] . $s['position'])
        && signatureDate($s['date']) !== null;
}
function reportPeriodLabel(array $report): string {
    $start = $report['dateStart'];
    $end = $report['dateEnd'];
    if (substr($start, 0, 7) === substr($end, 0, 7)) {
        $month = (new DateTimeImmutable($start))->format('F');
        return $month . ' ' . (int)substr($start, -2) . '–' . (int)substr($end, -2) . ', ' . substr($end, 0, 4);
    }
    return $start . ' to ' . $end;
}
function reportTable(string $heading, string $categoryLabel, array $rows, bool $amounts): void {
    $count = array_sum(array_column($rows, 'count'));
    $sum = array_sum(array_column($rows, 'amount'));
    echo '<section class="report-section"><h2>' . rh($heading) . '</h2>';
    echo '<table><thead><tr><th>' . rh($categoryLabel) . '</th><th class="numeric">Number of examinations</th>';
    if ($amounts) echo '<th class="numeric">Calculated amount (PHP)</th>';
    echo '</tr></thead><tbody>';
    foreach ($rows as $row) {
        echo '<tr><td>' . rh((string)$row['label']) . '</td><td class="numeric">' . rn($row['count']) . '</td>';
        if ($amounts) echo '<td class="numeric">' . rm($row['amount']) . '</td>';
        echo '</tr>';
    }
    echo '<tr class="report-total-row"><td><b>Total</b></td><td class="numeric"><b>' . rn($count) . '</b></td>';
    if ($amounts) echo '<td class="numeric"><b>' . rm($sum) . '</b></td>';
    echo '</tr></tbody></table></section>';
}
function renderSigner(string $label, array $signer): void {
    echo '<div class="signer"><p class="signer-caption">' . rh($label) . ':</p>';
    echo '<div class="signature-line" aria-label="Signature line"></div>';
    echo '<strong class="signer-name">' . rh($signer['name']) . '</strong>';
    echo '<div class="signer-position">' . rh($signer['position']) . '</div>';
    echo '<div class="signer-date">' . rh(signatureDate($signer['date']) ?? '') . '</div></div>';
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? $_POST : $_GET;
$period = requestString($input, 'period') ?: 'all';
$appendix = requestString($input, 'detail') === '1';
$amounts = requestString($input, 'amounts') === '1';
$secondRole = requestString($input, 'second_role') ?: 'Noted by';
$roles = ['Noted by', 'Reviewed by', 'Approved by'];
$signers = [
    'prepared' => [
        'name' => requestString($input, 'prepared_name'),
        'position' => requestString($input, 'prepared_position'),
        'date' => requestString($input, 'prepared_date')
    ],
    'noted' => [
        'name' => requestString($input, 'noted_name'),
        'position' => requestString($input, 'noted_position'),
        'date' => requestString($input, 'noted_date')
    ],
];
if ($period !== 'all' && !in_array($period, ['0', '1', '2', '3'], true)) {
    http_response_code(400);
    exit('Invalid reporting period.');
}
$ready = $method === 'POST' && in_array($secondRole, $roles, true)
    && validSigner($signers['prepared']) && validSigner($signers['noted']);
$report = null;
if ($ready) {
    try {
        $report = ReportBuilder::build(fetchDataset(), $period, $appendix);
    } catch (Throwable $error) {
        http_response_code(503);
        exit('Unable to generate report. Check the configured source.');
    }
}
$brand = require __DIR__ . '/../src/LcpBrandAssets.php';
date_default_timezone_set('Asia/Manila');
$preparedOn = date('F j, Y');
?>
<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>LCP Immunology Laboratory Census<?= $report ? ' — ' . rh(reportPeriodLabel($report)) : '' ?></title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}
html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;font-size:12px;background:#edf2f5;color:#111}
button,input,select{font:inherit}
.toolbar{max-width:210mm;margin:16px auto 12px;padding:12px 16px;background:white;border:1px solid #d8e3ea;border-radius:9px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.toolbar strong{font-size:13px}.toolbar small{display:block;margin-top:3px}
.toolbar-actions{display:flex;gap:8px;flex-wrap:wrap}
.toolbar a,.toolbar button,.return-btn{background:#155e8c;color:white;border:0;border-radius:6px;padding:11px 14px;text-decoration:none;cursor:pointer}
.toolbar a{color:#155e8c;background:#ecf4f8}
.setup{max-width:600px;margin:35px auto;background:white;padding:28px;border:1px solid #dbe7ed;border-radius:8px}
.setup h1{font-size:20px}.setup p{font-size:13px;line-height:1.5}
.setup label{font-weight:700;font-size:12px;display:flex;flex-direction:column;gap:5px;margin:12px 0}
.setup input,.setup select{border:1px solid #c7d5db;border-radius:6px;padding:10px;width:100%}
.setup .cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}.setup fieldset{border:1px solid #d6e1e5;min-width:0;border-radius:7px}
.setup legend{font-weight:700}.setup .checks label{font-weight:400;display:flex;align-items:center;flex-direction:row}
.setup .checks input{width:auto}
.setup button{background:#155e8c;border:0;color:white;border-radius:6px;padding:12px 18px;cursor:pointer}
.report-paper{width:210mm;min-height:297mm;max-width:100%;margin:0 auto 25px;background:white;position:relative;isolation:isolate;padding:47mm 16mm 46mm;box-shadow:0 5px 22px #142c3e1b;font:400 10pt/1.05 Arial,Helvetica,sans-serif;color:#000}
.report-paper *:not(img){color:#000!important;text-shadow:none!important;opacity:1}
.report-stationery{position:absolute;top:0;left:0;width:100%;height:297mm;object-fit:fill;z-index:0;pointer-events:none}
.report-content{position:relative;z-index:1}
.report-department{font-size:10pt;font-weight:700;margin-bottom:7px}
.report-paper h1{font-size:12pt;font-weight:700;line-height:1.15;letter-spacing:0;margin:0 0 7px}
.report-meta{display:flex;gap:8px 13px;flex-wrap:wrap;border-bottom:1px solid #000;padding:7px 0 10px;font-size:9.5pt;line-height:1.1}
.report-section{margin:0 0 12px}.report-section h2{font-size:10pt;font-weight:700;text-transform:none;letter-spacing:0;border-bottom:1px solid #000;margin:14px 0 6px;padding-bottom:4px;break-after:avoid}
.report-paper table{width:100%;max-width:100%;border-collapse:collapse;table-layout:auto;font:400 9.5pt/1.1 Arial,Helvetica,sans-serif;border:1px solid #888}
.report-paper th,.report-paper td{border:1px solid #aaa;padding:5px 7px;text-align:left;vertical-align:top;background:white;overflow-wrap:anywhere}
.report-paper th{font-weight:700;border-color:#888}
.report-paper .numeric{text-align:right;white-space:nowrap}
.report-total-row td{font-weight:700;border-top:1.3px solid #000}
.report-footnote{font-size:9.5pt;line-height:1.15;margin:8px 0 0}
.report-summary{margin-top:13px}.report-summary table td:first-child{width:77%}
.report-appendix{break-before:page;page-break-before:always}
.report-appendix table{table-layout:fixed}
.report-paper tr{break-inside:avoid;page-break-inside:avoid}
.report-paper thead{display:table-header-group}
.report-signatures{padding-top:12px;break-inside:avoid}
.sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:25px;margin:20px 0 4px}
.signer-caption{font-size:10pt;margin:0 0 42px}
.signature-line{height:1px;border-bottom:1px solid #000}
.signer-name{display:block;margin:9px 0 2px;font-size:10pt;font-weight:700}
.signer-position,.signer-date{font-size:10pt;line-height:1.15;margin-top:3px}
.demo-indicator{padding:9px 10px;border:1px solid #444;font-weight:700;font-size:10pt;margin-bottom:9px;color:#000}
.report-page-counter{font-family:Arial,Helvetica,sans-serif;color:#000;text-align:center;margin:0 0 5px}
@media screen{
 #reportPaper{display:none!important}
 .report-sheets{width:max-content;display:flex;flex-direction:column;align-items:center;gap:18px;margin:0 auto 18px}
 .report-paper.report-screen-sheet{display:block!important;box-sizing:border-box;flex:none;width:210mm!important;max-width:none!important;height:297mm!important;min-height:297mm!important;padding:47mm 16mm 46mm!important;margin:0!important;overflow:hidden!important;position:relative;isolation:isolate;background:#fff}
 .report-paper.report-screen-sheet>.report-stationery{display:block;position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;filter:none!important}
 .report-paper.report-screen-sheet>.report-content{position:relative;z-index:1;height:100%;width:100%;overflow:hidden;box-sizing:border-box}
 .report-paper.report-screen-sheet .report-appendix{break-before:auto;page-break-before:auto}
}
@media(max-width:650px){.toolbar{margin:0;border-radius:0}.setup{margin:0}.setup .cols{grid-template-columns:1fr}}
@page{size:A4 portrait;margin:47mm 16mm 46mm}
@media print{
 html,body{background:white;print-color-adjust:exact;-webkit-print-color-adjust:exact}
 .toolbar,.report-sheets,.report-page-counter{display:none!important}
 #reportPaper{display:block!important}
 .report-paper{width:auto;max-width:none;min-height:0;margin:0;padding:0;box-shadow:none;position:static;isolation:auto;background:transparent;overflow:visible}
 .report-stationery{display:none!important}
 .report-content{position:static;z-index:auto}
 .report-section:has(tr:nth-child(7)){break-inside:auto}
 .report-section:not(:has(tr:nth-child(7))){break-inside:avoid}
 .report-paper tr{break-inside:avoid}
}
</style></head><body>
<?php if (!$ready || !$report): ?>
<main class="setup">
<h1>Immunology laboratory census</h1>
<p>Complete both signatories to generate an A4 report. Names, positions and dates appear on the finished document.</p>
<?php if ($method === 'POST'): ?><p role="alert">Please enter a valid name, position and date for each signatory.</p><?php endif ?>
<form action="report.php" method="post">
<label>Reporting period<select name="period">
<?php foreach ([['id'=>'all','label'=>'December 1–31, 2023'], ...ReportBuilder::PERIODS] as $option): ?>
<option value="<?=rh($option['id'])?>" <?=$period===$option['id']?'selected':''?>><?=rh($option['label'])?></option>
<?php endforeach ?>
</select></label>
<div class="checks">
<label><input name="detail" type="checkbox" value="1" <?=$appendix?'checked':''?>> Include detailed examination appendix</label>
<label><input name="amounts" type="checkbox" value="1" <?=$amounts?'checked':''?>> Include calculated amounts</label>
</div>
<div class="cols">
<fieldset><legend>Prepared by</legend>
<?php foreach (['name'=>'Full name','position'=>'Position','date'=>'Date'] as $field=>$label): ?>
<label><?=$label?><input type="<?=$field==='date'?'date':'text'?>" name="prepared_<?=$field?>" maxlength="120" required value="<?=rh($signers['prepared'][$field])?>"></label>
<?php endforeach ?>
</fieldset>
<fieldset><legend>Second signatory</legend>
<label>Label<select name="second_role">
<?php foreach($roles as $role): ?><option value="<?=rh($role)?>" <?=$secondRole===$role?'selected':''?>><?=rh($role)?></option><?php endforeach ?>
</select></label>
<?php foreach (['name'=>'Full name','position'=>'Position','date'=>'Date'] as $field=>$label): ?>
<label><?=$label?><input type="<?=$field==='date'?'date':'text'?>" name="noted_<?=$field?>" maxlength="120" required value="<?=rh($signers['noted'][$field])?>"></label>
<?php endforeach ?>
</fieldset>
</div><button type="submit">Generate A4 report</button>
</form><p><a href="index.php">Back to Explorer</a></p>
</main>
<?php else: ?>
<nav class="toolbar" aria-label="Report actions">
 <div><strong>A4 laboratory census</strong><small><?=rh(reportPeriodLabel($report))?></small></div>
 <div class="toolbar-actions"><a href="index.php">Back to Explorer</a>
  <button type="button" id="printReport">Print / Save PDF</button></div>
</nav>
<main class="report-paper" id="reportPaper">
<img class="report-stationery" src="<?=rh($brand['letterhead'])?>" alt="LCP original-color letterhead">
<div class="report-content">
<div class="report-department">Pathology and Laboratory Medicine Department</div>
<h1>IMMUNOLOGY LABORATORY CENSUS</h1>
<div class="report-meta"><span><b>Reporting period:</b> <?=rh(reportPeriodLabel($report))?></span>
<span><b>Date prepared:</b> <?=rh($preparedOn)?></span></div>
<?php if ($report['sourceIsFixture']): ?><div class="demo-indicator">SAMPLE DATA ONLY</div><?php endif ?>
<section class="report-section report-summary">
<h2>Summary of examinations</h2>
<table><thead><tr><th>Indicator</th><th class="numeric">Number</th></tr></thead><tbody>
<tr class="report-total-row"><td>Total examinations</td><td class="numeric"><?=rn($report['totals']['examinations'])?></td></tr>
<tr><td>Patient examinations (inpatient and outpatient)</td><td class="numeric"><?=rn($report['totals']['patient'])?></td></tr>
<tr><td>Employee examinations (QFS)</td><td class="numeric"><?=rn($report['totals']['qfs'])?></td></tr>
</tbody></table>
<p class="report-footnote">Figures represent examinations, not individual patients.</p>
<?php if ($amounts): ?><p class="report-footnote"><b>Calculated amount:</b> <?=rm($report['totals']['amount'])?>. Based on recorded counts and unit rates, not payments received.</p><?php endif ?>
</section>
<?php if ($report['fullCoverage']) reportTable('Examinations by reporting interval', 'Reporting interval', $report['periodTotals'], $amounts); ?>
<?php reportTable('Examinations by patient group', 'Patient group', $report['groups'], $amounts); ?>
<?php reportTable('Examinations by billing classification', 'Billing classification', $report['billing'], $amounts); ?>
<?php reportTable('Examinations by priority', 'Priority', $report['priorities'], $amounts); ?>
<?php reportTable('Examinations by test', 'Examination', $report['examinations'], $amounts); ?>
<?php if ($appendix): ?>
<section class="report-section report-appendix">
<h2>Appendix A. Detailed examination census</h2>
<table class="report-appendix-table"><colgroup>
<?php if ($amounts): ?><col style="width:32%"><col style="width:19%"><col style="width:13%"><col style="width:13%"><col style="width:9%"><col style="width:14%">
<?php else: ?><col style="width:40%"><col style="width:22%"><col style="width:14%"><col style="width:14%"><col style="width:10%"><?php endif ?>
</colgroup><thead><tr><th>Examination</th><th>Patient group</th><th>Billing</th><th>Priority</th><th class="numeric">Number</th>
<?php if ($amounts): ?><th class="numeric">Calculated amount (PHP)</th><?php endif ?></tr></thead><tbody>
<?php foreach($report['categories'] as $row): ?><tr>
<td><?=rh($row['test'])?></td><td><?=rh($row['group'])?></td><td><?=rh($row['billing'])?></td><td><?=rh($row['priority'])?></td>
<td class="numeric"><?=rn($row['count'])?></td><?php if ($amounts): ?><td class="numeric"><?=rm($row['amount'])?></td><?php endif ?>
</tr><?php endforeach ?>
<tr class="report-total-row"><td><b>Total</b></td><td></td><td></td><td></td>
<td class="numeric"><b><?=rn($report['totals']['examinations'])?></b></td>
<?php if ($amounts): ?><td class="numeric"><b><?=rm($report['totals']['amount'])?></b></td><?php endif ?></tr>
</tbody></table></section>
<?php endif ?>
<section class="report-signatures" aria-label="Report signatories"><div class="sign-grid">
<?php renderSigner('Prepared by', $signers['prepared']); ?>
<?php renderSigner($secondRole, $signers['noted']); ?>
</div></section>
</div></main>
<script>
const letterheadData=<?=json_encode($brand['letterhead'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?>;
let printStationeryPromise=null;
function prepareStationery(){
 if(printStationeryPromise)return printStationeryPromise;
 printStationeryPromise=new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=794;canvas.height=1122;
    const painter=canvas.getContext('2d');if(!painter)throw Error('Canvas unavailable');
    painter.drawImage(image,0,0,794,1122);
    function crop(y,height){
     const piece=document.createElement('canvas');piece.width=794;piece.height=height;
     const c=piece.getContext('2d');if(!c)throw Error('Canvas unavailable');
     c.drawImage(canvas,0,y,794,height,0,0,794,height);return piece.toDataURL('image/png');
    }
    const top=crop(0,174),bottom=crop(952,170);
    let style=document.getElementById('reportPageStationeryStyle');
    if(!style){style=document.createElement('style');style.id='reportPageStationeryStyle';document.head.appendChild(style);}
    style.textContent='@page{size:A4 portrait;margin:47mm 16mm 46mm;'
      +'@top-center{content:url("'+top+'");margin-left:-16mm;margin-right:-16mm}'
      +'@bottom-center{content:url("'+bottom+'");margin-left:-16mm;margin-right:-16mm}}';
    resolve(true);
   }catch(e){printStationeryPromise=null;reject(e);}
  };
  image.onerror=()=>{printStationeryPromise=null;reject(Error('Unable to load LCP letterhead'));};
  image.src=letterheadData;
 });
 return printStationeryPromise;
}
function paginateReport(){
 const source=document.getElementById('reportPaper');
 const original=source.querySelector('.report-content');
 const sheets=document.createElement('div');sheets.className='report-sheets';
 source.parentNode.insertBefore(sheets,source);
 let body=null,count=0;
 function beginPage(){
  if(++count>200)throw Error('Too many pages');
  const page=document.createElement('article');page.className='report-paper report-screen-sheet';
  page.setAttribute('aria-label','Report page '+count);
  const image=document.createElement('img');image.className='report-stationery';image.src=letterheadData;
  image.alt='Original-color LCP letterhead, page '+count;
  body=document.createElement('div');body.className='report-content';
  page.append(image,body);sheets.appendChild(page);
 }
 function fits(){return body.scrollHeight<=body.clientHeight+2;}
 function append(block){
  if(!body)beginPage();body.append(block);
  if(!fits()){
   block.remove();if(!body.childElementCount)throw Error('Report section exceeds one page');
   beginPage();body.append(block);
   if(!fits())throw Error('Report section does not fit within an A4 page');
  }
 }
 function split(section){
  const table=section.querySelector(':scope > table');
  const tBody=table&&table.tBodies[0];
  if(!tBody){append(section.cloneNode(true));return;}
  const rows=Array.from(tBody.rows);
  const skeleton=section.cloneNode(true);skeleton.querySelector('table').tBodies[0].replaceChildren();
  let part=null,partBody=null;
  function fresh(continued){
   part=skeleton.cloneNode(true);partBody=part.querySelector('table').tBodies[0];
   if(continued){const heading=part.querySelector('h2');if(heading)heading.textContent+=' (continued)';}
   if(!body)beginPage();body.append(part);
   if(!fits()){
    part.remove();beginPage();body.append(part);
    if(!fits())throw Error('Report table heading cannot fit');
   }
  }
  fresh(false);
  for(const row of rows){
   const clone=row.cloneNode(true);partBody.append(clone);
   if(!fits()){
    clone.remove();
    if(!partBody.rows.length){part.remove();beginPage();fresh(false);}
    else {beginPage();fresh(true);}
    partBody.append(clone);if(!fits())throw Error('Report row too tall');
   }
  }
 }
 for(const element of Array.from(original.children)){
  if(element.classList&&element.classList.contains('report-appendix')&&body&&body.childElementCount)beginPage();
  if(element.querySelector(':scope > table'))split(element);
  else append(element.cloneNode(true));
 }
 const counter=document.createElement('p');counter.className='report-page-counter';
 counter.textContent=count+' A4 page'+(count===1?'':'s')+' · LCP letterhead repeated on every page';
 sheets.parentNode.insertBefore(counter,sheets);
 const scale=Math.min(1,Math.max(320,document.documentElement.clientWidth-32)/794);
 if(scale<1)sheets.style.zoom=String(scale);
 return count;
}
(async function initializeReport(){
 const button=document.getElementById('printReport');
 button.disabled=true;
 const error=document.createElement('p');error.style.cssText='max-width:210mm;margin:10px auto;color:#700';
 try{
  await prepareStationery();
  paginateReport();
  button.disabled=false;
  button.addEventListener('click',()=>window.print());
 }catch(e){
  error.textContent='Preview unavailable: '+String(e.message||e)+'; use the browser Print option to inspect the report.';
  document.body.insertBefore(error,document.getElementById('reportPaper'));
  button.disabled=false;
  button.addEventListener('click',()=>window.print());
 }
})();
</script>
<?php endif ?>
</body></html>