'use strict';
const $=s=>document.querySelector(s), pages=[];
const uid=()=>globalThis.crypto?.randomUUID?.()||('id'+Date.now().toString(36)+Math.random().toString(36).slice(2));let loading=false,batchPosition='',busy=false,cancel=false,worker=null,kind='symbol',selected=null,matchIndex=-1;
const hangul=s=>/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/u.test(s||'');
const natural=new Intl.Collator('vi',{numeric:true,sensitivity:'base'});
function status(s){$('#status').textContent=s}function ordered(){return [...pages].sort((a,b)=>natural.compare(a.name,b.name)||a.id.localeCompare(b.id))}
function visibleRows(){return pages.flatMap(p=>p.results.map(r=>({...r,page:p}))).filter(r=>r.kind===kind&&($('#scope').value==='all'||r.page.id===$('#scope').value)&&includeResult(r))}
async function add(files){
 files=Array.from(files);if(busy||loading)return;loading=true;refresh();let added=0;const errors=[];
 try{for(const [i,f] of files.entries()){
 status(`Đang tải ${i+1}/${files.length}: ${f.name}`);
 if(!/^image\/(jpeg|png|webp)$/i.test(f.type)&&! /\.(jpe?g|png|webp)$/i.test(f.name)){errors.push(f.name+': định dạng không hỗ trợ');continue;}
 const url=URL.createObjectURL(f);try{
 const img=new Image();img.src=url;await deadline(img.decode(),20000,'Không giải mã được ảnh');
 if(!img.naturalWidth)throw Error('Ảnh không hợp lệ');
 pages.push({id:uid(),name:f.name,url,w:img.naturalWidth,h:img.naturalHeight,state:'Chờ phân tích',results:[]});added++;
 renderPages();refresh();
 }catch(e){URL.revokeObjectURL(url);errors.push(f.name+': '+e.message);}
 }}finally{loading=false;$('#upload-errors').textContent=errors.join(' · ');status(`Đã thêm ${added}/${files.length} ảnh · Tổng ${pages.length} ảnh`);refresh();}
}
function deadline(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms)})]).finally(()=>clearTimeout(timer));}
function includeResult(r){return ($('#uncertain').checked||!r.review)&&(!$('#confident').checked||(r.confidence!=null&&r.confidence>=70));}

