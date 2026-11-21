const vm=require('node:vm');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../Code.gs'),'utf8');
const periods=['Dec 1–7','Dec 8–14','Dec 15–21','Dec 22–31'];
const tests=Array.from({length:22},(_,i)=>i===0?'CRP':'TEST '+i);
const groups=[['Inpatient','CHA','STAT'],['Inpatient','CHA','ROUTINE'],['Inpatient','PAY','STAT'],['Inpatient','PAY','ROUTINE'],['Outpatient','CHA','STAT'],['Outpatient','CHA','ROUTINE'],['Outpatient','PAY','STAT'],['Outpatient','PAY','ROUTINE'],['Employee','QFS','QFS']];
const rows=[['Period','Start date','End date','Examination','Patient group','Billing','Priority','Test count','Rate','Amount','Data status']];
for(let w=0;w<4;w++)for(let j=0;j<22;j++)for(let g=0;g<9;g++){
  const n=(j+g+w)%4,rate=100+j*10;
  rows.push([periods[w],'2023-12-01','2023-12-07',tests[j],...groups[g],n,rate,n*rate,'SYNTHETIC / DEMO']);
}
assert.equal(rows.length,793);
const expected=rows.slice(1).reduce((s,r)=>s+r[7],0);
let email='rmtaa0916@gmail.com',unexpectedTab=false,lock=false,flushCount=0,formulaBroken=false,failNextSetRow=null;
const sheet={
 getName:()=> 'DEMO - Weekly Census',getLastRow:()=>796,
 getRange(row,col,height,cols){return {
   getValues:()=>{
     if(height===793&&cols===11)return rows.map(r=>r.slice());
     if(height===1&&cols===11)return [rows[row-4].slice()];
     throw Error('Unexpected range');
   },
   getFormula:()=>{assert.equal(col,10);return formulaBroken?'':`=H${row}*I${row}`;},
   getFormulas:()=>{assert.equal(row,5);assert.equal(col,10);assert.equal(height,792);assert.equal(cols,1);return rows.slice(1).map((v,i)=>[formulaBroken&&i===2?'':`=H${i+5}*I${i+5}`]);},
   setValue:value=>{
     assert.equal(col,8);assert.equal(row,7);assert.equal(height,undefined);
     const r=rows[row-4];r[7]=value;r[9]=value*r[8];
   },
   setValues:values=>{
     assert.equal(col,4);assert.equal(cols,6);
     assert.equal(values.length,height);assert.ok(height>=1);
     if(failNextSetRow===row){failNextSetRow=null;throw Error('Simulated Sheet write failure');}
     for(let j=0;j<height;j++){
       assert.equal(values[j].length,6);
       const r=rows[row+j-4];
       for(let i=0;i<6;i++)r[i+3]=values[j][i];
       r[9]=r[7]*r[8];
     }
   }
 }}
};
const context={
 getSourceStatus:()=>({monitoringEnabled:false,needsReview:false,issues:[]}),
 assertSourceSafeToEdit_:()=>true,
 Session:{getActiveUser:()=>({getEmail:()=>email})},
 SpreadsheetApp:{openById:id=>{
   assert.equal(id,'1JD4v8qENATuFeXRyBHzwfaIbJs7uw_W86wfQ-vQwdwE');
   return {getSheets:()=>unexpectedTab?[sheet,{getName:()=> 'Actual census'}]:[sheet,{getName:()=> 'DEMO - Weekly Overview'}],getSheetByName:n=>n===sheet.getName()?sheet:null};
 },flush:()=>flushCount++},
 LockService:{getScriptLock:()=>({waitLock:()=>lock=true,releaseLock:()=>lock=false})},
 HtmlService:{createTemplateFromFile:()=>({evaluate:()=>({setTitle(){return this},addMetaTag(){return this}})})}
};
vm.createContext(context);vm.runInContext(source,context,{filename:'Code.gs'});
function test(name,fn){fn();console.log('PASS',name);}
test('22 exams; 198 groups; four weeks; working-copy totals',()=>{
 const d=context.getDataset();
 assert.equal(d.exams.length,22);assert.equal(d.entries.length,198);
 assert.equal(d.summary_stats.total_volume,expected);
 assert.equal(d.quality.passed,true);
 assert.equal(d.quality.checks.length,7);
 assert.equal(d.quality.totalRecords,792);
 assert.equal(d.entries.find(e=>e.test==='CRP'&&e.channel==='PAY Stat').source_rows[0],7);
});
test('missing or different user identity is rejected',()=>{
 for(const bad of ['','other@gmail.com']){email=bad;assert.throws(()=>context.getDataset(),/Access denied/);}
 email='rmtaa0916@gmail.com';
});
test('only configured working-copy tabs accepted; status is informational',()=>{
 unexpectedTab=true;assert.throws(()=>context.getDataset(),/Unexpected/);unexpectedTab=false;
 const old=rows[3][10];rows[3][10]='COPIED SOURCE';
 assert.equal(context.getDataset().quality.passed,true);
 rows[3][10]=old;
});
const original=rows[3][7];
const base={sheetRow:7,count:original+1,expectedCount:original,period:periods[0],test:'CRP'};
test('guarded count update changes only working-copy H7 and recalculates',()=>{
 assert.equal(context.updateCount(base).success,true);
 assert.equal(rows[3][7],original+1);assert.equal(rows[3][9],(original+1)*rows[3][8]);
 assert.equal(lock,false);assert.equal(flushCount,1);
});
test('stale updates and wrong row identities rejected',()=>{
 assert.throws(()=>context.updateCount(base),/changed/);
 assert.throws(()=>context.updateCount({...base,test:'WRONG',expectedCount:original+1}),/changed/);
 assert.throws(()=>context.updateCount({...base,sheetRow:4}),/Invalid/);
 assert.throws(()=>context.updateCount({...base,count:-1}),/Invalid/);
 assert.equal(rows[3][7],original+1);
});
test('count restored after test',()=>{
 assert.equal(context.updateCount({...base,count:original,expectedCount:original+1}).success,true);
 assert.equal(rows[3][7],original);
 assert.equal(context.getDataset().summary_stats.total_volume,expected);
});

