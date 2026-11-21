/* QR Logger Apps Script integration tests with in-memory fake Google Sheets. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const headers={
 TEST_CATALOG:['test_code','test_name','section','default_quantity','unit','active','notes'],
 ITEM_MASTER:['item_id','item_name','section','category','base_unit','active','default_quantity','notes'],
 ITEM_LOTS:['kit_id','item_id','lot_number','expires_on','opening_balance','stock_unit','active','status','notes'],
 TRANSACTIONS:['txn_id','created_at_utc','staff_email','reference_kind','reference_id','action','quantity','unit','test_code','kit_id','notes','reverses_txn_id','status'],
 STAFF_ACCESS:['email','role','active','notes']
};
function mockSheet(table){
 return {
  getDataRange(){return{getValues(){return table.map(r=>r.slice())}}},
  getLastRow(){return table.length},
  getRange(r,c,n,m){return {setValues(vals){
   assert.equal(n,vals.length);assert.equal(m,vals[0].length);
   for(let i=0;i<n;i++)table[r-1+i]=vals[i].slice();
   return this;
  }}}
 };
}
const storage={
 TEST_CATALOG:[headers.TEST_CATALOG,['TEST-CRP','CRP','Immunology',1,'test',true,'']],
 ITEM_MASTER:[headers.ITEM_MASTER,['ITEM-CRP','CRP Reagent','Immunology','Reagent','reaction',true,1,''],['ITEM-TIPS','Pipette Tips','Immunology','Consumable','piece',true,1,'']],
 ITEM_LOTS:[headers.ITEM_LOTS,['KIT-CRP-001','ITEM-CRP','DEMO-CRP','2027-01-01',100,'reaction',true,'UNOPENED',''],['KIT-CRP-002','ITEM-CRP','DEMO-CRP-2','2027-01-01',60,'reaction',true,'OPEN',''],['PKG-TIPS-001','ITEM-TIPS','DEMO-TIPS','2026-01-01',100,'piece',true,'OPEN','']],
 TRANSACTIONS:[headers.TRANSACTIONS],
 STAFF_ACCESS:[headers.STAFF_ACCESS,['qa@example.test','technologist',true,'']]
};
let active='qa@example.test',lockHeld=false,lockUsed=0;
const book={getSheetByName(name){if(!storage[name])return null;return mockSheet(storage[name])}};
const sandbox={
 console,
 SpreadsheetApp:{openById(id){assert.equal(id,'TEST-WORKBOOK-ID-12345678901234567890');return book},flush(){}},
 PropertiesService:{getScriptProperties(){return {getProperty(k){assert.equal(k,'QR_WORKBOOK_ID');return 'TEST-WORKBOOK-ID-12345678901234567890'}}}},
 Session:{getActiveUser(){return {getEmail(){return active}}}},
 LockService:{getScriptLock(){return {waitLock(ms){assert.ok(ms>0);assert.equal(lockHeld,false);lockHeld=true;lockUsed++},releaseLock(){assert.equal(lockHeld,true);lockHeld=false}}}},
 Utilities:{formatDate(){return '2026-11-21'}},
 ScriptApp:{getService(){return{getUrl(){return 'https://script.google.com/macros/s/TEST/exec'}}}}
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','Code.gs'),'utf8'),sandbox);
function entry(id,ref,action,quantity,kitId='',notes=''){
 return {transactionId:'QR-'+id.padEnd(16,'0'),ref,action,quantity,kitId,notes};
}
function ok(p){return sandbox.qrRecordTransaction(p)}
function fail(p,regex){assert.throws(()=>ok(p),regex)}
let r;
r=ok(entry('testA','TEST-CRP','TEST_PERFORMED',1));
assert.equal(r.success,true);assert.equal(r.duplicate,false);assert.equal(storage.TRANSACTIONS.length,2);
r=ok(entry('testA','TEST-CRP','TEST_PERFORMED',1));
assert.equal(r.duplicate,true);assert.equal(storage.TRANSACTIONS.length,2);
r=ok(entry('testB','TEST-CRP','TEST_PERFORMED',1));
assert.equal(r.duplicate,false);assert.equal(storage.TRANSACTIONS.length,3);
fail(entry('testA','TEST-CRP','TEST_PERFORMED',2),/reused with different/i);
fail(entry('bad-before-open','KIT-CRP-001','CONSUMED',1),/Open the kit first/i);
r=ok(entry('openA','KIT-CRP-001','KIT_OPENED',0));assert.equal(r.balance,100);
fail(entry('openB','KIT-CRP-001','KIT_OPENED',0),/already opened/i);
r=ok(entry('usedA','KIT-CRP-001','CONSUMED',5));assert.equal(r.balance,95);
r=ok(entry('usedA','KIT-CRP-001','CONSUMED',5));assert.equal(r.duplicate,true);
assert.equal(storage.TRANSACTIONS.length,5);
r=ok(entry('usedB','KIT-CRP-001','CONSUMED',5));assert.equal(r.balance,90);
r=ok(entry('usedC','ITEM-CRP','CONSUMED',1,'KIT-CRP-002'));assert.equal(r.balance,59);
fail(entry('nolocation','ITEM-CRP','CONSUMED',1),/Select a specific kit/i);
fail(entry('overdraw','KIT-CRP-001','CONSUMED',999),/Insufficient stock/i);
fail(entry('expired','PKG-TIPS-001','CONSUMED',1),/expired/i);
fail(entry('formula','TEST-CRP','TEST_PERFORMED',1,'','=SUM(A1:A2)'),/Invalid notes/i);
fail(entry('wrongtype','TEST-CRP','CONSUMED',1),/test, not an inventory/i);
active='unauthorized@example.test';fail(entry('unauth','TEST-CRP','TEST_PERFORMED',1),/not authorized/i);
active='qa@example.test';
assert.equal(lockHeld,false);assert.ok(lockUsed>=10);
console.log('QR Logger backend integration tests PASS. Rows: '+storage.TRANSACTIONS.length+', lock uses: '+lockUsed);