function renderPages(){const root=$('#pages');root.replaceChildren();if(!pages.length){root.innerHTML='<div class="empty"><div class="paper">한<span>18 px</span></div><h3>Ảnh của bạn sẽ xuất hiện ở đây</h3><p>Chọn ảnh hoặc kéo thả để bắt đầu.</p></div>';return}for(const p of ordered()){const el=document.createElement('article');el.className='page';el.id='page-'+p.id;const head=document.createElement('div');head.className='pagehead';const title=document.createElement('span');title.textContent=p.name+' · '+p.w+' × '+p.h+' px';const right=document.createElement('div');const st=document.createElement('span');st.className='page-state';st.textContent=p.state;const del=document.createElement('button');del.textContent='×';del.title='Xóa ảnh';del.disabled=busy||loading;del.onclick=()=>{URL.revokeObjectURL(p.url);pages.splice(pages.indexOf(p),1);renderPages();refresh()};right.append(st,del);head.append(title,right);const stage=document.createElement('div');stage.className='stage';stage.style.width=$('#zoom').value+'%';stage.style.aspectRatio=p.w+'/'+p.h;const im=document.createElement('img');im.src=p.url;im.alt=p.name;im.loading='lazy';im.decoding='async';const layer=document.createElement('div');layer.className='layer';stage.append(im,layer);el.append(head,stage);root.append(el);p.el=el;p.drawSignature=null;draw(p)}}
function draw(p){if(!p.el)return;const layer=p.el.querySelector('.layer');const rows=p.results.filter(r=>r.kind===kind&&includeResult(r));const signature=JSON.stringify([kind,selected,$('#uncertain').checked,$('#confident').checked,rows.map(r=>[r.id,r.h,r.review,r.sources?.length])]);if(p.drawSignature===signature)return;p.drawSignature=signature;layer.replaceChildren();for(const r of rows){const b=document.createElement('button');b.className='box'+(r.review?' low':'')+(selected!==null?(r.h===selected?' highlight':' dim'):'');b.dataset.height=r.h;b.dataset.result=r.id;b.style.left=r.x/p.w*100+'%';b.style.top=r.y/p.h*100+'%';b.style.width=r.w/p.w*100+'%';b.style.height=r.h/p.h*100+'%';b.title=r.text+' · '+r.h+' px · OCR '+(r.confidence==null?'không có':Math.round(r.confidence)+'%');const label=document.createElement('span');label.className='label';label.textContent=(r.review?'? ':'')+(kind==='line'?'Dòng: ':'')+r.h+' px';b.append(label);b.onclick=()=>{const d=$('#info');d.replaceChildren();const h=document.createElement('h2');h.textContent=r.text||'Vùng chữ';const t=document.createElement('p');t.textContent=`${p.name} · ${r.kind==='symbol'?'Ký tự':'Dòng'}: ${r.h} px. Tọa độ [${r.x}, ${r.y}, ${r.x+r.w}, ${r.y+r.h}). OCR: ${r.confidence==null?'xem điểm riêng từng nguồn':Math.round(r.confidence)+'%'}. ${r.engines?'Nguồn: '+r.engines.join(', ')+'. ':''}${r.reviewReasons?r.reviewReasons.join('; ')+'. ':''} ${r.review?'Cần kiểm tra. ':''}${r.refined?'Đã tìm nét trong vùng mở rộng, bao gồm nét mờ nối với nét chính.':'Dùng khung OCR; chưa tách chắc chắn nét chữ.'} Đo theo trục ảnh.`;if(r.sources){const detail=document.createElement('pre');detail.style.cssText='max-height:240px;overflow:auto;white-space:pre-wrap;font-size:11px';detail.textContent=JSON.stringify(r.sources,null,2);d.append(detail);}const close=document.createElement('button');close.textContent='Đóng';close.onclick=()=>d.close();d.append(h,t,close);d.showModal()};layer.append(b)}requestAnimationFrame(()=>layoutLabels(p))}
function layoutLabels(p){if(!p.el)return;const stage=p.el.querySelector('.stage'),width=stage.clientWidth,scale=width/p.w;const occupied=[];for(const box of p.el.querySelectorAll('.box')){const label=box.firstChild;const x=parseFloat(box.style.left)/100*width,y=parseFloat(box.style.top)/100*stage.clientHeight;const bw=box.offsetWidth;let lx=x+bw+4,ly=y;if(lx+label.offsetWidth>width+8)lx=Math.max(-8,x-label.offsetWidth-4);let tries=0;while(occupied.some(z=>Math.abs(z.y-ly)<15&&Math.abs(z.x-lx)<label.offsetWidth+3)&&tries++<12)ly+=15;occupied.push({x:lx,y:ly});label.style.left=(lx-x)+'px';label.style.top=(ly-y)+'px';if(ly-y>3)label.style.borderLeft='2px solid #adc8a8'}}
function refresh(){renderQueue();$('#review-count').textContent=pages.reduce((n,p)=>n+p.results.filter(r=>r.kind===kind&&r.review).length,0)+' kết quả cần kiểm tra (có thể gồm nét tranh)'; $('#count').textContent=pages.length+' ảnh';$('#run').disabled=busy||loading||!pages.length;$('#clear').disabled=busy||loading;$('#choose').disabled=busy||loading;$('#sample').disabled=busy||loading;$('#files').disabled=busy||loading;$('#stop').hidden=!busy;const scope=$('#scope'),old=scope.value;scope.replaceChildren(new Option('Tất cả ảnh','all'),...ordered().map(p=>new Option(p.name,p.id)));scope.value=[...scope.options].some(o=>o.value===old)?old:'all';const rows=visibleRows(),groups=new Map;for(const r of rows){if(!groups.has(r.h))groups.set(r.h,{n:0,images:new Set});groups.get(r.h).n++;groups.get(r.h).images.add(r.page.id)}$('#total').textContent=rows.length;$('#distinct').textContent=groups.size;$('#noresults').hidden=!!rows.length;$('#csv').disabled=!rows.length;$('#json').disabled=!pages.some(p=>p.results.length);if($('#html'))$('#html').disabled=!pages.some(p=>p.results.length);$('#summary').replaceChildren();for(const [h,g]of [...groups].sort((a,b)=>a[0]-b[0])){const tr=document.createElement('tr');if(selected===h)tr.className='selected';for(const s of [h+' px',g.n,g.images.size]){const td=document.createElement('td');td.textContent=s;tr.append(td)}tr.onclick=()=>{selected=selected===h?null:h;matchIndex=-1;refresh();if(selected!==null)navigate(1)};$('#summary').append(tr)}$('#selection').hidden=selected===null;$('#selection span').textContent=selected+' px';for(const p of pages){if(p.el){p.el.querySelector('.page-state').textContent=p.state;p.el.querySelector('.pagehead button').disabled=busy}draw(p)}}
function renderQueue(){const root=$('#queue');root.replaceChildren();for(const p of ordered()){const a=document.createElement('a');a.href='#page-'+p.id;a.textContent=p.name+' — '+p.state;root.append(a);}}
function navigate(d){const rows=visibleRows().filter(r=>r.h===selected);if(!rows.length)return;matchIndex=(matchIndex+d+rows.length)%rows.length;const r=rows[matchIndex];const el=r.page.el?.querySelector('[data-result="'+r.id+'"]');el?.scrollIntoView({behavior:'smooth',block:'center'});$('#selection span').textContent=selected+' px · '+(matchIndex+1)+'/'+rows.length}
// Refine ink bounds on original pixels. Border luminance estimates local background.
function refine(ctx,b,W,H){
 const pad=Math.max(4,Math.min(10,Math.ceil(b.h*.18)));
 const x=Math.max(0,Math.floor(b.x)-pad),y=Math.max(0,Math.floor(b.y)-pad);
 const w=Math.min(W,Math.ceil(b.x+b.w)+pad)-x,h=Math.min(H,Math.ceil(b.y+b.h)+pad)-y;
 if(w<1||h<1)return null;
 const d=ctx.getImageData(x,y,w,h).data,lum=i=>.299*d[i]+.587*d[i+1]+.114*d[i+2];
 const border=[];for(let xx=0;xx<w;xx++)border.push(lum(xx*4),lum(((h-1)*w+xx)*4));
 for(let yy=0;yy<h;yy++)border.push(lum(yy*w*4),lum((yy*w+w-1)*4));
 border.sort((a,b)=>a-b);const bg=border[Math.floor(border.length/2)],dark=bg>=128;
 const weak=new Uint8Array(w*h),seen=new Uint8Array(w*h);let minx=w,miny=h,maxx=-1,maxy=-1,count=0,clipped=false;
 for(let i=0;i<w*h;i++){const v=lum(i*4);weak[i]=(dark?bg-v:v-bg)>=18?1:0;}
 // Keep whole components containing a strong pixel inside the OCR seed.
 // This recovers antialiasing and detached Hangul strokes without adding fixed padding to the measurement.
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
  const seed=yy*w+xx,v=lum(seed*4);
  if(seen[seed]||!weak[seed]||x+xx<b.x||x+xx>=b.x+b.w||y+yy<b.y||y+yy>=b.y+b.h||(dark?bg-v:v-bg)<55)continue;
  const q=[seed];seen[seed]=1;let loX=xx,hiX=xx,loY=yy,hiY=yy;
  for(let j=0;j<q.length;j++){const i=q[j],cx=i%w,cy=Math.floor(i/w);loX=Math.min(loX,cx);hiX=Math.max(hiX,cx);loY=Math.min(loY,cy);hiY=Math.max(hiY,cy);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=cx+dx,ny=cy+dy,n=ny*w+nx;if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[n]&&weak[n]){seen[n]=1;q.push(n);}}
  }
  if(q.length<2)continue;
  count+=q.length;minx=Math.min(minx,loX);maxx=Math.max(maxx,hiX);miny=Math.min(miny,loY);maxy=Math.max(maxy,hiY);
  if(loX===0||loY===0||hiX===w-1||hiY===h-1)clipped=true;
 }
 if(maxy<0||count/(w*h)>.70)return{x:Math.max(0,Math.floor(b.x)),y:Math.max(0,Math.floor(b.y)),w:Math.ceil(b.w),h:Math.ceil(b.h),refined:false};
 return{x:x+minx,y:y+miny,w:maxx-minx+1,h:maxy-miny+1,refined:true,clipped};
}
function overlap(a,b){const x=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),y=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));return x*y/Math.max(1,Math.min(a.w*a.h,b.w*b.h))}
function collect(data,pass,offsetX=0,offsetY=0,scaleX=1,scaleY=1){
 const out=[];for(const block of data.blocks||[])for(const para of block.paragraphs||[])for(const line of para.lines||[]){
 const letters=[...(line.text||'').replace(/\s/g,'')],n=letters.filter(hangul).length,context=n>=2&&n/Math.max(1,letters.length)>=.6;
 const convert=(c,kind)=>{if(!c.bbox)return;const b=c.bbox;out.push({...c,kind,pass,context,bbox:{x0:offsetX+b.x0/scaleX,y0:offsetY+b.y0/scaleY,x1:offsetX+b.x1/scaleX,y1:offsetY+b.y1/scaleY}})};
 if(n)convert(line,'line');
 for(const word of line.words||[])for(const symbol of word.symbols||[])if(/^[\uAC00-\uD7A3]$/u.test(symbol.text||''))convert(symbol,'symbol');
 }return out;
}
async function recognize(canvas,mode){await worker.setParameters({tessedit_pageseg_mode:String(mode)});return (await deadline(worker.recognize(canvas,{}, {blocks:true,text:true}),90000,'OCR quá thời gian 90 giây; chuyển sang ảnh tiếp theo')).data;}
async function analyze(p){
 p.results=[];p.state='Đang đọc ảnh';refresh();const im=new Image();im.src=p.url;await deadline(im.decode(),20000,'Không giải mã được ảnh');
 const scale=Math.min(4,Math.max(1,1800/p.w)),tileH=Math.max(200,Math.min(1200,Math.floor(2200000/(p.w*scale*scale)))),overlapH=Math.min(160,Math.floor(tileH*.2));
 for(let top=0;top<p.h;top+=tileH-overlapH){if(cancel)break;
 const height=Math.min(tileH,p.h-top),orig=document.createElement('canvas'),scan=document.createElement('canvas');orig.width=p.w;orig.height=height;
 try{const ctx=orig.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,top,p.w,height,0,0,p.w,height);
 scan.width=Math.round(p.w*scale);scan.height=Math.round(height*scale);const sx=scan.width/p.w,sy=scan.height/height;scan.getContext('2d').drawImage(orig,0,0,scan.width,scan.height);
 p.state=`${batchPosition} · Đang quét ${Math.round(top/p.h*100)}%`;refresh();
 let candidates=collect(await recognize(scan,11),0,0,0,sx,sy);
 if($('#accurate').checked&&!cancel){
 candidates.push(...collect(await recognize(scan,12),1,0,0,sx,sy));
 // Read detected text lines in isolation: layout of the surrounding drawing cannot influence this pass.
 const lines=[];for(const c of candidates.filter(c=>c.kind==='line'&&c.context)){const b=c.bbox,r={x:b.x0,y:b.y0,w:b.x1-b.x0,h:b.y1-b.y0};if(r.h>=3&&r.w>2&&!lines.some(l=>overlap(l,r)>.65))lines.push(r);}
 for(const [i,r]of lines.entries()){
 if(cancel)break;p.state=`${batchPosition} · Kiểm tra dòng ${i+1}/${lines.length}`;renderQueue();p.el.querySelector('.page-state').textContent=p.state;
 const x=Math.max(0,Math.floor(r.x)-3),y=Math.max(0,Math.floor(r.y)-3),w=Math.min(p.w,Math.ceil(r.x+r.w)+3)-x,h=Math.min(height,Math.ceil(r.y+r.h)+3)-y;
 const crop=document.createElement('canvas'),k=Math.min(6,Math.max(2,48/h));crop.width=Math.ceil(w*k)+24;crop.height=Math.ceil(h*k)+24;
 try{const cc=crop.getContext('2d');cc.fillStyle='#fff';cc.fillRect(0,0,crop.width,crop.height);cc.drawImage(orig,x,y,w,h,12,12,w*k,h*k);candidates.push(...collect(await recognize(crop,6),2,x-12/k,y-12/k,k,k));}finally{crop.width=1;crop.height=1;}
 }
 }
 for(const c of candidates){const b=c.bbox;if(!b||Number(c.confidence)<25)continue;
 const seed={x:b.x0,y:b.y0,w:b.x1-b.x0,h:b.y1-b.y0};const bounds=refine(ctx,seed,p.w,height);if(!bounds||bounds.h<2)continue;
 const support=candidates.some(other=>other.kind===c.kind&&other.pass!==c.pass&&other.text.trim()===c.text.trim()&&overlap(seed,{x:other.bbox.x0,y:other.bbox.y0,w:other.bbox.x1-other.bbox.x0,h:other.bbox.y1-other.bbox.y0})>.6);
 const row={...bounds,y:bounds.y+top,text:c.text||'',kind:c.kind,confidence:Number(c.confidence)||0,id:uid(),context:c.context,support};
 const ratio=row.w/row.h,expansion=row.h/Math.max(1,seed.h);
 row.review=!!row.clipped||row.confidence<60||!row.refined||(!row.context&&!support)||(row.kind==='symbol'&&(ratio<.45||ratio>1.8||expansion>1.7||expansion<.6));
 const dup=p.results.findIndex(r=>r.kind===row.kind&&overlap(r,row)>.65);
 if(dup<0)p.results.push(row);else if((p.results[dup].review&&!row.review)||(p.results[dup].review===row.review&&row.confidence>p.results[dup].confidence))p.results[dup]=row;
 }
 refresh();await new Promise(r=>setTimeout(r,0));
 }finally{scan.width=1;scan.height=1;orig.width=1;orig.height=1;}
 if(top+height>=p.h)break;
 }
 const accepted=p.results.filter(r=>r.kind==='symbol'&&!r.review).length,review=p.results.filter(r=>r.kind==='symbol'&&r.review).length;
 p.state=cancel?'Đã dừng · kết quả một phần':`Xong · ${accepted} ký tự · ${review} cần kiểm tra`;refresh();
}
async function run(){
 if(busy||loading||!pages.length)return;busy=true;cancel=false;selected=null;refresh();let completed=0,failed=0;
 try{if(!window.Tesseract)throw Error('Không tải được thư viện OCR. Hãy kiểm tra mạng và tải lại trang.');
 const queue=ordered();for(const [i,p]of queue.entries()){
 if(cancel)break;batchPosition=`Ảnh ${i+1}/${queue.length}`;status(batchPosition+' · '+p.name);
 try{worker=await deadline(Tesseract.createWorker('kor',1,{logger:m=>{if(m.status==='recognizing text')status(batchPosition+' · '+p.name+' · OCR '+Math.round(m.progress*100)+'%');}}),90000,'Tải OCR quá thời gian');await analyze(p);if(!cancel)completed++;}
 catch(e){p.state='Lỗi: '+e.message;failed++;refresh();}
 finally{if(worker){await worker.terminate().catch(()=>{});worker=null;}}
 }
 status(`${cancel?'Đã dừng':'Đã xử lý'} ${completed}/${pages.length} ảnh · ${failed} lỗi`);
 }catch(e){status(e.message)}finally{busy=false;batchPosition='';refresh();}
}

