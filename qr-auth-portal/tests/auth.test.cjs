'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'AppsScript/QrCore.gs'),'utf8');
const api=fs.readFileSync(path.join(root,'AppsScript/AuthEndpoint.gs'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const config=fs.readFileSync(path.join(root,'config.js'),'utf8');
assert.ok(!html.includes('google.script.run'));
assert.ok(!html.includes('localStorage')&&!html.includes('sessionStorage'));
assert.match(html,/accounts\.google\.com\/gsi\/client/);
assert.match(html,/name="qr-transport"/);
assert.match(html,/const INITIAL_REF=new URLSearchParams/);
assert.match(html,/nonce:LOGIN_NONCE/);
assert.match(html,/function onReply\(event\)/);
assert.match(api,/window\.top\.postMessage/);
assert.match(html,/new QRCode/);
assert.match(html,/Sign in to record activities/);
assert.match(config,/clientId: "[0-9]+-[A-Za-z0-9_-]+[.]apps[.]googleusercontent[.]com"/);
const configuredEndpoint = config.match(/endpoint: "([^"]+)"/);
assert.ok(configuredEndpoint, "Apps Script endpoint configured");
const endpointUrl = new URL(configuredEndpoint[1]);
assert.equal(endpointUrl.protocol,"https:");
assert.equal(endpointUrl.hostname,"script.google.com");
assert.match(endpointUrl.pathname,new RegExp("^/macros/s/[A-Za-z0-9_-]+/exec$"));
let inline=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);
assert.ok(inline,'Main browser code present');
new vm.Script("'use strict';"+inline[1],{filename:'index.html inline script'});

