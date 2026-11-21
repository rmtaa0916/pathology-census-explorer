const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..');
const php=(file,code)=>{
 if(code!==undefined)return execFileSync('php',['-r',code],{cwd:root,encoding:'utf8',maxBuffer:15_000_000});
 return execFileSync('php',[file],{cwd:root,encoding:'utf8',maxBuffer:15_000_000});
};
const output=php('public/index.php');
const inline=output.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inline,'PHP dashboard must render a browser JS script');
new vm.Script(inline[1],{filename:'PHP dashboard inline JS'});
const nodes=new Map();
function get(id){
 if(!nodes.has(id))nodes.set(id,{
  innerHTML:'',value:'',classList:{add(){},remove(){},toggle(){}},
  addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},
  insertAdjacentHTML(which,content){this.innerHTML=content+this.innerHTML}
 });
 return nodes.get(id);
}
const sandbox={
 console,document:{getElementById:get,querySelectorAll(){return[]},addEventListener(){}},
 window:{scrollTo(){},addEventListener(){}},
 location:{reload(){}},confirm(){return true},alert(){},fetch(){throw Error('Unexpected network call in local fixture');}
};
vm.createContext(sandbox);
vm.runInContext(inline[1],sandbox);
assert.ok(get('content').innerHTML.includes('Immunology census overview'));
vm.runInContext("showPage('reports')",sandbox);
assert.ok(get('content').innerHTML.includes('A4 formal census report'));
assert.ok(get('content').innerHTML.includes('Full coverage'));
assert.ok(get('content').innerHTML.includes('report.php'));
vm.runInContext("reportPeriod='2';render()",sandbox);
assert.ok(get('content').innerHTML.includes('Dec 15–21'));
vm.runInContext("showPage('records')",sandbox);
assert.ok(get('content').innerHTML.includes('Source record editor'));
assert.ok(get('content').innerHTML.includes('data-edit-source="5"'));
assert.equal(vm.runInContext('RECORDS.length',sandbox),792);
const first=vm.runInContext('RECORDS[0]',sandbox);
vm.runInContext("stagedChanges.set(RECORDS[0].sheetRow,{sheetRow:RECORDS[0].sheetRow,period:RECORDS[0].period,expected:recordInputs(RECORDS[0]),values:{...recordInputs(RECORDS[0]),count:9}});render()",sandbox);
assert.ok(get('content').innerHTML.includes('UNSAVED'));
assert.ok(get('content').innerHTML.includes('Save all (1)'));
const valid=vm.runInContext("checkedRecord({...recordInputs(RECORDS[0]),count:19,rate:123.45})",sandbox);
assert.equal(valid,true);
const invalid=vm.runInContext("checkedRecord({...recordInputs(RECORDS[0]),test:'=HYPERLINK(1)'})",sandbox);
assert.equal(invalid,false);

const full=php('public/report.php');
assert.ok(full.includes('IMMUNOLOGY CENSUS REPORT'));
assert.ok(full.includes('LUNG CENTER OF THE PHILIPPINES'));
assert.ok(full.includes('Pathology and Laboratory Medicine Department'));
assert.ok(full.includes('Full coverage'));
assert.ok(full.includes('SAMPLE DATA ONLY'));
assert.ok(full.includes('Appendix A.')===false);
assert.ok(full.includes('@page{size:A4 portrait'));
assert.ok(full.includes('Print / Save PDF'));
assert.ok(full.includes('Prepared by: Name / position / date'));
const one=php(null,'$_GET["period"]="2"; $_GET["detail"]="1"; require "public/report.php";');
assert.ok(one.includes('Dec 15–21'));
assert.ok(one.includes('Appendix A.'));
assert.ok(one.includes('Print / Save PDF'));
assert.ok(one.includes('report-paper')===false || one.includes('paper'));
assert.ok(output.includes('data:image/webp;base64,'));
console.log('PHP interface and A4 formal report browser checks passed');
