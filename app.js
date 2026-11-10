const $=id=>document.getElementById(id);
const a=$('a'),MAXPIN=20,API='https://api.audius.co/v1',APP='MiMusicaClon';
const EXT=/\.(mp3|m4a|aac|ogg|opus|wav|flac|wma)$/i;
let tracks=[],cur=-1,shuffle=false,bag=[],hist=[],onlyMusic=false,db,results=[];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function openDB(){return new Promise((ok,err)=>{const r=indexedDB.open('musica',1);r.onupgradeneeded=()=>r.result.createObjectStore('t',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);});}
const store=m=>db.transaction('t',m).objectStore('t');
const save=t=>new Promise(ok=>{const r=store('readwrite').put({id:t.id,key:t.key,name:t.name,type:t.type,pinned:t.pinned,played:t.played,blob:t.blob,remote:t.remote,aid:t.aid,native:t.native,uri:t.uri,src:t.src,jurl:t.jurl});r.onsuccess=r.onerror=ok;});
const loadAll=()=>new Promise(ok=>{const r=store('readonly').getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>ok([]);});
const pool=()=>tracks.map((_,i)=>i).filter(i=>!onlyMusic||tracks[i].type==='musica');
function li(t){
  const i=tracks.indexOf(t);
  const dl=t.remote?(t.blob?'<span>✅</span>':`<button class="pin" data-d="${i}">⬇</button>`):'';
  return `<li class="${i===cur?'on':''}" data-i="${i}"><span>${t.type==='podcast'?'🎙 ':''}${esc(t.name)}</span><span>${dl}<button class="pin" data-p="${i}">${t.pinned?'📌':'📍'}</button></span></li>`;
}
function render(){
  const v=tracks.filter(t=>!onlyMusic||t.type==='musica');
  const pins=v.filter(t=>t.pinned);
  const rec=v.filter(t=>t.played).sort((x,y)=>y.played-x.played).slice(0,10);
  $('pins').innerHTML=pins.map(li).join('')||'<li class="vacio">Toca 📍 para fijar (hasta 20)</li>';
  $('rec').innerHTML=rec.map(li).join('')||'<li class="vacio">Aún nada</li>';
  $('list').innerHTML=v.map(li).join('')||'<li class="vacio">Importa o busca música</li>';
}
const getKey=()=>localStorage.getItem('audiusKey')||'';
async function aj(path,params={}){
  const q=new URLSearchParams({app_name:APP,...params});
  const h=getKey()?{Authorization:'Bearer '+getKey()}:{};
  const r=await fetch(API+path+'?'+q,{headers:h});
  if(!r.ok)throw new Error(r.status);
  return (await r.json()).data;
}
const streamUrl=id=>aj('/tracks/'+id+'/stream',{no_redirect:'true'});
async function playSrc(t){
  try{
    a.src=await srcOf(t);
    await a.play();
  }catch(err){$('title').textContent='⚠ No se pudo reproducir';$('play').textContent='▶';}
}
function load(i){
  cur=i;const t=tracks[i];t.played=Date.now();save(t);
  playSrc(t);
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
async function importar(files){
  const have=new Set(tracks.filter(t=>t.key).map(t=>t.key));
  let n=0,saltadas=0;
  for(const f of files){
    if(!f.type.startsWith('audio/')&&!EXT.test(f.name))continue;
    const nombre=f.name.replace(EXT,'');
    const key=nombre+'|'+f.size;
    if(have.has(key)){saltadas++;continue;}
    have.add(key);
    const t={id:Date.now()+Math.random(),key,name:nombre,type:$('type').value,pinned:false,played:0,blob:f,url:URL.createObjectURL(f)};
    tracks.push(t);await save(t);n++;
    $('title').textContent='Importando… '+n;
  }
  $('title').textContent=n+' nuevas'+(saltadas?' ('+saltadas+' ya estaban)':'');
  bag=[];render();
}
async function walk(d,out){
  for await(const [n,h] of d.entries()){
    if(h.kind==='file')out.push(await h.getFile());else await walk(h,out);
  }
}
$('imp').onclick=async()=>{
  if(window.showDirectoryPicker){
    try{const d=await showDirectoryPicker();const fs=[];await walk(d,fs);return importar(fs);}catch(e){return;}
  }
  $('files').click();
};
$('files').onchange=e=>{const fs=[...e.target.files];e.target.value='';importar(fs);};
$('dir').onchange=e=>{const fs=[...e.target.files];e.target.value='';importar(fs);};
async function bajar(t,btn){
  btn.textContent='⏳';
  try{
    const r=await fetch(await streamUrl(t.aid));
    if(!r.ok)throw new Error(r.status);
    t.blob=await r.blob();t.url=URL.createObjectURL(t.blob);
    await save(t);
  }catch(err){alert('No se pudo descargar: '+err.message);}
  render();
}
document.querySelector('main').onclick=e=>{
  const db_=e.target.closest('[data-d]');
  if(db_){bajar(tracks[+db_.dataset.d],db_);return;}
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
$('sur').onclick=()=>{
  const p=pool();if(!p.length)return;
  const nuevos=p.filter(i=>!tracks[i].played);
  const viejos=p.filter(i=>i!==cur).sort((x,y)=>tracks[x].played-tracks[y].played).slice(0,Math.max(1,Math.ceil(p.length/2)));
  const arr=nuevos.length?nuevos:(viejos.length?viejos:p);
  load(arr[Math.floor(Math.random()*arr.length)]);
};
async function buscar(){
  const q=$('q').value.trim();if(!q)return;
  $('res').innerHTML='<li class="vacio">Buscando…</li>';
  try{
    results=await aj('/tracks/search',{query:q,limit:15});
    $('res').innerHTML=results.map((r,i)=>`<li data-r="${i}"><span>${esc(r.title)} · ${esc(r.user.name)}</span><span>＋</span></li>`).join('')||'<li class="vacio">Sin resultados</li>';
  }catch(err){
    $('res').innerHTML='<li class="vacio">Error de búsqueda ('+esc(err.message)+'). Si es 401 o 403, toca 🔑 y pega tu API key de Audius.</li>';
  }
}
$('go').onclick=buscar;
$('q').onkeydown=e=>{if(e.key==='Enter')buscar();};
$('res').onclick=async e=>{
  const l=e.target.closest('li[data-r]');if(!l)return;
  const r=results[+l.dataset.r];
  let t=tracks.find(x=>x.aid===r.id);
  if(!t){
    t={id:Date.now()+Math.random(),name:r.title+' · '+r.user.name,type:'musica',pinned:false,played:0,remote:true,aid:r.id};
    tracks.push(t);await save(t);
  }
  load(tracks.indexOf(t));
};
$('setkey').onclick=()=>{
  const k=prompt('API key de Audius (opcional)',getKey());
  if(k!==null)localStorage.setItem('audiusKey',k.trim());
};
a.onended=next;
a.ontimeupdate=()=>{if(a.duration)$('seek').value=a.currentTime/a.duration*100;};
$('seek').oninput=e=>{if(a.duration)a.currentTime=e.target.value/100*a.duration;};
(async()=>{
  db=await openDB();
  for(const r of await loadAll()){
    if(r.blob){r.url=URL.createObjectURL(r.blob);if(!r.key)r.key=r.name+'|'+r.blob.size;}
    tracks.push(r);
  }
  render();
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();autoScan();
})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');

const NATIVE=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
function ms(){
  const P=window.Capacitor&&Capacitor.Plugins||{};
  return P.CapacitorMediaStore||Object.values(P).find(p=>p&&typeof p.getMediasByType==='function');
}
async function srcOf(t){
  if(t.native)return Capacitor.convertFileSrc(t.uri);
  if(t.remote&&!t.blob)return await streamUrl(t.aid);
  return t.url;
}
const delDB=id=>new Promise(ok=>{const r=store('readwrite').delete(id);r.onsuccess=r.onerror=ok;});
async function escanear(){
  const m=ms();
  if(!m){alert('Plugin no encontrado. Plugins: '+Object.keys(Capacitor.Plugins||{}).join(', '));return;}
  $('title').textContent='Escaneando…';
  try{
    await m.requestPermissions({types:['audio']});
    const seen=new Set();let found=[],off=0;
    while(true){
      const r=await m.getMediasByType({mediaType:'audio',sortBy:'TITLE',includeExternal:true,limit:500,offset:off});
      const page=r.media||[];
      if(!page.length||seen.has(page[0].id))break;
      page.forEach(x=>seen.add(x.id));found.push(...page);
      if(page.length<500)break;
      off+=500;
    }
    found=found.filter(x=>!(x.duration<30000));
    const have=new Set(tracks.map(t=>t.key));
    let n=0;
    for(const x of found){
      const key='dev:'+x.id;
      if(have.has(key))continue;
      const art=x.artist&&!/unknown/i.test(x.artist)?' · '+x.artist:'';
      const t={id:key,key,name:(x.title||String(x.displayName).replace(EXT,''))+art,type:'musica',pinned:false,played:0,native:true,uri:x.uri};
      tracks.push(t);await save(t);n++;
      if(n%50===0)$('title').textContent='Escaneando… '+n;
    }
    if(found.length){
      const ids=new Set(found.map(x=>'dev:'+x.id));
      const ct=tracks[cur];
      const gone=tracks.filter(t=>t.native&&!ids.has(t.key));
      for(const t of gone)await delDB(t.id);
      tracks=tracks.filter(t=>!gone.includes(t));
      cur=ct?tracks.indexOf(ct):-1;
    }
    $('title').textContent=n+' canciones nuevas del teléfono';
    bag=[];render();
  }catch(err){$('title').textContent='⚠ Escaneo falló: '+(err.message||err);}
}
function autoScan(){if(NATIVE)escanear();}
if(NATIVE){
  const b=document.createElement('button');
  b.className='btn';b.textContent='🔄 Escanear';b.onclick=escanear;
  $('opts').prepend(b);
}

/* ---- Segundo plano y notificación ---- */
function msess(){
  const P=window.Capacitor&&Capacitor.Plugins||{};
  return P.MediaSession||Object.values(P).find(p=>p&&typeof p.setActionHandler==='function'&&typeof p.setMetadata==='function');
}
function sesState(st){const s=NATIVE&&msess();if(s)s.setPlaybackState({playbackState:st}).catch(()=>{});}
function sesMeta(t){
  const s=NATIVE&&msess();if(!s||!t)return;
  const p=t.name.split(' · ');
  s.setMetadata({title:p[0],artist:p[1]||'',album:'Mi Música',artwork:[]}).catch(()=>{});
  if(isFinite(a.duration))s.setPositionState({duration:a.duration,position:a.currentTime,playbackRate:1}).catch(()=>{});
}
a.addEventListener('play',()=>{$('play').textContent='⏸';sesMeta(tracks[cur]);sesState('playing');});
a.addEventListener('pause',()=>{$('play').textContent='▶';sesState('paused');});
a.addEventListener('loadedmetadata',()=>sesMeta(tracks[cur]));
if(NATIVE){
  const s=msess();
  if(s){
    const h=(act,fn)=>s.setActionHandler({action:act},fn).catch(()=>{});
    h('play',()=>a.play());
    h('pause',()=>a.pause());
    h('nexttrack',next);
    h('previoustrack',prev);
    h('seekto',d=>{if(d&&d.seekTime!=null)a.currentTime=d.seekTime;});
  }
}

/* ---- Jamendo (sobrescribe funciones anteriores) ---- */
const getJKey=()=>localStorage.getItem('jamendoKey')||'';
async function jamSearch(q){
  const k=getJKey();if(!k)return [];
  const r=await fetch('https://api.jamendo.com/v3.0/tracks/?'+new URLSearchParams({client_id:k,format:'json',limit:15,search:q}));
  if(!r.ok)throw new Error(r.status);
  const j=await r.json();
  return (j.results||[]).map(x=>({src:'jamendo',id:'j'+x.id,title:x.name,artist:x.artist_name,url:x.audio}));
}
async function srcOf(t){
  if(t.native)return Capacitor.convertFileSrc(t.uri);
  if(t.blob)return t.url;
  if(t.remote)return t.src==='jamendo'?t.jurl:await streamUrl(t.aid);
  return t.url;
}
async function bajar(t,btn){
  btn.textContent='⏳';
  try{
    const r=await fetch(t.src==='jamendo'?t.jurl:await streamUrl(t.aid));
    if(!r.ok)throw new Error(r.status);
    t.blob=await r.blob();t.url=URL.createObjectURL(t.blob);
    await save(t);
  }catch(err){alert('No se pudo descargar: '+err.message);}
  render();
}
async function buscar(){
  const q=$('q').value.trim();if(!q)return;
  $('res').innerHTML='<li class="vacio">Buscando…</li>';
  const [ra,rj]=await Promise.allSettled([aj('/tracks/search',{query:q,limit:15}),jamSearch(q)]);
  results=[];let msg='';
  if(ra.status==='fulfilled')results.push(...ra.value.map(r=>({src:'audius',id:r.id,title:r.title,artist:r.user.name})));
  else msg+='Audius: error '+esc(ra.reason.message)+'. ';
  if(rj.status==='fulfilled')results.push(...rj.value);
  else msg+='Jamendo: error '+esc(rj.reason.message)+'. ';
  if(!getJKey())msg+='Toca 🔑 para activar Jamendo. ';
  $('res').innerHTML=results.map((r,i)=>`<li data-r="${i}"><span>${esc(r.title)} · ${esc(r.artist)} <small>(${r.src})</small></span><span>＋</span></li>`).join('')+(msg?`<li class="vacio">${msg}</li>`:(results.length?'':'<li class="vacio">Sin resultados</li>'));
}
$('go').onclick=buscar;
$('res').onclick=async e=>{
  const l=e.target.closest('li[data-r]');if(!l)return;
  const r=results[+l.dataset.r];
  let t=tracks.find(x=>x.aid===r.id);
  if(!t){
    t={id:Date.now()+Math.random(),name:r.title+' · '+r.artist,type:'musica',pinned:false,played:0,remote:true,aid:r.id,src:r.src,jurl:r.url};
    tracks.push(t);await save(t);
  }
  load(tracks.indexOf(t));
};
$('setkey').onclick=()=>{
  const j=prompt('Client ID de Jamendo (gratis en developer.jamendo.com). Vacío = desactivar',getJKey());
  if(j!==null)localStorage.setItem('jamendoKey',j.trim());
  const k=prompt('API key de Audius (opcional)',getKey());
  if(k!==null)localStorage.setItem('audiusKey',k.trim());
};
