const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const php=(file,code)=>{
 if(code!==undefined)return execFileSync('php',['-r',code],{cwd:root,encoding:'utf8',maxBuffer:15_000_000});
 return execFileSync('php',[file],{cwd:root,encoding:'utf8',maxBuffer:15_000_000});
};
const output=php('public/index.php');
const inline=output.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inline,'PHP dashboard must render a browser JS script');
new vm.Script(inline[1],{filename:'PHP dashboard inline JS'});
const nodes=new Map();
function get(id){
 if(!nodes.has(id))nodes.set(id,{
  innerHTML:'',value:'',classList:{add(){},remove(){},toggle(){}},
  addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},
  insertAdjacentHTML(which,content){this.innerHTML=content+this.innerHTML}
 });
 return nodes.get(id);
}
const sandbox={
 console,document:{getElementById:get,querySelectorAll(){return[]},addEventListener(){}},
 window:{scrollTo(){},addEventListener(){}},
 location:{reload(){}},confirm(){return true},alert(){},fetch(){throw Error('Unexpected network call in local fixture');}
};
vm.createContext(sandbox);
vm.runInContext(inline[1],sandbox);
assert.ok(get('content').innerHTML.includes('Immunology census overview'));
vm.runInContext("showPage('reports')",sandbox);
assert.ok(get('content').innerHTML.includes('A4 formal census report'));
assert.ok(get('content').innerHTML.includes('Reporting period'));
assert.ok(get('content').innerHTML.includes('report.php'));
assert.ok(get('content').innerHTML.includes('method="post"'));
assert.ok(get('content').innerHTML.includes('Include full category-detail appendix'));
assert.ok(get('content').innerHTML.includes('id="reportAmounts"'));
assert.ok(get('content').innerHTML.includes('id="report-prepared-name"'));
assert.ok(get('content').innerHTML.includes('id="report-noted-date"'));
assert.ok(get('content').innerHTML.includes('data-report-submit disabled'));
assert.equal(vm.runInContext('reportSignersReady()',sandbox),false);
vm.runInContext(`Object.assign(reportSigners,{
  prepared:{name:'Dr. Maria Santos',position:'Medical Technologist',date:'2026-11-21'},
  noted:{name:'Ana & Luis Reyes',position:'Department Head',date:'2026-11-22'}
});reportSecondRole='Reviewed by';reportAmounts=true;render();`,sandbox);
assert.equal(vm.runInContext('reportSignersReady()',sandbox),true);
assert.ok(!get('content').innerHTML.includes('data-report-submit disabled'));
assert.ok(get('content').innerHTML.includes('id="reportAmounts" checked'));
assert.ok(get('content').innerHTML.includes('name="second_role"'));
assert.ok(get('content').innerHTML.includes('Ana &amp; Luis Reyes'));
assert.equal(vm.runInContext("reportValidDate('2026-02-31')",sandbox),false);
const filledReportForm=get('content').innerHTML;
assert.ok(!filledReportForm.includes('Sign-off fields are intentionally blank'));
vm.runInContext("reportPeriod='2';render()",sandbox);
assert.ok(get('content').innerHTML.includes('Dec 15–21'));
vm.runInContext("showPage('records')",sandbox);
assert.ok(get('content').innerHTML.includes('Source record editor'));
assert.ok(get('content').innerHTML.includes('data-edit-source="5"'));
assert.equal(vm.runInContext('RECORDS.length',sandbox),792);
const first=vm.runInContext('RECORDS[0]',sandbox);
vm.runInContext("stagedChanges.set(RECORDS[0].sheetRow,{sheetRow:RECORDS[0].sheetRow,period:RECORDS[0].period,expected:recordInputs(RECORDS[0]),values:{...recordInputs(RECORDS[0]),count:9}});render()",sandbox);
assert.ok(get('content').innerHTML.includes('UNSAVED'));
assert.ok(get('content').innerHTML.includes('Save all (1)'));
vm.runInContext("showPage('reports')",sandbox);
assert.ok(get('content').innerHTML.includes('Staged or uncertain edits'));
assert.ok(get('content').innerHTML.includes('report-primary" disabled'));
vm.runInContext("stagedChanges.clear();showPage('records')",sandbox);
const valid=vm.runInContext("checkedRecord({...recordInputs(RECORDS[0]),count:19,rate:123.45})",sandbox);
assert.equal(valid,true);
const invalid=vm.runInContext("checkedRecord({...recordInputs(RECORDS[0]),test:'=HYPERLINK(1)'})",sandbox);
assert.equal(invalid,false);


