'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','Index.html'),'utf8');
const h=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);
assert.ok(h,'Client script is embedded');
const script="'use strict';"+h[1].replace('const INITIAL_REF=<?!= initialRefJson ?>;','const INITIAL_REF="";');
new vm.Script(script,{filename:'Index.html (browser JS)'});
for(const id of ['form','ref','action','qty','kit','notes','status','print-labels','print-kits','test-label-grid','kit-label-grid','recent']){
 assert.ok(html.includes('id="'+id+'"'),'Missing UI element '+id);
}
assert.match(script,/crypto\.getRandomValues/,'Unique transaction IDs use secure randomness');
assert.match(script,/Retry SAME transaction/,'Same pending transaction ID can be retried');
assert.match(script,/Use again/,'UI provides intentional repeat');
assert.match(script,/new QRCode/,'Print labels render QR links client-side');
assert.match(script,/searchParams\.set\('ref',ref\)/,'Links include scanned reference');
assert.match(html,/QR Logger/);
assert.ok(!/https?:\/\/(?:cdn|unpkg|jsdelivr|quickchart)\./i.test(html),'No external runtime dependencies');
console.log('QR Logger HTML syntax and key UI invariants PASS.');