// Returning users may sign in through Google without a repeated account chooser;
// the button remains available for denied accounts or multi-account browsers.
assert.match(html,/auto_select:allowAuto/);
assert.match(html,/button_auto_select:allowAuto/);
assert.match(html,/use_fedcm_for_button:true/);
assert.match(html,/google[.]accounts[.]id[.]prompt[(][)]/);
assert.match(html,/google[.]accounts[.]id[.]disableAutoSelect[(][)]/);
assert.match(html,/launchGoogle[(]false[)]/);
// In-page QR scanning never calls the recording API, only selects a verified ref.
assert.match(html,/id="start-qr-scan"/);
assert.match(html,/getUserMedia/);
assert.match(html,/new BarcodeDetector[(]/);
assert.match(html,/stopQrScan[(][)]/);
const refStart=html.indexOf('function qrRefFromLink(raw){');
const refEnd=html.indexOf('\nasync function readQrFrame',refStart);
assert.ok(refStart>=0&&refEnd>refStart,'QR reference decoder present');
const refFunction=html.slice(refStart,refEnd);
const checkRef=vm.runInNewContext(refFunction+"; qrRefFromLink",{
  URL,window:{location:{origin:"https://rmtaa0916.github.io",pathname:"/pathology-census-explorer/qr-auth-portal/"}},
  refs:()=>[{id:"TEST-CRP"},{id:"KIT-CRP-001"}]
});
assert.equal(checkRef("https://rmtaa0916.github.io/pathology-census-explorer/qr-auth-portal/?ref=TEST-CRP"),"TEST-CRP");
assert.equal(checkRef("https://rmtaa0916.github.io/pathology-census-explorer/qr-auth-portal/?ref=UNKNOWN"),"");
assert.equal(checkRef("https://evil.invalid/pathology-census-explorer/qr-auth-portal/?ref=TEST-CRP"),"");
assert.equal(checkRef("https://rmtaa0916.github.io/other/?ref=TEST-CRP"),"");

assert.doesNotMatch(core,/function qrGetData\(/);
assert.doesNotMatch(core,/function qrRecordTransaction\(/);
assert.doesNotMatch(core,/function doGet\(/);
const headers={
 TEST_CATALOG:['test_code','test_name','section','default_quantity','unit','active','notes'],
 ITEM_MASTER:['item_id','item_name','section','category','base_unit','active','default_quantity','notes'],
 ITEM_LOTS:['kit_id','item_id','lot_number','expires_on','opening_balance','stock_unit','active','status','notes'],
 TRANSACTIONS:['txn_id','created_at_utc','staff_email','reference_kind','reference_id','action','quantity','unit','test_code','kit_id','notes','reverses_txn_id','status'],
 STAFF_ACCESS:['email','role','active','notes']
};
const tables={
 TEST_CATALOG:[headers.TEST_CATALOG,['TEST-CRP','CRP','Immunology',1,'test',true,'']],
 ITEM_MASTER:[headers.ITEM_MASTER,['ITEM-CRP','CRP Reagent','Immunology','Reagent','reaction',true,1,'']],
 ITEM_LOTS:[headers.ITEM_LOTS,['KIT-CRP-001','ITEM-CRP','DEMO','2027-12-31',100,'reaction',true,'UNOPENED','']],
 TRANSACTIONS:[headers.TRANSACTIONS],
 STAFF_ACCESS:[headers.STAFF_ACCESS,['rmtaa0917@gmail.com','technologist',true,'']]
};
function mockSheet(t){return{
 getDataRange(){return{getValues(){return t.map(r=>r.slice())}}},
 getLastRow(){return t.length},
 getRange(r,c,n,m){return{setValues(rows){assert.equal(n,rows.length);assert.equal(m,rows[0].length);rows.forEach((v,i)=>t[r-1+i]=v.slice())}}}
}}
const props={
 QR_WORKBOOK_ID:'TEST-WORKBOOK-ID-12345678901234567890',
 QR_PORTAL_URL:'https://rmtaa0916.github.io/pathology-census-explorer/qr-auth-portal/',
 QR_PORTAL_ORIGIN:'https://rmtaa0916.github.io',
 QR_GOOGLE_CLIENT_ID:'123456789-test.apps.googleusercontent.com'
};
let claims={aud:props.QR_GOOGLE_CLIENT_ID,iss:'https://accounts.google.com',
 exp:Math.floor(Date.now()/1000)+3500,email_verified:'true',
 email:'rmtaa0917@gmail.com',sub:'102030405060708090',nonce:'aaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
let fetches=0,opens=0,locks=0;
const sandbox={
 Date,JSON,Number,String,Object,RegExp,Math,Error,
 PropertiesService:{getScriptProperties(){return {getProperty(k){return props[k]}}}},
 UrlFetchApp:{fetch(url,opts){
  assert.ok(url.startsWith('https://oauth2.googleapis.com/tokeninfo?id_token='));
  assert.equal(opts.followRedirects,false);fetches++;
  return{getResponseCode(){return 200},getContentText(){return JSON.stringify(claims)}};
 }},
 SpreadsheetApp:{openById(id){assert.equal(id,props.QR_WORKBOOK_ID);opens++;
    return{getSheetByName(n){return tables[n]?mockSheet(tables[n]):null}}},flush(){}},
 LockService:{getScriptLock(){return{waitLock(){locks++},releaseLock(){}}}},
 Utilities:{base64Encode(s){return Buffer.from(s,'utf8').toString('base64')},
   Charset:{UTF_8:'UTF_8'},formatDate(){return '2026-11-21'}},
 HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput(txt){return{
  content:txt,setXFrameOptionsMode(){return this}
 }}}
};
vm.createContext(sandbox);
vm.runInContext(core+'\n'+api,sandbox,{filename:'QR Auth project'});
const token='header.'+'b'.repeat(100)+'.signature',nonce=claims.nonce;
function response(e){
 const out=sandbox.doPost({parameter:e}).content;
 const m=out.match(/atob\("([^"]+)"\)/);
 assert.ok(m,'Must return encoded secure postMessage');
 assert.match(out,/window\.top\.postMessage/);
 assert.ok(out.includes(props.QR_PORTAL_ORIGIN));
 return JSON.parse(Buffer.from(m[1],'base64').toString('utf8'));
}
function call(op,payload={},opts={}){
 return response({op,request_id:'aaaaaaaaaaaaaaaaaaaa',id_token:token,
   nonce,payload:JSON.stringify(payload),...opts});
}
let r=call('bootstrap');
assert.equal(r.ok,true,JSON.stringify(r));
assert.equal(r.result.staff.email,'rmtaa0917@gmail.com');
assert.equal(r.result.tests.length,1);
assert.equal(r.result.appUrl,props.QR_PORTAL_URL);
const tx=(id,ref,action,quantity)=>({transactionId:'QR-'+id.padEnd(16,'0'),ref,action,quantity,notes:''});
r=call('record',tx('testA','TEST-CRP','TEST_PERFORMED',1));assert.equal(r.ok,true);
r=call('record',tx('testA','TEST-CRP','TEST_PERFORMED',1));assert.equal(r.result.duplicate,true);
r=call('record',tx('testB','TEST-CRP','TEST_PERFORMED',1));assert.equal(r.result.duplicate,false);
assert.equal(tables.TRANSACTIONS.length,3);
r=call('record',tx('stockA','KIT-CRP-001','CONSUMED',1));assert.match(r.error,/Open the kit first/);
r=call('record',tx('openA','KIT-CRP-001','KIT_OPENED',0));assert.equal(r.ok,true);
r=call('record',tx('usedA','KIT-CRP-001','CONSUMED',1));assert.equal(r.result.balance,99);
r=call('record',tx('usedA','KIT-CRP-001','CONSUMED',1));assert.equal(r.result.duplicate,true);
assert.equal(tables.TRANSACTIONS.length,5);
const good={...claims};
function rejected(field,value){
 claims={...good,[field]:value};
 const old=opens;
 const z=call('bootstrap');
 assert.equal(z.ok,false,'Must fail '+field);
 assert.equal(opens,old,'Must reject before Sheets: '+field);
}
rejected('aud','another-client.apps.googleusercontent.com');
rejected('iss','https://malicious.example');
rejected('exp',100);
rejected('email_verified','false');
rejected('nonce','othernonce');
rejected('sub','unknown');
claims={...good,email:'not-allowed@gmail.com'};
r=call('bootstrap');assert.equal(r.ok,false);assert.match(r.error,/not authorized/);
claims=good;
r=call('bootstrap',{}, {nonce:'bbbbbbbbbbbbbbbbbbbb'});
assert.equal(r.ok,false);
assert.equal(sandbox.doGet().content.includes('rmtaa0917'),false);
assert.ok(fetches>=9 && locks>=5);
console.log('Verified-signin QR portal PASS: front-end syntax, verified claims, denied staff, repeated valid events, idempotency and balance.');
