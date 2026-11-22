const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../Index.html'),'utf8');
const match=html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match,'Inline dashboard script exists');
assert.ok(html.includes('data-nav="records"'),'Source records in navigation');
assert.ok(html.includes('data-open-records'),'Quick edit link is present');
const rows=[
 {sheetRow:5,period:'Dec 1–7',test:'CRP',patientGroup:'Inpatient',billing:'CHA',priority:'STAT',count:2,rate:1110,amount:2220},
 {sheetRow:7,period:'Dec 1–7',test:'CRP',patientGroup:'Inpatient',billing:'PAY',priority:'STAT',count:2,rate:1214,amount:2428}
];
const dataset={
 summary_stats:{total_volume:4,patient_volume:4,qfs_volume:0,
   stat_volume:4,routine_volume:0,reported_income:4648},
 exams:[{test:'CRP',volume:4,patient_volume:4,stat_volume:4,routine_volume:0,qfs_volume:0,reported_income:4648}],
 entries:[{test:'CRP',section:'inpatient',channel:'CHA Stat',volume:2,reported_income:2220,weeks:[2,0,0,0],source_rows:[5,null,null,null],unit_rate:1110,payer:'CHA',priority:'Stat'},
 {test:'CRP',section:'inpatient',channel:'PAY Stat',volume:2,reported_income:2428,weeks:[2,0,0,0],source_rows:[7,null,null,null],unit_rate:1214,payer:'PAY',priority:'Stat'}],
 records:rows
};
const elements=new Map();
function get(id){
 if(!elements.has(id))elements.set(id,{
   innerHTML:'',value:'',classList:{add(){},remove(){},toggle(){}},
   addEventListener(){},getAttribute(){return 'data:image/webp;base64,TEST';},querySelector(){return null},querySelectorAll(){return []},
   insertAdjacentHTML(where,text){this.innerHTML=text+this.innerHTML}
 });
 return elements.get(id);
}
const sandbox={
 document:{getElementById:get,querySelector:()=>get('editLink'),
   querySelectorAll:()=>[],addEventListener(){}},
 window:{scrollTo(){},addEventListener(){}},console,
 confirm(){return true;},
 alert(){throw Error('Unexpected alert');},
 google:{script:{run:{}}},
};
const script=match[1].replace(/<\?!=\s*initialDataJson\s*\?>/,JSON.stringify(dataset));
new vm.Script(script,{filename:'Index.html script'});
vm.createContext(sandbox);
vm.runInContext(script,sandbox);
assert.ok(get('content').innerHTML.includes('Immunology census overview'));
vm.runInContext("showPage('records')",sandbox);
const editor=get('content').innerHTML;
assert.ok(editor.includes('Census record editor'));
assert.ok(editor.includes('data-record-edit="5"'));
assert.ok(editor.includes('data-record-edit="7"'));
assert.ok(editor.includes('₱1,214'));
assert.ok(editor.includes('Calculated amount'));
vm.runInContext("recordQuery='CRP';recordPeriod='Dec 8–14';render()",sandbox);
assert.ok(get('content').innerHTML.includes('No records match'));
vm.runInContext("recordPeriod='all';recordQuery='7';render()",sandbox);
assert.ok(get('content').innerHTML.includes('data-record-edit="7"'));
assert.ok(!get('content').innerHTML.includes('data-record-edit="5"'));
assert.ok(html.includes('role="group" aria-label="Dashboard actions"'),'Top actions are grouped');
assert.ok(html.includes('data-open-records>Edit records'),'Edit shortcut is prominent');
assert.ok(html.includes('data-open-reports>Generate report'),'Report shortcut is prominent');
assert.ok(!html.includes('Working copy of census data'),'Development disclaimer has been removed');
assert.ok(!html.includes('Connected · structure monitoring active'),'Developer source monitor copy has been removed');
assert.ok(!html.includes('data-nav="quality"'),'Audit section is not in published navigation');
assert.ok(html.includes('Census records</button>'),'Record navigation is titled for staff');
assert.ok(!html.includes('Working copy of census data'));
assert.ok(!html.includes('Google Sheets is connected.'));
assert.ok(!html.includes('interval-pill">Working copy'));
assert.ok(!html.includes('Source compatibility monitor'));
assert.ok(html.includes('@media screen and (max-width:680px)'),'Responsive action layout exists');
console.log('Frontend syntax and source-editor rendering checks passed');
// A visible popup must always show actual content and only actionable source rows.
const detail=vm.runInContext("examinationDrawerMarkup('CRP',0)",sandbox);
assert.ok(detail.includes('CRP')&&detail.includes('Records · Dec 1–7'));
assert.ok(detail.includes('data-drawer-edit-row="5"')&&detail.includes('data-drawer-edit-row="7"'));
assert.ok(detail.includes('id="drawerExamPeriod"'));
assert.ok(!detail.includes('data-drawer-edit-row=""'));
const noRows=vm.runInContext("examinationDrawerMarkup('CRP',1)",sandbox);
assert.ok(noRows.includes('No records for this interval.'),'Empty period shows an informative message');
assert.ok(!noRows.includes('data-drawer-edit-row'),'Empty period never offers a dead Edit inputs action');
const unknownExam=vm.runInContext("examinationDrawerMarkup('UNKNOWN',0)",sandbox);
assert.ok(unknownExam.includes('Details unavailable'),'Missing examination has visible fallback UI');
assert.ok(html.includes('drawer.innerHTML=\'\''),'Closed drawers clear old content');
assert.ok(html.includes('aria-hidden="true"'),'Hidden drawer is not exposed to screen readers');
console.log('Examination popup content, valid row actions and empty states passed');

