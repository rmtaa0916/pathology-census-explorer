'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const jsQR=require('../jsqr.js');
assert.equal(typeof jsQR,'function','Offline QR decoding library is installed');
assert.match(html,/<script src="jsqr[.]js"><\/script>/);
assert.match(html,/id="qr-scan-feedback"[^>]*role="status"/);
assert.match(html,/el\('start-qr-scan'\)[.]addEventListener\('click',startQrScan\)/);
const first=html.indexOf('// Scan in the authenticated tab.');
const last=html.indexOf('\nfunction refreshData(initial){',first);
assert.ok(first>0&&last>first,'QR camera implementation can be loaded');
const scannerCode=html.slice(first,last);
const site='https://rmtaa0916.github.io/pathology-census-explorer/qr-auth-portal/';
function fixture({pending=true,lastSuccess=true,denied=false,decoder=true}={}){
 let cameraRequests=0,stopped=0,refChanged=0;
 const elements={
   'qr-scan-feedback':{textContent:'',className:''},
   'qr-scan-panel':{hidden:true},
   'qr-camera-status':{textContent:''},
   'start-qr-scan':{disabled:false,textContent:'Scan next QR — stay signed in'},
   'ref':{value:''},
   'qr-camera':{srcObject:null,readyState:0,videoWidth:300,videoHeight:200,
     pause(){},async play(){}},
   'qr-scan-canvas':{width:0,height:0,getContext(){return{
     drawImage(){},getImageData(){return{data:new Uint8ClampedArray(300*200*4)}}
   }}}
 };
 const media={
   getTracks(){return[{stop(){stopped++}}]}
 };
 const context={
   URL,console,
   navigator:{mediaDevices:{async getUserMedia(){cameraRequests++;if(denied){
     const err=Error('denied');err.name='NotAllowedError';throw err;
   }return media}}},
   window:{location:{origin:'https://rmtaa0916.github.io',pathname:'/pathology-census-explorer/qr-auth-portal/'}},
   BarcodeDetector:undefined,jsQR:decoder?()=>({data:site+'?ref=TEST-CRP'}):undefined,
   setTimeout(){return 1},clearTimeout(){},
   el:name=>{assert.ok(elements[name],'Missing DOM '+name);return elements[name]},
   refs:()=>[{id:'TEST-CRP'}],
   onRefChange(){refChanged++},
   showStatus(){},
   resets:0
 };
 const setup='let DATA={};let PENDING='+ (pending?'{}':'null') +';'+
  'let LOCKED=false;let LAST_SUCCESS='+lastSuccess+';'+
  'function resetAfterSuccess(){PENDING=null;LAST_SUCCESS=false;resets++}\n';
 const api=vm.runInNewContext(setup+scannerCode+
  '\n({startQrScan,readQrFrame,qrRefFromLink,getEpoch:()=>QR_CAMERA.epoch,getPending:()=>PENDING})',context);
 return {api,context,elements,get requests(){return cameraRequests},get stopped(){return stopped},
   get refChanged(){return refChanged}};
}
(async()=>{
 // The previous successful transaction must not make the next QR button look dead.
 const success=fixture();
 await success.api.startQrScan();
 assert.equal(success.context.resets,1,'completed transaction cleared before scanning');
 assert.equal(success.requests,1,'rear camera requested');
 assert.equal(success.elements['qr-scan-panel'].hidden,false);
 assert.equal(success.elements['start-qr-scan'].disabled,false);
 assert.match(success.elements['qr-scan-feedback'].textContent,/Camera active/);
 success.elements['qr-camera'].readyState=2;
 await success.api.readQrFrame(success.api.getEpoch());
 assert.equal(success.elements.ref.value,'TEST-CRP');
 assert.equal(success.refChanged,1);
 assert.equal(success.elements['qr-scan-panel'].hidden,true);
 assert.equal(success.stopped,1);
 assert.match(success.elements['qr-scan-feedback'].textContent,/QR recognized/);
 // Never advance to another transaction while an earlier save is uncertain.
 const uncertain=fixture({pending:true,lastSuccess:false});
 await uncertain.api.startQrScan();
 assert.equal(uncertain.requests,0);
 assert.match(uncertain.elements['qr-scan-feedback'].textContent,/Previous transaction/);
 assert.match(uncertain.elements['qr-scan-feedback'].className,/error/);
 // A camera permission error must be visible immediately below the scan button.
 const blocked=fixture({pending:false,lastSuccess:false,denied:true});
 await blocked.api.startQrScan();
 assert.equal(blocked.requests,1);
 assert.match(blocked.elements['qr-scan-feedback'].textContent,/Camera permission was denied/);
 assert.equal(blocked.elements['qr-scan-panel'].hidden,true);
 assert.equal(blocked.elements['start-qr-scan'].disabled,false);
 // The same-origin QR policy remains in place.
 assert.equal(success.api.qrRefFromLink(site+'?ref=TEST-CRP'),'TEST-CRP');
 assert.equal(success.api.qrRefFromLink('https://malicious.invalid/?ref=TEST-CRP'),'');
 console.log('QR scanner UI PASS: touch feedback, previous-save recovery, offline decoder, authorization-independent reference selection, permission denial.');
})().catch(e=>{console.error(e);process.exitCode=1});
