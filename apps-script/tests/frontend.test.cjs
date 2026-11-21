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
   addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
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