vm.runInContext("staleDashboard=true;showPage('records')",sandbox);
assert.ok(get('content').innerHTML.includes('Data may have changed'));
vm.runInContext("staleDashboard=false;showPage('quality')",sandbox);
assert.ok(get('content').innerHTML.includes('Not verified'));
vm.runInContext("QUALITY={passed:false,findings:2,totalRecords:792,zeroCountRecords:12,checkedAt:'2026-11-21T00:00:00.000Z',checks:[{id:'formulas',title:'Source amount formulas',passed:false,discrepancies:2,explanation:'Two errors'},{id:'totals',title:'Dashboard-to-source reconciliation',passed:true,discrepancies:0,explanation:'Matched'}]};showPage('quality')",sandbox);
assert.ok(get('content').innerHTML.includes('2 issue(s)'));
assert.ok(get('content').innerHTML.includes('1 / 2'));
vm.runInContext("S.total_volume=0;S.patient_volume=0;S.qfs_volume=0;S.reported_income=0;ENTRIES.forEach(e=>{e.volume=0;e.reported_income=0;});breakouts=createBreakouts();showPage('overview');",sandbox);
assert.ok(!get('content').innerHTML.includes('NaN%'));
assert.ok(get('content').innerHTML.includes('No examination activity'));
assert.ok(get('content').innerHTML.includes('0.0%'));
vm.runInContext("tableSortDir='asc';EXAMS=[{test:'L',volume:20},{test:'S',volume:2}];tableQuery='';",sandbox);
const ascending=vm.runInContext('filteredExams().map(x=>x.test).join(",")',sandbox);
assert.equal(ascending,'S,L');
const dirty=vm.runInContext("(()=>{const original={test:'CRP',patientGroup:'Inpatient',billing:'CHA',priority:'STAT',count:2,rate:110};const values={...original};const form={elements:{namedItem:k=>({value:String(values[k])})}};const unchanged=formHasChanges(form,original);values.rate=111;return {unchanged,changed:formHasChanges(form,original)};})()",sandbox);
assert.equal(dirty.unchanged,false);
assert.equal(dirty.changed,true);
console.log('Frontend quality, zero-total, sorting, dirty-state and stale-status checks passed');

