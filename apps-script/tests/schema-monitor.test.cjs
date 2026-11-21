const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../SchemaMonitor.gs'),'utf8');
const headers=['Period','Start date','End date','Examination','Patient group','Billing',
 'Priority','Test count','Example rate (₱)','Demo amount (₱)','Data status'];
let maxRows=950,maxColumns=12,lastRow=796,lastColumn=11,extraTab=false,summaryFormula='=SUM(H5:H796)';
let raw=[...Array.from({length:3},()=>Array(11).fill('')),headers];
for(let i=0;i<792;i++)raw.push(['Dec 1–7','2023-12-01',
 '2023-12-07','TEST '+(i%22),'Inpatient','CHA','STAT',2,100,200,'COPIED']);
const rawFormulas=()=>raw.map((r,i)=>r.map((c,j)=>i>=4&&j===9?'=H'+(i+1)+'*I'+(i+1):''));
const overviewValues=[['Weekly overview','Totals'],['Records',792]];
const overviewFormulas=()=>[['',''],['',summaryFormula]];
const dataSheet={
 getName:()=> 'DEMO - Weekly Census',getLastRow:()=>lastRow,getLastColumn:()=>lastColumn,
 getMaxRows:()=>maxRows,getMaxColumns:()=>maxColumns,
 getRange:(row,col,height,cols)=>{
   assert.equal(row,4);assert.equal(col,1);assert.equal(height,1);assert.equal(cols,11);
   return {getDisplayValues:()=>[raw[3].slice()]};
 },
 getDataRange:()=>({getValues:()=>raw.map(r=>r.slice()),getFormulas:()=>rawFormulas()})
};
const summarySheet={
 getName:()=> 'DEMO - Weekly Overview',getLastRow:()=>2,getLastColumn:()=>2,
 getMaxRows:()=>120,getMaxColumns:()=>12,
 getDataRange:()=>({getValues:()=>overviewValues,getFormulas:()=>overviewFormulas()})
};
const book={
 getSheets:()=>extraTab?[dataSheet,summarySheet,{getName:()=> 'New source tab'}]:[dataSheet,summarySheet],
 getSheetByName:n=>n===dataSheet.getName()?dataSheet:n===summarySheet.getName()?summarySheet:null
};
const values=new Map(),mail=[],triggers=[];
const props={
 getProperty:k=>values.has(k)?values.get(k):null,
 setProperty:(k,v)=>values.set(k,String(v)),
 deleteProperty:k=>values.delete(k)
};
function builder(name){
 const item={getHandlerFunction:()=>name};
 return {
  forSpreadsheet(b){assert.equal(b,book);return this;},
  onChange(){return this;},
  timeBased(){return this;},
  everyHours(n){assert.equal(n,1);return this;},
  create(){triggers.push(item);return item;}
 };
}
const ctx={
 Date, Math, JSON,console,
 requireOwner_:()=>true,
 Session:{getActiveUser:()=>({getEmail:()=> 'rmtaa0916@gmail.com'})},
 SpreadsheetApp:{openById:id=>{assert.equal(id,'1JD4v8qENATuFeXRyBHzwfaIbJs7uw_W86wfQ-vQwdwE');return book;}},
 PropertiesService:{getScriptProperties:()=>props},
 ScriptApp:{getProjectTriggers:()=>triggers,newTrigger:builder},
 MailApp:{sendEmail:(to,subject,body)=>mail.push({to,subject,body})}
};
vm.createContext(ctx);
vm.runInContext("const CENSUS={spreadsheetId:'1JD4v8qENATuFeXRyBHzwfaIbJs7uw_W86wfQ-vQwdwE',sheetName:'DEMO - Weekly Census',expectedTabs:['DEMO - Weekly Census','DEMO - Weekly Overview'],headerRow:4,firstDataRow:5,lastDataRow:796,periods:['Dec 1–7','Dec 8–14','Dec 15–21','Dec 22–31'],allowedEmail:'rmtaa0916@gmail.com'}",ctx);
vm.runInContext(source,ctx,{filename:'SchemaMonitor.gs'});
const test=(label,fn)=>{fn();console.log('PASS '+label);};
test('before setup reports current compatibility but alerts are not installed',()=>{
 const d=ctx.getSourceStatus();
 assert.equal(d.monitoringEnabled,false);assert.equal(d.needsReview,false);
});
test('one-time setup creates two triggers and a stable baseline',()=>{
 const r=ctx.installSourceMonitor();
 assert.equal(r.installed,true);assert.equal(triggers.length,2);
 assert.equal(ctx.getSourceStatus().monitoringEnabled,true);
 ctx.installSourceMonitor();assert.equal(triggers.length,2);
});
test('ordinary count edits do not send source-schema emails',()=>{
 raw[4][7]=3;raw[4][9]=300;
 const report=ctx.sourceSheetChanged({changeType:'EDIT'});
 assert.equal(report.needsReview,false);
 assert.equal(report.contentChanged,true);
 assert.equal(mail.length,0);
 ctx.assertSourceSafeToEdit_();
 raw[4][7]=2;raw[4][9]=200;
});
test('blank rows added to the Sheet grid are still noticed',()=>{
 maxRows=951;
 const r=ctx.sourceScheduledCheck();
 assert.equal(r.needsReview,true);assert.ok(r.issues.some(i=>i.kind==='grid_size'));
 assert.equal(mail.length,1);
 assert.throws(()=>ctx.assertSourceSafeToEdit_(),/Editing paused/);
 ctx.sourceScheduledCheck();assert.equal(mail.length,1,'duplicate email suppressed');
 maxRows=950;
 assert.equal(ctx.getSourceStatus().needsReview,false);
});
test('new populated columns are critical and trigger an email',()=>{
 lastColumn=12;
 const r=ctx.sourceSheetChanged({changeType:'INSERT_COLUMN'});
 assert.equal(r.compatible,false);assert.ok(r.issues.some(i=>i.kind==='column_count'));
 assert.equal(mail.length,2);lastColumn=11;
});
test('changes to reporting dates require application review',()=>{
 raw[4][1]='2023-12-02';
 const r=ctx.sourceScheduledCheck();
 assert.equal(r.compatible,false);
 assert.ok(r.issues.some(i=>i.kind==='reporting_dates'));
 assert.equal(mail.length,3);
 raw[4][1]='2023-12-01';
});
test('changed overview formulas are flagged but not falsely called critical',()=>{
 summaryFormula='=SUM(H5:H797)';
 const r=ctx.sourceScheduledCheck();
 assert.equal(r.severity,'review');
 assert.ok(r.issues.some(i=>i.kind==='summary_formulas'));
 assert.equal(mail.length,4);
 summaryFormula='=SUM(H5:H796)';
});
test('changed main Sheet formulas are flagged',()=>{
 const prior=dataSheet.getDataRange;
 dataSheet.getDataRange=()=>({getValues:()=>raw,getFormulas:()=>{
   const vals=rawFormulas();vals[4][9]='=SUM(H5:I5)';return vals;
 }});
 const r=ctx.sourceScheduledCheck();
 assert.ok(r.issues.some(i=>i.kind==='data_formulas'));
 assert.equal(mail.length,5);
 dataSheet.getDataRange=prior;
});
test('new named tab appears in source compatibility warnings',()=>{
 extraTab=true;
 const r=ctx.sourceScheduledCheck();
 assert.equal(r.needsReview,true);assert.ok(r.issues.some(i=>i.kind==='new_tab'));
 extraTab=false;
});
test('alert email contains only structural description, not source cell values',()=>{
 assert.ok(mail.every(x=>x.to==='rmtaa0916@gmail.com'));
 assert.ok(mail.every(x=>!x.body.includes('COPIED')&&!x.body.includes('TEST 0')));
});
test('restoring original schema clears warning and allows editing',()=>{
 assert.equal(ctx.getSourceStatus().needsReview,false);
 assert.equal(ctx.assertSourceSafeToEdit_(),true);
});

test('approval cannot bless an unsupported column layout',()=>{
 lastColumn=12;
 assert.throws(()=>ctx.approveSourceBaseline(),/does not match/);
 lastColumn=11;
});
test('owner can approve a reviewed, code-compatible baseline',()=>{
 const result=ctx.approveSourceBaseline();
 assert.equal(result.approved,true);
 assert.equal(ctx.getSourceStatus().needsReview,false);
 assert.equal(ctx.getSourceStatus().monitoringEnabled,true);
});
