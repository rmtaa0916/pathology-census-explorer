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
let email='rmtaa0916@gmail.com',unexpectedTab=false,lock=false,flushCount=0;
const sheet={
 getName:()=> 'DEMO - Weekly Census',getLastRow:()=>796,
 getRange(row,col,height,cols){return {
   getValues:()=>{
     if(height===793&&cols===11)return rows.map(r=>r.slice());
     if(height===1&&cols===11)return [rows[row-4].slice()];
     throw Error('Unexpected range');
   },
   setValue:value=>{
     assert.equal(col,8);assert.equal(row,7);assert.equal(height,undefined);
     const r=rows[row-4];r[7]=value;r[9]=value*r[8];
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