vm.runInContext("SOURCE={monitoringEnabled:false,needsReview:false,issues:[],checkedAt:'2026-11-21T00:00:00.000Z'};showPage('overview')",sandbox);
assert.ok(!get('content').innerHTML.includes('automatic alerts not configured'));
assert.ok(!html.includes('id="sourceSideHealth"'));
vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:false,issues:[],checkedAt:'2026-11-21T00:00:00.000Z'};showPage('quality')",sandbox);
assert.ok(!get('content').innerHTML.includes('structure monitoring active'));
assert.ok(!get('content').innerHTML.includes('Source compatibility monitor'));
vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:true,severity:'critical',issues:[{kind:'column_count',message:'New source column requires review'}],checkedAt:'2026-11-21T00:00:00.000Z'};showPage('records')",sandbox);
assert.ok(get('content').innerHTML.includes('Data requires attention'));
assert.ok(get('content').innerHTML.includes('New source column requires review'));
assert.ok(get('content').innerHTML.includes('data-check-source'));
console.log('Frontend monitored/unmonitored/review-required source-status checks passed');


vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:false,issues:[]};staleDashboard=false;recordQuery='';recordGroup='all';recordPeriod='all';showPage('records');const r=RECORDS[0];stageSourceRecord(r,{...recordValues(r),count:r.count+3})",sandbox);
assert.ok(get('content').innerHTML.includes('Census record editor'));
vm.runInContext("render()",sandbox);
assert.ok(get('content').innerHTML.includes('1 unsaved change staged'));
assert.ok(get('content').innerHTML.includes('data-batch-save'));
assert.ok(get('content').innerHTML.includes('UNSAVED'));
assert.ok(get('content').innerHTML.includes('Edit staged'));
assert.ok(get('content').innerHTML.includes('5</td>'));
assert.equal(vm.runInContext("stagedEdits.get(5).expected.count",sandbox),2);
assert.equal(vm.runInContext("stagedEdits.get(5).values.count",sandbox),5);
vm.runInContext("stageSourceRecord(RECORDS[1],{...recordValues(RECORDS[1]),rate:1320});render()",sandbox);
assert.ok(get('content').innerHTML.includes('2 unsaved changes staged'));
assert.equal(vm.runInContext("stagedEdits.size",sandbox),2);
vm.runInContext("stageSourceRecord(RECORDS[0],recordValues(RECORDS[0]));render()",sandbox);
assert.equal(vm.runInContext("stagedEdits.size",sandbox),1);
vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:true,issues:[{kind:'columns',message:'New column'}]};render()",sandbox);
assert.ok(get('content').innerHTML.includes('Save all (1)'));
assert.ok(get('content').innerHTML.includes('disabled'));
vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:false,issues:[]};stagedEdits.clear();render()",sandbox);
assert.equal(vm.runInContext("stagedEdits.size",sandbox),0);
assert.ok(html.includes('data:image/png;base64,'),'Standalone LCP emblem must be bundled for offline display');
assert.ok(html.includes('REPORT_LETTERHEAD_DATA_URL=\'data:image/png;base64,'),'Complete LCP report stationery must be bundled');
assert.ok(html.includes('Pathology and Laboratory Medicine Department'));
console.log('Batch staging, pending-row rendering, structural pause, and LCP branding tests passed');

const models=vm.runInContext("({full:reportAggregate(RECORDS,'all'),one:reportAggregate(RECORDS,'0'),empty:reportAggregate(RECORDS,'1')})",sandbox);
assert.equal(models.full.total.count,4);
assert.equal(models.full.total.amount,4648);
assert.equal(models.full.examinations[0].count,4);
assert.equal(models.full.periodLabel,'Full coverage · December 1–31, 2023');
assert.equal(models.full.intervals.length,4);
assert.equal(models.one.total.count,4);
assert.equal(models.empty.total.count,0);
assert.equal(models.one.rows,2);
assert.equal(models.full.categories.length,2);
assert.throws(()=>vm.runInContext("reportAggregate(RECORDS,'99')",sandbox),/Unknown reporting period/);

assert.equal(vm.runInContext("reportPdfFilename(reportAggregate(RECORDS,'all'))",sandbox),
  'LCP_Immunology_Census_2023-12-01_to_2023-12-31.pdf');
assert.equal(vm.runInContext("reportPdfFilename(reportAggregate(RECORDS,'0'))",sandbox),
  'LCP_Immunology_Census_2023-12-01_to_2023-12-07.pdf');
assert.equal(vm.runInContext("reportPdfFilename(reportAggregate(RECORDS,'3'))",sandbox),
  'LCP_Immunology_Census_2023-12-22_to_2023-12-31.pdf');