const sample=rows[3].slice();
const expectedRecord={
  test:sample[3],patientGroup:sample[4],billing:sample[5],
  priority:sample[6],count:sample[7],rate:sample[8]
};
const editBase={sheetRow:7,period:periods[0],expected:expectedRecord};
test('dataset exposes source values and source-row identities',()=>{
 const d=context.getDataset();
 assert.equal(d.records.length,792);
 const r=d.records[2];
 assert.equal(r.sheetRow,7);
 assert.equal(r.test,expectedRecord.test);
 assert.equal(r.rate,expectedRecord.rate);
 assert.equal(r.amount,r.count*r.rate);
});
test('record edit changes inputs only and recomputes formula result',()=>{
 const vals={test:'CRP DEMO EDIT',patientGroup:'Employee',
   billing:'QFS',priority:'QFS',count:7,rate:123.45};
 const before=context.getDataset().summary_stats.reported_income;
 const answer=context.updateRecord({...editBase,values:vals});
 assert.equal(answer.success,true);
 assert.equal(answer.updatedRange,'DEMO - Weekly Census!D7:I7');
 assert.deepEqual(rows[3].slice(3,9),
   [vals.test,vals.patientGroup,vals.billing,vals.priority,vals.count,vals.rate]);
 assert.equal(rows[3][9],7*123.45);
 const d=context.getDataset();
 assert.equal(d.records[2].test,'CRP DEMO EDIT');
 assert.equal(d.records[2].amount,7*123.45);
 assert.ok(Math.abs(d.summary_stats.reported_income-before - (7*123.45-sample[9]))<0.00001);
 assert.equal(lock,false);
});
test('stale edits are rejected and do not overwrite recent changes',()=>{
 assert.throws(()=>context.updateRecord({
   ...editBase,values:{...expectedRecord,count:1}
 }),/changed/);
 assert.equal(rows[3][3],'CRP DEMO EDIT');
});
test('invalid combinations and numeric limits are rejected',()=>{
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 for(const v of [
   {...e,patientGroup:'Inpatient'},
   {...e,count:-2},{...e,count:1.2},{...e,rate:1.234},
   {...e,rate:NaN},{...e,test:'=HYPERLINK("http://bad")'}
 ]){
   assert.throws(()=>context.updateRecord({...editBase,expected:e,values:v}),
     /Invalid/);
 }
 assert.equal(rows[3][3],e.test);
});
test('collision with an existing period/category is rejected',()=>{
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 const v={...expectedRecord,priority:'ROUTINE'};
 assert.throws(()=>context.updateRecord({...editBase,expected:e,values:v}),
   /already exists/);
 assert.equal(rows[3][3],e.test);
});
test('missing amount formula blocks mutation',()=>{
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 formulaBroken=true;
 assert.throws(()=>context.updateRecord({...editBase,expected:e,values:expectedRecord}),
   /formula is missing/);
 formulaBroken=false;
 assert.equal(rows[3][3],e.test);
});
test('unauthorized users cannot change any source fields',()=>{
 email='other@gmail.com';
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 assert.throws(()=>context.updateRecord({...editBase,expected:e,values:expectedRecord}),
   /Access denied/);
 email='rmtaa0916@gmail.com';
});
test('record edit restores all original inputs and totals',()=>{
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 assert.equal(context.updateRecord({...editBase,expected:e,values:expectedRecord}).success,true);
 assert.deepEqual(rows[3].slice(),sample);
 assert.equal(context.getDataset().summary_stats.total_volume,expected);
 assert.equal(lock,false);
});

