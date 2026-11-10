const $=id=>document.getElementById(id);
const a=$('a');
const MAXPIN=20;
let tracks=[],cur=-1,shuffle=false,bag=[],hist=[],onlyMusic=false,db;
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function openDB(){return new Promise((ok,err)=>{const r=indexedDB.open('musica',1);r.onupgradeneeded=()=>r.result.createObjectStore('t',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);});}
const store=m=>db.transaction('t',m).objectStore('t');
const save=t=>new Promise(ok=>{const r=store('readwrite').put({id:t.id,name:t.name,type:t.type,pinned:t.pinned,played:t.played,blob:t.blob});r.onsuccess=r.onerror=ok;});
const loadAll=()=>new Promise(ok=>{const r=store('readonly').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>ok([]);});
const pool=()=>tracks.map((_,i)=>i).filter(i=>!onlyMusic||tracks[i].type==='musica');
function li(t){
  const i=tracks.indexOf(t);
  return `<li class="${i===cur?'on':''}" data-i="${i}"><span>${t.type==='podcast'?'🎙 ':''}${esc(t.name)}</span><button class="pin" data-p="${i}">${t.pinned?'📌':'📍'}</button></li>`;
}
function render(){
  const v=tracks.filter(t=>!onlyMusic||t.type==='musica');
  const pins=v.filter(t=>t.pinned);
  const rec=v.filter(t=>t.played).sort((x,y)=>y.played-x.played).slice(0,10);
  $('pins').innerHTML=pins.map(li).join('')||'<li class="vacio">Toca 📍 para fijar (hasta 20)</li>';
  $('rec').innerHTML=rec.map(li).join('')||'<li class="vacio">Aún nada</li>';
  $('list').innerHTML=v.map(li).join('')||'<li class="vacio">Agrega música</li>';
}
function load(i){
  cur=i;const t=tracks[i];t.played=Date.now();save(t);
  a.src=t.url;a.play();
  $('title').textContent=t.name;$('play').textContent='⏸';render();
}
function refill(){
  bag=pool().filter(i=>i!==cur);
  for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
}
function next(){
  const p=pool();if(!p.length)return;
  if(shuffle){
    bag=bag.filter(i=>p.includes(i));
    if(!bag.length)refill();
    if(!bag.length)return load(p[0]);
    if(cur>=0)hist.push(cur);
    load(bag.pop());
  }else load(p[(p.indexOf(cur)+1)%p.length]);
}
function prev(){
  const p=pool();if(!p.length)return;
  if(a.currentTime>3){a.currentTime=0;return;}
  if(shuffle){if(hist.length)load(hist.pop());}
  else{const k=Math.max(p.indexOf(cur),0);load(p[(k-1+p.length)%p.length]);}
}
$('files').onchange=async e=>{
  for(const f of e.target.files){
    const t={id:Date.now()+Math.random(),name:f.name.replace(/\.[^.]+$/,''),type:$('type').value,pinned:false,played:0,blob:f,url:URL.createObjectURL(f)};
    tracks.push(t);await save(t);
  }
  bag=[];render();
};
document.querySelector('main').onclick=e=>{
  const pb=e.target.closest('.pin');
  if(pb){
    const t=tracks[+pb.dataset.p];
    if(!t.pinned&&tracks.filter(x=>x.pinned).length>=MAXPIN){alert('Máximo '+MAXPIN+' fijados');return;}
    t.pinned=!t.pinned;save(t);render();return;
  }
  const l=e.target.closest('li[data-i]');if(l)load(+l.dataset.i);
};
$('only').onchange=e=>{onlyMusic=e.target.checked;bag=[];render();};
$('play').onclick=()=>{
  if(!tracks.length)return;
  if(cur<0)return next();
  if(a.paused){a.play();$('play').textContent='⏸';}else{a.pause();$('play').textContent='▶';}
};
$('next').onclick=next;$('prev').onclick=prev;
$('shuf').onclick=()=>{shuffle=!shuffle;hist=[];bag=[];$('shuf').classList.toggle('act',shuffle);};
a.onended=next;
a.ontimeupdate=()=>{if(a.duration)$('seek').value=a.currentTime/a.duration*100;};
$('seek').oninput=e=>{if(a.duration)a.currentTime=e.target.value/100*a.duration;};
(async()=>{
  db=await openDB();
  for(const r of await loadAll()){r.url=URL.createObjectURL(r.blob);tracks.push(r);}
  render();
})();
$('sur').onclick=()=>{
  const p=pool();if(!p.length)return;
  const nuevos=p.filter(i=>!tracks[i].played);
  const viejos=p.filter(i=>i!==cur).sort((x,y)=>tracks[x].played-tracks[y].played).slice(0,Math.max(1,Math.ceil(p.length/2)));
  const arr=nuevos.length?nuevos:(viejos.length?viejos:p);
  load(arr[Math.floor(Math.random()*arr.length)]);
};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