const selection=php('public/report.php');
assert.ok(selection.includes('Complete both signatories'));
assert.ok(!selection.includes('IMMUNOLOGY LABORATORY CENSUS</h1>'));
function submitted(fields){
 const payload=JSON.stringify(fields).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
 return php(null,"$_SERVER['REQUEST_METHOD']='POST'; $_POST=json_decode('"+payload+"',true); require 'public/report.php';");
}
const signers={
 period:'all',prepared_name:'Dr. Maria Santos',prepared_position:'Medical Technologist',prepared_date:'2026-11-21',
 noted_name:'Ana & Luis Reyes',noted_position:'Head <Pathology>',noted_date:'2026-11-22',second_role:'Reviewed by'
};
const full=submitted(signers);
assert.ok(full.includes('IMMUNOLOGY LABORATORY CENSUS'));
assert.ok(full.includes('LCP original-color letterhead'));
assert.ok(full.includes('Pathology and Laboratory Medicine Department'));
assert.ok(full.includes('December 1–31, 2023'));
assert.ok(full.includes('SAMPLE DATA ONLY'),'Demo reports must not masquerade as real data');
assert.ok(!full.includes('Appendix A.'),'Appendix off by default');
assert.ok(full.includes('@page{size:A4 portrait;margin:47mm 16mm 46mm'));
assert.ok(full.includes('Print / Save PDF'));
assert.ok(full.includes('Prepared by:'));
assert.ok(full.includes('Reviewed by:'));
assert.ok(full.includes('Dr. Maria Santos'));
assert.ok(full.includes('Medical Technologist'));
assert.ok(full.includes('Ana &amp; Luis Reyes'));
assert.ok(full.includes('Head &lt;Pathology&gt;'));
assert.ok(full.includes('November 21, 2026'));
assert.ok(!full.includes('Date: November'),'No Date: prefix in signatory area');
assert.ok(full.includes('Summary of examinations'));
assert.ok(full.includes('Examinations by reporting interval'));
assert.ok(full.includes('Examinations by patient group'));
assert.ok(full.includes('Examinations by test'));
assert.ok(full.includes('Number of examinations'));
assert.ok(full.includes('report-total-row'));
assert.ok(!full.includes('₱'),'Financial amounts are OFF by default');
assert.ok(!full.includes('working-copy'));
assert.ok(!full.includes('For internal verification.'));
assert.ok(!full.includes('Signatories</h2>'));
assert.ok(!full.includes('Report based on records at the time shown above.'));
assert.ok(!full.includes('Prepared by: Name / position / date'));
assert.ok(full.includes('prepareStationery'));
assert.ok(full.includes('paginateReport'));
assert.ok(full.includes('content:url("'),'Print stationery repeats using CSS page margin boxes');
assert.ok(full.includes('font:400 10pt/1.05 Arial'));
assert.ok(!full.includes('filter:grayscale('));
const one=submitted({...signers,period:'2',detail:'1',amounts:'1'});
assert.ok(one.includes('December 15–21, 2023'));
assert.ok(one.includes('Appendix A. Detailed examination census'));
assert.ok(one.includes('Calculated amount (PHP)'));
assert.ok(one.includes('₱'));
assert.ok(one.includes('not payments received'));
assert.ok(one.indexOf('report-signatures')>one.indexOf('report-appendix'),'Signatures follow appendix');
const bad=submitted({...signers,prepared_date:'2026-02-31'});
assert.ok(bad.includes('Please enter a valid name, position and date'));
assert.ok(!bad.includes('IMMUNOLOGY LABORATORY CENSUS</h1>'));
assert.ok(output.includes('data:image/png;base64,'),'PHP dashboard uses same updated clean LCP emblem');
const detail=vm.runInContext("examDetailMarkup('CRP',0)",sandbox);
assert.ok(detail.includes('Source records · Dec 1–7'));
assert.ok(detail.includes('id="drawerExamPeriod"'));
assert.ok(!detail.includes('data-drawer-edit-row=""'),'No useless blank edit controls');
const noRows=vm.runInContext("examDetailMarkup('CRP',1)",sandbox);
assert.ok(!noRows.includes('data-drawer-edit-row'),'No edit controls for absent interval rows');
assert.ok(noRows.includes('No source rows in this interval.'));
const gone=vm.runInContext("examDetailMarkup('DOES NOT EXIST',0)",sandbox);
assert.ok(gone.includes('Details unavailable'));
console.log('PHP report/editor parity: typography, signatories, totals, optional amounts/appendix, LCP assets and drawer states passed');