assert.throws(()=>vm.runInContext("reportPdfFilename({start:'2023-12-31',end:'2023-12-01'})",sandbox),/valid reporting period/);
sandbox.document.title='Pathology Census Explorer';
assert.equal(vm.runInContext("setReportPdfTitle(reportAggregate(RECORDS,'0'))",sandbox),
  'LCP_Immunology_Census_2023-12-01_to_2023-12-07.pdf');
assert.equal(sandbox.document.title,'LCP_Immunology_Census_2023-12-01_to_2023-12-07');
let printInvocations=0;
sandbox.window.print=()=>{printInvocations++};
vm.runInContext("printCurrentReport()",sandbox);
assert.equal(printInvocations,1,'Print continues to use the native PDF dialog');
vm.runInContext("restoreReportPageTitle()",sandbox);
assert.equal(sandbox.document.title,'Pathology Census Explorer','Original tab title restored');
assert.equal(vm.runInContext("activeReportPdfName",sandbox),'');
console.log('Period-based PDF filename and print-title restoration checks passed');

vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:false,issues:[]};reportPeriod='all';stagedEdits.clear();staleDashboard=false;batchState='ready';showPage('reports')",sandbox);
const setup=get('content').innerHTML;
assert.ok(setup.includes('A4 formal census reports'));
assert.ok(setup.includes('Full coverage'));
assert.ok(setup.includes('data-report-generate'));
assert.ok(setup.includes('Include detailed appendix'));
assert.ok(setup.includes('id="reportAmounts"'),'Financial figures are independently optional');
assert.ok(!setup.includes('Source:</b> The connected Google Sheets working copy'),'Report setup avoids source implementation jargon');
assert.equal(vm.runInContext('reportAmounts',sandbox),false,'Financial figures default to off');
assert.ok(setup.includes('id="report-prepared-name"'));
assert.ok(setup.includes('id="report-prepared-position"'));
assert.ok(setup.includes('id="report-prepared-date"'));
assert.ok(setup.includes('id="report-noted-name"'));
assert.ok(setup.includes('id="report-noted-position"'));
assert.ok(setup.includes('id="report-noted-date"'));
assert.ok(setup.includes('id="reportSecondRole"'));
assert.ok(setup.includes('data-report-generate disabled'),'Incomplete signatories block report generation');
assert.equal(vm.runInContext('reportSignatoriesReady()',sandbox),false);
assert.throws(()=>vm.runInContext("reportDocument(reportAggregate(RECORDS,'all'),true)",sandbox),/Complete both signatories/);
assert.equal(vm.runInContext("reportValidSignatureDate('2026-02-31')",sandbox),false);
vm.runInContext(`reportSignatories={
  prepared:{name:'Dr. Maria Santos',position:'Medical Technologist',date:'2026-11-21'},
  noted:{name:'Ana & Luis Reyes',position:'Head <Pathology>',date:'2026-11-22'}
}; reportSecondRole='Reviewed by';render();`,sandbox);
assert.equal(vm.runInContext('reportSignatoriesReady()',sandbox),true);
assert.ok(!get('content').innerHTML.includes('data-report-generate disabled'),'Completed signatories enable generation');
vm.runInContext("reportPeriod='0';render()",sandbox);
assert.ok(get('content').innerHTML.includes('Dec 1–7'));
const printed=vm.runInContext("reportDocument(reportAggregate(RECORDS,'all'),true)",sandbox);
assert.ok(printed.includes('IMMUNOLOGY LABORATORY CENSUS'));
assert.ok(printed.includes('LUNG CENTER OF THE PHILIPPINES'));
assert.ok(printed.includes('Pathology and Laboratory Medicine Department'));
assert.ok(printed.includes('December 1–31, 2023'));
assert.ok(printed.includes('id="reportFilename" readonly'),'Read-only suggested filename in PDF preview');
assert.ok(printed.includes('LCP_Immunology_Census_2023-12-01_to_2023-12-31.pdf'),
  'Preview filename reflects the full reporting month');
assert.ok(printed.includes('data-report-copy-filename'),'Manual filename copying is available');
assert.ok(html.includes("addEventListener('click',printCurrentReport)"),
  'Print action uses the current reporting-period title');
