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
assert.ok(editor.includes('Source record editor'));
assert.ok(editor.includes('data-record-edit="5"'));
assert.ok(editor.includes('data-record-edit="7"'));
assert.ok(editor.includes('₱1,214'));
assert.ok(editor.includes('Calculated amount'));
vm.runInContext("recordQuery='CRP';recordPeriod='Dec 8–14';render()",sandbox);
assert.ok(get('content').innerHTML.includes('No records match'));
vm.runInContext("recordPeriod='all';recordQuery='7';render()",sandbox);
assert.ok(get('content').innerHTML.includes('data-record-edit="7"'));
assert.ok(!get('content').innerHTML.includes('data-record-edit="5"'));
console.log('Frontend syntax and source-editor rendering checks passed');
// A visible popup must always show actual content and only actionable source rows.
const detail=vm.runInContext("examinationDrawerMarkup('CRP',0)",sandbox);
assert.ok(detail.includes('CRP')&&detail.includes('Source records · Dec 1–7'));
assert.ok(detail.includes('data-drawer-edit-row="5"')&&detail.includes('data-drawer-edit-row="7"'));
assert.ok(detail.includes('id="drawerExamPeriod"'));
assert.ok(!detail.includes('data-drawer-edit-row=""'));
const noRows=vm.runInContext("examinationDrawerMarkup('CRP',1)",sandbox);
assert.ok(noRows.includes('No source records for this interval.'),'Empty period shows an informative message');
assert.ok(!noRows.includes('data-drawer-edit-row'),'Empty period never offers a dead Edit inputs action');
const unknownExam=vm.runInContext("examinationDrawerMarkup('UNKNOWN',0)",sandbox);
assert.ok(unknownExam.includes('Details unavailable'),'Missing examination has visible fallback UI');
assert.ok(html.includes('drawer.innerHTML=\'\''),'Closed drawers clear old content');
assert.ok(html.includes('aria-hidden="true"'),'Hidden drawer is not exposed to screen readers');
console.log('Examination popup content, valid row actions and empty states passed');

vm.runInContext("staleDashboard=true;showPage('records')",sandbox);
assert.ok(get('content').innerHTML.includes('changes not yet reflected'));
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
assert.ok(get('content').innerHTML.includes('automatic alerts not configured'));
assert.ok(get('sourceSideHealth').innerHTML.includes('Google Sheets'));
vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:false,issues:[],checkedAt:'2026-11-21T00:00:00.000Z'};showPage('quality')",sandbox);
assert.ok(get('content').innerHTML.includes('structure monitoring active'));
assert.ok(get('content').innerHTML.includes('Source compatibility monitor'));
vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:true,severity:'critical',issues:[{kind:'column_count',message:'New source column requires review'}],checkedAt:'2026-11-21T00:00:00.000Z'};showPage('records')",sandbox);
assert.ok(get('content').innerHTML.includes('Source change detected'));
assert.ok(get('content').innerHTML.includes('New source column requires review'));
assert.ok(get('content').innerHTML.includes('data-check-source'));
console.log('Frontend monitored/unmonitored/review-required source-status checks passed');


vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:false,issues:[]};staleDashboard=false;recordQuery='';recordGroup='all';recordPeriod='all';showPage('records');const r=RECORDS[0];stageSourceRecord(r,{...recordValues(r),count:r.count+3})",sandbox);
assert.ok(get('content').innerHTML.includes('Source record editor'));
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
vm.runInContext("SOURCE={monitoringEnabled:true,needsReview:false,issues:[]};reportPeriod='all';stagedEdits.clear();staleDashboard=false;batchState='ready';showPage('reports')",sandbox);
const setup=get('content').innerHTML;
assert.ok(setup.includes('A4 formal census reports'));
assert.ok(setup.includes('Full coverage'));
assert.ok(setup.includes('data-report-generate'));
assert.ok(setup.includes('Include full category-detail appendix'));
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
assert.ok(printed.includes('IMMUNOLOGY CENSUS REPORT'));
assert.ok(printed.includes('LUNG CENTER OF THE PHILIPPINES'));
assert.ok(printed.includes('Pathology and Laboratory Medicine Department'));
assert.ok(printed.includes('Full coverage'));
assert.ok(printed.includes('Appendix A.'));
assert.ok(printed.includes('₱4,648.00'));
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
assert.ok(printed.includes('Report date:'));
assert.ok(printed.includes('not distinct patients'));
assert.ok(html.includes('@page{size:A4 portrait'));
assert.ok(html.includes('.report-stationery{filter:none!important}'),'Full-color LCP stationery is preserved');
assert.ok(!html.includes('filter:grayscale('),'No grayscale conversion of institutional stationery');
assert.ok(!html.includes('position:fixed;top:-40mm'),'Old overlapping fixed-page artwork is removed');
assert.ok(html.includes('@page{size:A4 portrait;margin:47mm 16mm 46mm}'),'Safe printable area on every A4 page');
assert.ok(html.includes('content:url("${top}")'),'Head artwork repeats in top page margin');
assert.ok(html.includes('content:url("${bottom}")'),'Footer artwork repeats in bottom page margin');
assert.ok(html.includes('margin-left:-16mm')&&html.includes('margin-right:-16mm'),'Full page width of original stationery');
assert.ok(html.includes('report-appendix-table'),'Appendix has a dedicated six-column table layout');
assert.ok(html.includes('paginateA4ScreenPreview(preview)'),'Report generation creates paginated on-screen sheets');
assert.ok(html.includes('className=\'report-paper report-screen-sheet\''),'Every preview page is a separate A4 sheet');
assert.ok(html.includes('pageBody.scrollHeight<=pageBody.clientHeight+2'),'Measured content never crosses the footer');
assert.ok(html.includes('rows=Array.from(body.rows)'),'Long tables are split by source row');
assert.ok(html.includes('partBody.appendChild(copy)'),'Each table row is copied to the next available page');
assert.ok(html.includes("child.classList?.contains('report-appendix')"),'Appendix begins on a new A4 page');
assert.ok(html.includes('className=\'report-stationery\''),'Full-color stationery included in every preview page');
assert.ok(html.includes('#reportPreview #reportPaper{display:none!important}'),'Continuous report is hidden on screen');
assert.ok(html.includes('#reportPreview #reportPaper{display:block!important}'),'Continuous report remains printable');
assert.ok(printed.includes('<colgroup>'),'Appendix sets explicit column widths');
const noAppendix=vm.runInContext("reportDocument(reportAggregate(RECORDS,'all'),false)",sandbox);
assert.ok(!noAppendix.includes('Appendix A.'),'Unchecked checkbox excludes appendix');
assert.equal((printed.match(/<section class="report-appendix">/g)||[]).length,1,'Checked checkbox includes one appendix');
const screenSetup=get('content').innerHTML;
assert.ok(screenSetup.includes('type="checkbox" id="reportDetail"'),'Appendix checkbox present');
assert.ok(html.includes('.report-paper *:not(img){color:#000!important'),'Formal report text is black');
assert.ok(html.includes('reportSecondRoleOptions'),'Second approval label is selectable');
console.log('Black report fonts, original-color repeated letterhead, optional appendix and signatories passed');
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
  assert.ok(css.includes('margin:47mm 16mm 46mm'));
  assert.ok(css.includes('@top-center')&&css.includes('@bottom-center'));
  assert.ok(css.includes('data:image/png;base64,HEAD')&&css.includes('data:image/png;base64,FOOT'));
  assert.equal(crops.length,3,'Prepare full A4, header and footer crops');
  assert.equal(crops[1][3],794,'Header width uses full A4 pixel size');
  assert.equal(crops[2][2],952,'Footer crop begins at expected image position');
  console.log('Printed full-color margin-box artwork prepared on every page, without background graphics');
})().catch(error=>{console.error(error);process.exitCode=1});
