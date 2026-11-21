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
let email='rmtaa0916@gmail.com',unexpectedTab=false,lock=false,flushCount=0,formulaBroken=false;
const sheet={
 getName:()=> 'DEMO - Weekly Census',getLastRow:()=>796,
 getRange(row,col,height,cols){return {
   getValues:()=>{
     if(height===793&&cols===11)return rows.map(r=>r.slice());
     if(height===1&&cols===11)return [rows[row-4].slice()];
     throw Error('Unexpected range');
   },
   getFormula:()=>{assert.equal(col,10);return formulaBroken?'':`=H${row}*I${row}`;},
   setValue:value=>{
     assert.equal(col,8);assert.equal(row,7);assert.equal(height,undefined);
     const r=rows[row-4];r[7]=value;r[9]=value*r[8];
   },
   setValues:values=>{
     assert.equal(col,4);assert.equal(height,1);assert.equal(cols,6);
     assert.equal(values.length,1);assert.equal(values[0].length,6);
     const r=rows[row-4];
     for(let i=0;i<6;i++)r[i+3]=values[0][i];
     r[9]=r[7]*r[8];
   }
 }}
};
const context={
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
test('22 exams; 198 groups; four weeks; synthetic totals',()=>{
 const d=context.getDataset();
 assert.equal(d.exams.length,22);assert.equal(d.entries.length,198);
 assert.equal(d.summary_stats.total_volume,expected);
 assert.equal(d.entries.find(e=>e.test==='CRP'&&e.channel==='PAY Stat').source_rows[0],7);
});
test('missing or different user identity is rejected',()=>{
 for(const bad of ['','other@gmail.com']){email=bad;assert.throws(()=>context.getDataset(),/Access denied/);}
 email='rmtaa0916@gmail.com';
});
test('unexpected actual tabs and non-synthetic rows rejected',()=>{
 unexpectedTab=true;assert.throws(()=>context.getDataset(),/Unexpected/);unexpectedTab=false;
 rows[3][10]='ACTUAL';assert.throws(()=>context.getDataset(),/non-synthetic/);rows[3][10]='SYNTHETIC / DEMO';
});
const original=rows[3][7];
const base={sheetRow:7,count:original+1,expectedCount:original,period:periods[0],test:'CRP'};
test('guarded update writes only synthetic H7 and recalculates',()=>{
 assert.equal(context.updateDemoCount(base).success,true);
 assert.equal(rows[3][7],original+1);assert.equal(rows[3][9],(original+1)*rows[3][8]);
 assert.equal(lock,false);assert.equal(flushCount,1);
});
test('stale updates and wrong row identities rejected',()=>{
 assert.throws(()=>context.updateDemoCount(base),/changed/);
 assert.throws(()=>context.updateDemoCount({...base,test:'WRONG',expectedCount:original+1}),/changed/);
 assert.throws(()=>context.updateDemoCount({...base,sheetRow:4}),/Invalid/);
 assert.throws(()=>context.updateDemoCount({...base,count:-1}),/Invalid/);
 assert.equal(rows[3][7],original+1);
});
test('count restored after test',()=>{
 assert.equal(context.updateDemoCount({...base,count:original,expectedCount:original+1}).success,true);
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
 const answer=context.updateDemoRecord({...editBase,values:vals});
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
 assert.throws(()=>context.updateDemoRecord({
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
   assert.throws(()=>context.updateDemoRecord({...editBase,expected:e,values:v}),
     /Invalid/);
 }
 assert.equal(rows[3][3],e.test);
});
test('collision with an existing period/category is rejected',()=>{
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 const v={...expectedRecord,priority:'ROUTINE'};
 assert.throws(()=>context.updateDemoRecord({...editBase,expected:e,values:v}),
   /already exists/);
 assert.equal(rows[3][3],e.test);
});
test('missing amount formula blocks mutation',()=>{
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 formulaBroken=true;
 assert.throws(()=>context.updateDemoRecord({...editBase,expected:e,values:expectedRecord}),
   /formula is missing/);
 formulaBroken=false;
 assert.equal(rows[3][3],e.test);
});
test('unauthorized users cannot change any source fields',()=>{
 email='other@gmail.com';
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 assert.throws(()=>context.updateDemoRecord({...editBase,expected:e,values:expectedRecord}),
   /Access denied/);
 email='rmtaa0916@gmail.com';
});
test('record edit restores all original inputs and totals',()=>{
 const e={test:'CRP DEMO EDIT',patientGroup:'Employee',billing:'QFS',
   priority:'QFS',count:7,rate:123.45};
 assert.equal(context.updateDemoRecord({...editBase,expected:e,values:expectedRecord}).success,true);
 assert.deepEqual(rows[3].slice(),sample);
 assert.equal(context.getDataset().summary_stats.total_volume,expected);
 assert.equal(lock,false);
});