test('quality check reports a missing formula without claiming pass',()=>{
 formulaBroken=true;
 const quality=context.getDataset().quality;
 assert.equal(quality.passed,false);
 assert.equal(quality.checks.find(c=>c.id==='formulas').discrepancies,1);
 formulaBroken=false;
});
test('quality check flags an amount discrepancy without altering source rows',()=>{
 const saved=rows[3][9];rows[3][9]=saved+10;
 const quality=context.getDataset().quality;
 assert.equal(quality.passed,false);
 assert.equal(quality.checks.find(c=>c.id==='amounts').discrepancies,1);
 rows[3][9]=saved;
});
test('quality check flags duplicate identities within an interval',()=>{
 const prior=rows[4].slice();
 rows[4][3]=rows[3][3]; rows[4][4]=rows[3][4];
 rows[4][5]=rows[3][5];rows[4][6]=rows[3][6];
 const report=context.getDataset().quality;
 assert.equal(report.passed,false);
 assert.equal(report.checks.find(c=>c.id==='uniqueness').discrepancies,1);
 rows[4]=prior;
 assert.equal(context.getDataset().quality.passed,true);
});

test('copied rows may have a different or blank source status without losing editability',()=>{
  const originalStatus=rows[3][10];
  const originalCount=rows[3][7];
  const expectedValues={test:rows[3][3],patientGroup:rows[3][4],billing:rows[3][5],
    priority:rows[3][6],count:originalCount,rate:rows[3][8]};
  for(const sourceStatus of ['COPIED SOURCE','']){
    rows[3][10]=sourceStatus;
    const changed={...expectedValues,count:originalCount+1};
    assert.equal(context.updateRecord({sheetRow:7,period:periods[0],
      expected:expectedValues,values:changed}).success,true);
    assert.equal(rows[3][10],sourceStatus,'Source metadata must remain unchanged');
    assert.equal(rows[3][7],originalCount+1);
    assert.equal(context.updateRecord({sheetRow:7,period:periods[0],
      expected:changed,values:expectedValues}).success,true);
    assert.equal(rows[3][10],sourceStatus);
    assert.equal(context.getDataset().quality.passed,true);
  }
  rows[3][10]=originalStatus;
  assert.equal(rows[3][7],originalCount);
});