function download(name,text,type){const u=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

async function exportHTMLReport(){
 const targets=ordered().filter(p=>p.results&&p.results.length);
 if(!targets.length)return;
 const prevStatus=$('#status').textContent;
 status('Đang chuẩn bị file HTML (đang nhúng ảnh và dữ liệu)...');
 try{
  const pagesData=[];
  for(const [i,p] of targets.entries()){
   status(`Đang xuất HTML: ${i+1}/${targets.length} · ${p.name}`);
   let dataUrl=p.url;
   try{
    const blob=await (await fetch(p.url)).blob();
    dataUrl=await new Promise((res,rej)=>{
     const r=new FileReader();
     r.onload=()=>res(r.result);
     r.onerror=rej;
     r.readAsDataURL(blob);
    });
   }catch(err){console.warn('Không thể chuyển ảnh sang base64',err);}
   pagesData.push({name:p.name,w:p.w,h:p.h,url:dataUrl,results:p.results});
  }
  const html=buildHTMLDocument(pagesData);
  download('hangul-pixel-bao-cao.html',html,'text/html;charset=utf-8');
  status('Đã xuất file HTML thành công!');
 }catch(e){
  status('Lỗi khi xuất HTML: '+e.message);
 }
}

function buildHTMLDocument(pagesData){
 const rawJson=JSON.stringify(pagesData).replace(/<\/script/gi,'<\\/script');
 return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Báo cáo đo chiều cao chữ Hàn · Hangul Pixel OCR</title>
<style>
:root{--bg:#f4f6f3;--card:#fff;--border:#e0e4dd;--text:#1c241f;--muted:#647067;--primary:#1b5e3a;--warn:#d97706;--accent:#e11d48;}
*{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.45;}
header{background:#fff;border-bottom:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,.05);}
.brand{font-size:17px;font-weight:700;color:var(--primary);display:flex;align-items:center;gap:8px;}
.badge{background:#e8f5e9;color:var(--primary);font-size:11px;padding:3px 8px;border-radius:99px;font-weight:600;}
.actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.btn{background:#fff;border:1px solid var(--border);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;}
.btn:hover{background:#f0f2ee;}
.btn.active{background:var(--primary);color:#fff;border-color:var(--primary);}
.layout{max-width:1400px;margin:20px auto;padding:0 16px;display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start;}
@media (max-width:1040px){.layout{grid-template-columns:1fr;}}
aside{position:sticky;top:70px;}
.panel{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;}
.panel h2{margin:0 0 10px 0;font-size:15px;font-weight:700;}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
.stat-box{background:var(--bg);padding:10px;border-radius:6px;text-align:center;}
.stat-box b{display:block;font-size:20px;color:var(--primary);}
.stat-box span{font-size:11px;color:var(--muted);}
.tablewrap{max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--border);}
th{background:#fafbfa;color:var(--muted);font-weight:600;position:sticky;top:0;}
tr:hover td{background:#f0f7f2;cursor:pointer;}
tr.selected td{background:#e8f5e9;font-weight:700;}
.reader{display:flex;flex-direction:column;gap:24px;align-items:center;}
.page{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;width:100%;}
.pagehead{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:10px;}
.stage{position:relative;margin:0 auto;line-height:0;background:#eee;}
.stage img{width:100%;height:auto;display:block;}
.layer{position:absolute;inset:0;pointer-events:none;}
.box{position:absolute;pointer-events:auto;cursor:pointer;border:2px solid var(--primary);background:rgba(27,94,58,.12);box-sizing:border-box;}
.box:hover{background:rgba(27,94,58,.28);z-index:10;}
.box.review{border-color:var(--warn);background:rgba(217,119,6,.15);border-style:dashed;}
.box.review:hover{background:rgba(217,119,6,.3);}
.box.highlight{border-color:var(--accent)!important;background:rgba(225,29,72,.3)!important;box-shadow:0 0 0 2px #fff,0 0 6px var(--accent);z-index:20;}
.box.dim{opacity:.2;}
.label{position:absolute;left:100%;top:-2px;margin-left:3px;font-size:10px;font-family:monospace;font-weight:700;white-space:nowrap;background:var(--primary);color:#fff;padding:1px 4px;border-radius:3px;pointer-events:none;}
.box.review .label{background:var(--warn);}
.box.highlight .label{background:var(--accent);}
.hide-overlay .layer{display:none;}
dialog{border:none;border-radius:10px;padding:20px;max-width:440px;box-shadow:0 10px 30px rgba(0,0,0,.2);}
dialog::backdrop{background:rgba(0,0,0,.4);}
@media print{header,aside,.actions{display:none!important;}.layout{display:block;padding:0;}.page{border:none;padding:0;}}
</style>
</head>
<body>
<header>
  <div class="brand">한<span>HangulPixel · Báo cáo đo chữ</span><span class="badge" id="badge-total">0 kết quả</span></div>
  <div class="actions">
    <div>
      <button class="btn active" id="btn-symbol">Ký tự Hàn</button>
      <button class="btn" id="btn-line">Dòng chữ</button>
    </div>
    <label style="font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input type="checkbox" id="chk-overlay" checked> Hiện số đo
    </label>
    <label style="font-size:13px;display:flex;align-items:center;gap:6px;cursor:pointer;">
      <input type="checkbox" id="chk-uncertain" checked> Hiện kết quả cần kiểm tra
    </label>
    <label style="font-size:13px;display:flex;align-items:center;gap:6px;">
      Độ rộng <input type="range" id="rng-zoom" min="40" max="100" value="85">
    </label>
    <button class="btn" onclick="window.print()">🖨 In / Lưu PDF</button>
  </div>
</header>
<div class="layout">
  <main class="reader" id="pages-container"></main>
  <aside>
    <div class="panel">
      <h2>Bảng chiều cao <span id="lbl-kind" style="font-size:12px;color:var(--muted);font-weight:normal;">(Ký tự)</span></h2>
      <div class="stats">
        <div class="stat-box"><b id="stat-count">0</b><span>Kết quả đo</span></div>
        <div class="stat-box"><b id="stat-heights">0</b><span>Cỡ chiều cao</span></div>
      </div>
      <div id="selection-bar" style="display:none;background:#e8f5e9;padding:6px 10px;border-radius:6px;font-size:12px;margin-bottom:8px;justify-content:space-between;align-items:center;">
        <span>Đang chọn: <b id="sel-h"></b></span>
        <button class="btn" style="padding:2px 8px;font-size:11px;" onclick="selectHeight(null)">Bỏ chọn</button>
      </div>
      <div class="tablewrap">
        <table>
          <thead><tr><th>Chiều cao</th><th>Số lượng</th><th>Số ảnh</th></tr></thead>
          <tbody id="tbl-summary"></tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <h2>Ghi chú</h2>
      <p style="font-size:12px;color:var(--muted);margin:0 0 6px 0;">• Khung xanh: Ký tự hoặc dòng chữ rõ ràng.</p>
      <p style="font-size:12px;color:var(--muted);margin:0 0 6px 0;">• Khung cam nét đứt: Cần kiểm tra (chữ nghiêng/mờ/chạm biên).</p>
      <p style="font-size:12px;color:var(--muted);margin:0;">• Bấm vào bất kỳ khung nào trên ảnh hoặc hàng trong bảng để xem chi tiết.</p>
    </div>
  </aside>
</div>
<dialog id="modal-info">
  <h3 id="modal-title" style="margin-top:0;"></h3>
  <p id="modal-desc" style="font-size:13px;line-height:1.6;"></p>
  <pre id="modal-src" style="max-height:160px;overflow:auto;background:#f5f5f5;padding:8px;border-radius:6px;font-size:11px;white-space:pre-wrap;"></pre>
  <div style="text-align:right;margin-top:12px;"><button class="btn" onclick="document.getElementById('modal-info').close()">Đóng</button></div>
</dialog>
<script>
const DATA = ${rawJson};
let currentKind = 'symbol', selectedHeight = null;
const $ = s => document.querySelector(s);
function getRows() {
  const incUncertain = $('#chk-uncertain').checked;
  return DATA.flatMap(p => (p.results||[]).map(r => ({...r, pageName: p.name}))).filter(r => r.kind === currentKind && (incUncertain || !r.review));
}
function selectHeight(h) {
  selectedHeight = selectedHeight === h ? null : h;
  renderSummary();
  renderPages();
}
function renderSummary() {
  const rows = getRows();
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.h)) groups.set(r.h, {count: 0, images: new Set()});
    groups.get(r.h).count++;
    groups.get(r.h).images.add(r.pageName);
  }
  $('#stat-count').textContent = rows.length;
  $('#stat-heights').textContent = groups.size;
  $('#badge-total').textContent = rows.length + ' kết quả';
  $('#lbl-kind').textContent = currentKind === 'symbol' ? '(Ký tự)' : '(Dòng chữ)';
  const bar = $('#selection-bar');
  if (selectedHeight !== null) {
    bar.style.display = 'flex';
    $('#sel-h').textContent = selectedHeight + ' px';
  } else {
    bar.style.display = 'none';
  }
  const tbody = $('#tbl-summary');
  tbody.innerHTML = '';
  for (const [h, g] of [...groups].sort((a,b) => a[0] - b[0])) {
    const tr = document.createElement('tr');
    if (selectedHeight === h) tr.className = 'selected';
    tr.innerHTML = '<td><b>' + h + ' px</b></td><td>' + g.count + '</td><td>' + g.images.size + '</td>';
    tr.onclick = () => selectHeight(h);
    tbody.appendChild(tr);
  }
}
function renderPages() {
  const container = $('#pages-container');
  container.innerHTML = '';
  const incUncertain = $('#chk-uncertain').checked;
  const zoom = $('#rng-zoom').value;
  for (const p of DATA) {
    const pageRows = (p.results||[]).filter(r => r.kind === currentKind && (incUncertain || !r.review));
    const article = document.createElement('article');
    article.className = 'page';
    article.innerHTML = '<div class="pagehead"><span>' + p.name + ' · ' + p.w + ' × ' + p.h + ' px</span><span>' + pageRows.length + ' kết quả</span></div>';
    const stage = document.createElement('div');
    stage.className = 'stage';
    stage.style.width = zoom + '%';
    stage.style.aspectRatio = p.w + '/' + p.h;
    const img = document.createElement('img');
    img.src = p.url;
    img.loading = 'lazy';
    const layer = document.createElement('div');
    layer.className = 'layer';
    for (const r of pageRows) {
      const b = document.createElement('div');
      let cls = 'box' + (r.review ? ' review' : '');
      if (selectedHeight !== null) cls += (r.h === selectedHeight ? ' highlight' : ' dim');
      b.className = cls;
      b.style.left = (r.x / p.w * 100) + '%';
      b.style.top = (r.y / p.h * 100) + '%';
      b.style.width = (r.w / p.w * 100) + '%';
      b.style.height = (r.h / p.h * 100) + '%';
      b.title = (r.text || 'Chữ') + ' · ' + r.h + ' px';
      const lbl = document.createElement('span');
      lbl.className = 'label';
      lbl.textContent = (r.review ? '? ' : '') + (r.kind === 'line' ? 'Dòng: ' : '') + r.h + ' px';
      b.appendChild(lbl);
      b.onclick = (e) => {
        e.stopPropagation();
        $('#modal-title').textContent = r.text || 'Khung đo ' + r.h + ' px';
        $('#modal-desc').innerHTML = '<b>Ảnh:</b> ' + p.name + '<br><b>Loại:</b> ' + (r.kind==='symbol'?'Ký tự':'Dòng chữ') + '<br><b>Chiều cao:</b> ' + r.h + ' px · <b>Chiều rộng:</b> ' + r.w + ' px<br><b>Tọa độ [x, y, x2, y2]:</b> [' + r.x + ', ' + r.y + ', ' + (r.x+r.w) + ', ' + (r.y+r.h) + ']<br>' + (r.engines ? '<b>Công nghệ:</b> ' + r.engines.join(', ') + '<br>' : '') + (r.reviewReasons && r.reviewReasons.length ? '<b>Lưu ý:</b> ' + r.reviewReasons.join('; ') : '');
        $('#modal-src').textContent = r.sources ? JSON.stringify(r.sources, null, 2) : '';
        $('#modal-info').showModal();
      };
      layer.appendChild(b);
    }
    stage.append(img, layer);
    article.appendChild(stage);
    container.appendChild(article);
  }
}
$('#btn-symbol').onclick = () => { currentKind = 'symbol'; $('#btn-symbol').classList.add('active'); $('#btn-line').classList.remove('active'); renderSummary(); renderPages(); };
$('#btn-line').onclick = () => { currentKind = 'line'; $('#btn-line').classList.add('active'); $('#btn-symbol').classList.remove('active'); renderSummary(); renderPages(); };
$('#chk-overlay').onchange = e => $('#pages-container').classList.toggle('hide-overlay', !e.target.checked);
$('#chk-uncertain').onchange = () => { renderSummary(); renderPages(); };
$('#rng-zoom').oninput = e => { document.querySelectorAll('.stage').forEach(s => s.style.width = e.target.value + '%'); };
renderSummary();
renderPages();
<\\/script>
</body>
</html>`;
}
$('#choose').onclick=()=>$('#files').click();$('#files').onchange=e=>{const files=Array.from(e.target.files);e.target.value='';void add(files)};for(const ev of ['dragenter','dragover'])$('#drop').addEventListener(ev,e=>{e.preventDefault();$('#drop').classList.add('over')});$('#drop').ondragleave=()=>$('#drop').classList.remove('over');$('#drop').ondrop=e=>{e.preventDefault();$('#drop').classList.remove('over');add(e.dataTransfer.files)};$('#run').onclick=()=>$('#multi').checked?runMulti():run();$('#stop').onclick=()=>{cancel=true;status('Sẽ dừng sau lượt OCR hiện tại…');if(activeJob&&multiToken)void fetch('/api/jobs/'+activeJob+'/cancel',{method:'POST',headers:{'X-Hangul-Token':multiToken}})};$('#clear').onclick=()=>{if(busy||loading)return;for(const p of pages)URL.revokeObjectURL(p.url);pages.length=0;selected=null;renderPages();refresh();status('Sẵn sàng bắt đầu')};$('#zoom').oninput=()=>{for(const p of pages){p.el.querySelector('.stage').style.width=$('#zoom').value+'%';layoutLabels(p)}};$('#overlay').onchange=()=>$('#pages').classList.toggle('hide-overlay',!$('#overlay').checked);$('#scope').onchange=()=>{selected=null;refresh()};$('#confident').onchange=refresh;$('#uncertain').onchange=refresh;document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{kind=b.dataset.kind;selected=null;document.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x===b));refresh()});$('#prev').onclick=()=>navigate(-1);$('#next').onclick=()=>navigate(1);$('#unfilter').onclick=()=>{selected=null;refresh()};$('#csv').onclick=()=>{const rows=visibleRows(),groups=new Map;for(const r of rows){if(!groups.has(r.h))groups.set(r.h,{n:0,imgs:new Set});groups.get(r.h).n++;groups.get(r.h).imgs.add(r.page.id)}download('tong-hop-chieu-cao.csv','\uFEFFLoại,Chiều cao (px),Số lượng,Số ảnh\r\n'+[...groups].sort((a,b)=>a[0]-b[0]).map(([h,g])=>[kind,h,g.n,g.imgs.size].join(',')).join('\r\n'),'text/csv;charset=utf-8')};$('#json').onclick=()=>download('hangul-pixel-chi-tiet.json',JSON.stringify({method:'Original image pixels; axis-aligned; OCR boxes refined by local contrast. OCR may miss or mis-segment characters.',images:ordered().map(({name,w,h,state,results,engineReports,jobId})=>({name,width:w,height:h,state,results,engineReports,jobId}))},null,2),'application/json');if($('#html'))$('#html').onclick=()=>void exportHTMLReport();$('#help').onclick=()=>$('#info').showModal();$('#sample').onclick=async()=>{try{const r=await fetch('sample.jpg');if(!r.ok)throw Error();const b=await r.blob();await add([new File([b],'001.jpg',{type:'image/jpeg'})]);status('Ảnh mẫu đã tải · bấm Phân tích ảnh')}catch{status('Không tải được ảnh mẫu')}};window.addEventListener('resize',()=>pages.forEach(layoutLabels));

let multiToken=null,activeJob=null;
async function initMulti(){
 try{const response=await fetch('/api/health');if(!response.ok)return;const data=await response.json();if(data.mode!=='local-multi')return;
 multiToken=data.token;$('#multi').disabled=false;$('#multi').checked=true;
 $('#multi-status').textContent=data.engines.map(e=>e.engine+': '+(e.installed?'có thư viện, kiểm tra mô hình khi chạy':'chưa cài')).join(' · ')+'. Mỗi ảnh bắt buộc thử cả ba; lỗi được báo riêng.';
 }catch(e){$('#multi-status').textContent='Không kết nối được backend Python: '+e.message;}
}
async function runMulti(){
 if(busy||loading||!pages.length)return;
 if(!multiToken){status('Hãy mở bản Python tại http://127.0.0.1:8765 để quét nhiều công nghệ');return;}
 busy=true;cancel=false;selected=null;kind='line';document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('active',b.dataset.kind==='line'));
 $('#confident').checked=false;$('#uncertain').checked=true;refresh();let complete=0,partial=0;
 try{for(const [index,p]of ordered().entries()){
 if(cancel)break;p.results=[];p.engineReports=[];p.state='Đang gửi ảnh tới backend trên máy';refresh();
 try{const image=await (await fetch(p.url)).blob();const reqViews=$('#accurate').checked?'original,contrast':'original';const reply=await fetch('/api/jobs?name='+encodeURIComponent(p.name)+'&views='+reqViews,{method:'POST',headers:{'X-Hangul-Token':multiToken},body:image});
 const created=await reply.json();if(!reply.ok)throw Error(created.error||'Không tạo được tác vụ');activeJob=p.jobId=created.id;
 let previous='';
 while(true){const response=await fetch('/api/jobs/'+created.id);if(!response.ok)throw Error('Không đọc được tiến độ');const job=await response.json();
 if(cancel&&job.state==='running'){await fetch('/api/jobs/'+created.id+'/cancel',{method:'POST',headers:{'X-Hangul-Token':multiToken}});}
 const revision=job.completedPasses+':'+job.state+':'+JSON.stringify(job.engineReports);
 if(revision!==previous){p.results=job.results||[];p.engineReports=job.engineReports||[];previous=revision;}
 p.state=`Ảnh ${index+1}/${pages.length} · ${job.message} · ${job.completedPasses||0}/${job.totalPasses||'?'} lượt`;
 status(p.state);refresh();
 if(['complete','partial','error','cancelled','interrupted'].includes(job.state)){
 if(job.state==='complete')complete++;else partial++;
 const reports=(job.engineReports||[]).map(e=>e.engine+': '+e.state+(e.errors.length?' ('+e.errors.join('; ')+')':'')).join(' · ');
 p.state=(job.state==='complete'?'Xong đủ 3 công nghệ':'Chưa hoàn tất đủ 3 công nghệ')+' · '+reports;refresh();break;
 }
 await new Promise(resolve=>setTimeout(resolve,1200));
 }
 }catch(e){p.state='Lỗi: '+e.message;partial++;refresh();}
 activeJob=null;
 }
 status(`${complete} ảnh đủ 3 công nghệ · ${partial} ảnh lỗi/chưa hoàn tất${cancel?' · Đã dừng':''}`);
 }finally{busy=false;activeJob=null;refresh();}
}
initMulti();
