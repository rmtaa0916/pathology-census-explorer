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
 window:{scrollTo(){}},console,
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