assert.ok(html.includes("addEventListener('click',copyReportPdfFilename)"),
  'Copy filename action is connected');

assert.ok(printed.includes('Appendix A.'));
assert.ok(!printed.includes('₱4,648.00'),'DOH-style census is count-only by default');
assert.ok(printed.includes('Prepared by:'));
assert.ok(printed.includes('Reviewed by:'));
assert.ok(!printed.includes('Noted by:'));
assert.ok(printed.includes('Dr. Maria Santos'));
assert.ok(printed.includes('Medical Technologist'));
assert.ok(printed.includes('Ana &amp; Luis Reyes'));
assert.ok(printed.includes('Head &lt;Pathology&gt;'));
assert.ok(printed.includes('2026'));
assert.ok(!printed.includes('Signature over printed name'));
assert.ok(!printed.includes('Name / position / date'));
assert.ok(printed.includes('report-stationery'));
assert.ok(!printed.includes('Generated from the connected working-copy spreadsheet.'));
assert.ok(printed.includes('Date prepared:'));
assert.ok(printed.includes('not individual patients'));
assert.ok(printed.includes('Summary of examinations'));
assert.ok(printed.includes('Examinations by reporting interval'));
assert.ok(printed.includes('Examinations by patient group'));
assert.ok(printed.includes('Examinations by test'));
assert.ok(printed.includes('class="report-total-row"'),'Table totals are clearly visible');
assert.ok(printed.includes('Appendix A. Detailed examination census'));
assert.ok(printed.includes('Number of examinations'));
assert.ok(!printed.includes('Source:</b>'));
assert.ok(!printed.includes('working copy')&&!printed.includes('working-copy'));
assert.ok(!printed.includes('For internal verification.'));
assert.ok(!printed.includes('This document is not an institutional approval'));
assert.ok(!printed.includes('Recheck after subsequent edits.'));
assert.ok(!printed.includes('Signatories</h2>'),'Signature names appear without a separate numbered section');
assert.ok(!printed.includes('Date: November'),'Signer dates do not have a Date prefix');
assert.ok(printed.includes('November 21, 2026'),'Signed dates remain printed');
const amountReport=vm.runInContext("reportDocument(reportAggregate(RECORDS,'all'),true,reportSignatories,reportSecondRole,true)",sandbox);
assert.ok(amountReport.includes('₱4,648.00'),'Opted-in financial values remain available');
assert.ok(amountReport.includes('Calculated amount (PHP)'),'Financial columns are properly labeled');
assert.ok(amountReport.includes('not payments received'),'Financial meaning is explicit');
const groupTable=vm.runInContext("reportCountTable('Groups',reportAggregate(RECORDS,'all').groups)",sandbox);
assert.ok(groupTable.includes('Total')&&groupTable.includes('>4<'),'Group totals reconcile');
assert.ok(html.includes('@page{size:A4 portrait'));
assert.ok(html.includes('.report-stationery{filter:none!important}'),'Full-color LCP stationery is preserved');
assert.ok(!html.includes('filter:grayscale('),'No grayscale conversion of institutional stationery');
assert.ok(!html.includes('position:fixed;top:-40mm'),'Old overlapping fixed-page artwork is removed');
assert.ok(html.includes('@page{size:A4 portrait;margin:18mm 16mm 20mm}'),'Continuation pages use compact print margins');
assert.ok(html.includes('@page:first{margin:47mm 16mm 46mm}'),'First page reserves stationery space');
assert.ok(html.includes('content:url("${top}")'),'Head artwork is inserted in first page margin');
assert.ok(html.includes('content:url("${bottom}")'),'Footer artwork is inserted in first page margin');
assert.ok(html.includes('margin-left:-16mm')&&html.includes('margin-right:-16mm'),'Full page width of original stationery');
assert.ok(html.includes('report-appendix-table'),'Appendix has a dedicated six-column table layout');
assert.ok(html.includes('paginateA4ScreenPreview(preview)'),'Report generation creates paginated on-screen sheets');
assert.ok(html.includes("'report-paper report-screen-sheet'+(pageCount===1?'':' report-screen-continuation')"),'Continuation pages use an appropriate A4 layout');
assert.ok(html.includes('pageBody.scrollHeight<=pageBody.clientHeight+2'),'Measured content never crosses the footer');
assert.ok(html.includes('rows=Array.from(body.rows)'),'Long tables are split by source row');
assert.ok(html.includes('partBody.appendChild(copy)'),'Each table row is copied to the next available page');
assert.ok(html.includes("child.classList?.contains('report-appendix')"),'Appendix begins on a new A4 page');
assert.ok(html.includes("if(pageCount===1)sheet.appendChild(stationery)"),'Only the first preview page includes stationery');
assert.ok(html.includes('#reportPreview #reportPaper{display:none!important}'),'Continuous report is hidden on screen');
assert.ok(html.includes('#reportPreview #reportPaper{display:block!important}'),'Continuous report remains printable');
assert.ok(printed.includes('<colgroup>'),'Appendix sets explicit column widths');
const noAppendix=vm.runInContext("reportDocument(reportAggregate(RECORDS,'all'),false)",sandbox);
assert.ok(!noAppendix.includes('Appendix A.'),'Unchecked checkbox excludes appendix');
assert.equal((printed.match(/<section class="report-appendix report-section">/g)||[]).length,1,'Checked checkbox includes one appendix');
const screenSetup=get('content').innerHTML;
assert.ok(screenSetup.includes('type="checkbox" id="reportDetail"'),'Appendix checkbox present');
assert.ok(html.includes('.report-paper *:not(img){color:#000!important'),'Formal report text is black');
assert.ok(html.includes('font-family:Arial,Helvetica,sans-serif!important;'),'Formal reports match Arial used in recent LCP letters');
assert.ok(html.includes('font-size:10pt!important;'),'Formal report body matches 10 pt letter body');
assert.ok(html.includes('line-height:1.05!important;'),'Formal reports match 105% letter line spacing');
assert.ok(html.includes('color:#000!important;opacity:1'),'All textual report elements render solid black');
assert.ok(html.includes('font-size:12pt;font-weight:700'),'Report title has restrained bold hierarchy');
assert.ok(html.includes('font-size:10pt;font-weight:700'),'Report headings and signatory names use 10 pt bold');
assert.ok(html.includes('text-transform:none;letter-spacing:0'),'No decorative all-caps section treatment');
assert.ok(!html.includes('report-page-counter'),'Page-count banner is excluded from the entire report');
assert.ok(!html.includes('Original-color LCP letterhead repeats on every page'),'Technical notice is absent');
assert.ok(html.includes('report-screen-continuation{padding:18mm 16mm 20mm!important}'),'Continuation sheets reserve only standard margins');
assert.ok(html.includes('.report-stationery{filter:none!important}'),'Original-color LCP letterhead remains unmodified');
assert.ok(html.includes('reportSecondRoleOptions'),'Second approval label is selectable');
console.log('Clean A4 report without page banner or repeated letterhead; optional appendix and signatories passed');
(async()=>{
  const originalGet=sandbox.document.getElementById;
  sandbox.document.getElementById=id=>id==='reportPageStationeryStyle'?null:originalGet(id);
  const appended=[];
  sandbox.document.head={appendChild(node){appended.push(node)}};
  const crops=[];
  sandbox.document.createElement=tag=>{
    if(tag==='style')return {id:'',textContent:''};
    if(tag!=='canvas')throw Error('Unexpected DOM tag '+tag);
    const canvas={
      width:0,height:0,
      getContext(){return {drawImage(...args){crops.push(args)}}},
      toDataURL(){return 'data:image/png;base64,'+(this.height===174?'HEAD':'FOOT')}
    };
    return canvas;
  };
  sandbox.Image=class{set src(value){assert.ok(value.startsWith('data:image/png;base64,'));this.onload()}};
  await vm.runInContext('prepareReportLetterheadPrint()',sandbox);
  assert.equal(appended.length,1,'Print margin sheet is installed in document head');
  const css=appended[0].textContent;
  assert.ok(css.includes('@page:first{'));
  assert.ok(css.includes('margin:47mm 16mm 46mm'));
  assert.ok(css.includes('@top-center')&&css.includes('@bottom-center'));
  assert.ok(css.includes('data:image/png;base64,HEAD')&&css.includes('data:image/png;base64,FOOT'));
  assert.equal(crops.length,3,'Prepare full A4, header and footer crops');
  assert.equal(crops[1][3],794,'Header width uses full A4 pixel size');
  assert.equal(crops[2][2],952,'Footer crop begins at expected image position');
  console.log('Printed full-color margin-box artwork prepared on first page, without background graphics');

  // The dashboard confirmations must remain controllable by touch and keyboard.
  const originalDialogGet=sandbox.document.getElementById;
  function testDialogNode(id){
    const handlers=new Map();
    const el={id,textContent:'',hidden:true,dataset:{},isConnected:true,children:[],
      classList:{add(){},remove(){}},
      addEventListener(type,fn){handlers.set(type,[...(handlers.get(type)||[]),fn])},
      removeEventListener(type,fn){handlers.set(type,(handlers.get(type)||[]).filter(f=>f!==fn))},
      fire(type,details={}){for(const fn of handlers.get(type)||[])fn({
        type,target:details.target||el,key:details.key,shiftKey:details.shiftKey,
        preventDefault(){this.prevented=true}
      })},
      focus(){sandbox.document.activeElement=el},
      replaceChildren(){el.children=[]},
      appendChild(child){el.children.push(child)},
      querySelector(){return null}
    };
    return el;
  }
  const ids=['appDialog','appDialogCancel','appDialogConfirm','appDialogTitle',
    'appDialogMessage','appDialogDetails'];
  const nodes=new Map(ids.map(id=>[id,testDialogNode(id)]));
  const overlay=nodes.get('appDialog');
  const panel=testDialogNode('panel');
  overlay.querySelector=selector=>{
    if(selector==='.app-dialog')return panel;
    return nodes.get(selector.slice(1));
  };
  sandbox.document.getElementById=id=>nodes.get(id)||originalDialogGet(id);
  sandbox.document.createElement=tag=>{
    assert.equal(tag,'li','Modal previews only append list items');
    return testDialogNode('list-item');
  };
  sandbox.document.body={classList:{add(){},remove(){}}};
  sandbox.document.activeElement=testDialogNode('trigger');
  const first=vm.runInContext("confirmAppAction({title:'Save changes?',message:'Confirm record updates.',confirmLabel:'Save changes',details:['Row 5 · CRP']})",sandbox);
  assert.equal(overlay.hidden,false);
  assert.equal(nodes.get('appDialogTitle').textContent,'Save changes?');
  assert.equal(nodes.get('appDialogDetails').children.length,1);
  assert.equal(nodes.get('appDialogDetails').children[0].textContent,'Row 5 · CRP');
  assert.equal(nodes.get('appDialogCancel').hidden,false);
  nodes.get('appDialogCancel').fire('click');
  assert.equal(await first,false,'Cancel does not authorize the write');
  assert.equal(overlay.hidden,true,'Dialog closes after cancellation');

  const second=vm.runInContext("confirmAppAction({title:'Save one record?',message:'Changes will be saved.',confirmLabel:'Save record'})",sandbox);
  nodes.get('appDialogConfirm').fire('click');
  assert.equal(await second,true,'Explicit confirm authorizes the write');

  const third=vm.runInContext("confirmAppAction({title:'Discard?',message:'Unsaved edits will be lost.',tone:'danger'})",sandbox);
  assert.equal(panel.dataset.tone,'danger');
  overlay.fire('keydown',{key:'Escape'});
  assert.equal(await third,false,'Escape safely cancels the destructive action');

  const info=vm.runInContext("notifyAppUser('Editing unavailable','Please refresh the dashboard.')",sandbox);
  assert.equal(nodes.get('appDialogCancel').hidden,true,'Information notices have one action');
  nodes.get('appDialogConfirm').fire('click');
  assert.equal(await info,true);
  assert.ok(html.includes('id="appDialog" class="app-dialog-overlay" hidden'));
  assert.ok(html.includes('aria-modal="true"'));
  assert.ok(!match[1].includes('confirm(')&&!match[1].includes('alert(')&&!match[1].includes('prompt('),'Native JavaScript dialogs are not used');
  console.log('Custom confirmation modal: cancel, save, Escape, info and record previews passed');

})().catch(error=>{console.error(error);process.exitCode=1});
