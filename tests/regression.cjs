const fs=require('fs'),vm=require('vm'),assert=require('assert');
const el={addEventListener(){},value:'all',checked:false};
const c={location:{hostname:'example.com'},document:{querySelector:()=>el,querySelectorAll:()=>[]},window:{addEventListener(){}},Intl,Uint8Array,setTimeout,clearTimeout,console};
vm.createContext(c);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../dist/app.js'),'utf8'),c);
vm.runInContext('renderPages=()=>{};refresh=()=>{};status=()=>{};renderQueue=()=>{}',c);
c.URL={createObjectURL:()=>'',revokeObjectURL(){}};c.Image=class{naturalWidth=30;naturalHeight=30;decode(){return Promise.resolve()}};
c.files=[{name:'2.png',type:''},{name:'10.png',type:'image/png'},{name:'1.png',type:'image/png'}];
(async()=>{
 const pending=vm.runInContext('add(files)',c);c.files.length=0;await pending;
 assert.equal(vm.runInContext('pages.length',c),3);
 assert.equal(vm.runInContext('ordered().map(p=>p.name).join(",")',c),'1.png,2.png,10.png');
 assert.equal(vm.runInContext('includeResult({review:true,confidence:99})',c),false);
 vm.runInContext("analyze=async p=>{if(p.name==='2.png')throw Error('test OCR error');p.state='Xong';}",c);
 let workers=0,terminated=0;c.Tesseract={async createWorker(){workers++;return{async terminate(){terminated++}}}};c.window.Tesseract=c.Tesseract;
 await vm.runInContext('run()',c);assert.equal(workers,3);assert.equal(terminated,3);
 assert.equal(vm.runInContext("pages.find(p=>p.name==='10.png').state",c),'Xong');
 assert.ok(vm.runInContext("pages.find(p=>p.name==='2.png').state.startsWith('Lỗi:')",c));
 console.log('PASS: three-file batch, empty MIME extension fallback, reset, natural order, review filter, per-image OCR failure recovery and cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