const snapshotRecord = row => {
 const data=rows[row-4];
 return {
  test:data[3],patientGroup:data[4],billing:data[5],
  priority:data[6],count:data[7],rate:data[8]
 };
};
const makeEdit=(row,values)=>({
 sheetRow:row,period:rows[row-4][0],
 expected:snapshotRecord(row),values:{...snapshotRecord(row),...values}
});
test('batch save updates adjacent source rows in one range and flush',()=>{
 const before7=rows[3].slice(),before8=rows[4].slice();
 const flushBefore=flushCount;
 const reply=context.updateRecordsBatch({changes:[
   makeEdit(8,{count:before8[7]+3,rate:before8[8]+2}),
   makeEdit(7,{count:before7[7]+2})
 ]});
 assert.equal(reply.success,true);assert.equal(reply.updatedCount,2);
 assert.equal(reply.groupsWritten,1);
 assert.equal(flushCount,flushBefore+1);
 assert.equal(rows[3][7],before7[7]+2);
 assert.equal(rows[4][7],before8[7]+3);
 assert.equal(rows[3][9],rows[3][7]*rows[3][8]);
 assert.equal(rows[4][9],rows[4][7]*rows[4][8]);
 assert.equal(rows[3][10],before7[10]);
 assert.equal(rows[4][10],before8[10]);
 assert.equal(lock,false);
 context.updateRecordsBatch({changes:[
   {...makeEdit(7,{}),values:{
     test:before7[3],patientGroup:before7[4],billing:before7[5],
     priority:before7[6],count:before7[7],rate:before7[8]}},
   {...makeEdit(8,{}),values:{
     test:before8[3],patientGroup:before8[4],billing:before8[5],
     priority:before8[6],count:before8[7],rate:before8[8]}}
 ]});
 assert.deepEqual(rows[3],before7);assert.deepEqual(rows[4],before8);
});
test('nonadjacent edits save through one endpoint with separate range writes',()=>{
 const original7=rows[3].slice(),original12=rows[8].slice();
 const b=context.updateRecordsBatch({changes:[
   makeEdit(7,{count:original7[7]+1}),
   makeEdit(12,{rate:original12[8]+0.5})
 ]});
 assert.equal(b.groupsWritten,2);
 assert.equal(rows[3][7],original7[7]+1);
 assert.equal(rows[8][8],original12[8]+0.5);
 context.updateRecordsBatch({changes:[
   {...makeEdit(7,{}),values:{test:original7[3],patientGroup:original7[4],
     billing:original7[5],priority:original7[6],count:original7[7],rate:original7[8]}},
   {...makeEdit(12,{}),values:{test:original12[3],patientGroup:original12[4],
     billing:original12[5],priority:original12[6],count:original12[7],rate:original12[8]}}
 ]});
 assert.deepEqual(rows[3],original7);assert.deepEqual(rows[8],original12);
});
test('stale data in one row rejects the entire batch before any write',()=>{
 const before7=rows[3].slice(),before8=rows[4].slice();
 const first=makeEdit(7,{count:before7[7]+8}),second=makeEdit(8,{count:before8[7]+9});
 second.expected.count=999;
 const oldFlush=flushCount;
 assert.throws(()=>context.updateRecordsBatch({changes:[first,second]}),/changed/);
 assert.deepEqual(rows[3],before7);assert.deepEqual(rows[4],before8);
 assert.equal(flushCount,oldFlush);
});
test('batch rejects duplicates and unsupported input values',()=>{
 const p=makeEdit(7,{count:3});
 assert.throws(()=>context.updateRecordsBatch({changes:[p,p]}),/more than once/);
 assert.throws(()=>context.updateRecordsBatch({changes:[
   makeEdit(7,{rate:11.001})]}),/Invalid/);
 assert.throws(()=>context.updateRecordsBatch({changes:[
   makeEdit(7,{priority:'QFS'})]}),/Invalid/);
 assert.throws(()=>context.updateRecordsBatch({changes:[]}),/between 1 and 100/);
});
test('batch rejects resulting category collisions and allows category swaps',()=>{
 const a=makeEdit(7,{}),b=makeEdit(8,{});
 assert.throws(()=>context.updateRecordsBatch({changes:[
   {...a,values:{...b.values}}
 ]}),/duplicate/);
 const swapA={...a,values:{...b.values}};
 const swapB={...b,values:{...a.values}};
 const r=context.updateRecordsBatch({changes:[swapA,swapB]});
 assert.equal(r.updatedCount,2);
 assert.equal(rows[3][6],b.values.priority);
 assert.equal(rows[4][6],a.values.priority);
 context.updateRecordsBatch({changes:[
   {...a,expected:{...b.values},values:{...a.values}},
   {...b,expected:{...a.values},values:{...b.values}}
 ]});
 assert.equal(rows[3][6],a.values.priority);
 assert.equal(rows[4][6],b.values.priority);
});
test('altered amount formula blocks every batch item',()=>{
 formulaBroken=true;
 const before=rows[3].slice();
 assert.throws(()=>context.updateRecordsBatch({changes:[makeEdit(7,{count:99})]}),
   /changed amount formula/);
 formulaBroken=false;
 assert.deepEqual(rows[3],before);
});
test('write failure attempts rollback of earlier completed ranges',()=>{
 const before7=rows[3].slice(),before12=rows[8].slice();
 failNextSetRow=12;
 const oldFlush=flushCount;
 assert.throws(()=>context.updateRecordsBatch({changes:[
   makeEdit(7,{count:before7[7]+2}),
   makeEdit(12,{count:before12[7]+3})
 ]}),/rollback was attempted/);
 assert.deepEqual(rows[3],before7);
 assert.deepEqual(rows[8],before12);
 assert.equal(flushCount,oldFlush+1);
});
test('unauthorized user cannot submit batch edits',()=>{
 const p=makeEdit(7,{count:4});email='other@gmail.com';
 assert.throws(()=>context.updateRecordsBatch({changes:[p]}),/Access denied/);
 email='rmtaa0916@gmail.com';
});
console.log('Batch editor regression checks passed');
