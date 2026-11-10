/* ===== NUCLEO ===== */
const $=s=>document.querySelector(s);
const a=$('#a');
const NATIVE=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
const EXT=/\.(mp3|m4a|aac|ogg|opus|wav|flac|wma)$/i;
const API='https://api.audius.co/v1',APP='MiMusicaClon';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=s=>isFinite(s)?Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0'):'0:00';
const cfg={only:false};
let db,tracks=[],lists=[],Q=[],cur=null,shuffle=false,bag=[],hist=[],objUrl=null;
const res={trend:[],search:[]};
let chgT,avT,fuT,shT,sid=0,sgen='';
/* ---- Imagenes: precarga, miniaturas y aparicion suave ---- */
const warm=new Set();
const sm=(u,px)=>u&&px<=100&&u.includes('480x480')?u.replace('480x480','150x150'):u;
function imgOk(i){i.classList.add('ld');warm.add(i.getAttribute('src'));}
function imgBad(i){const o=i.dataset.o;if(o&&i.getAttribute('src')!==o)i.src=o;else i.remove();}
function preload(urls,ms){
  urls=[...new Set(urls.filter(Boolean))];
  if(!urls.length)return Promise.resolve();
  return Promise.race([
    Promise.all(urls.map(u=>new Promise(ok=>{const i=new Image();i.onload=()=>{warm.add(u);ok();};i.onerror=()=>ok();i.src=u;}))),
    new Promise(ok=>setTimeout(ok,ms||2500))
  ]);
}
function animView(k){
  const v=$('#view');v.classList.remove('a-tab','a-push','a-pop','a-chip');void v.offsetWidth;v.classList.add('a-'+k);
  clearTimeout(avT);avT=setTimeout(()=>v.classList.remove('a-'+k),750);
}

function openDB(){return new Promise((ok,err)=>{
  const r=indexedDB.open('musica2',1);
  r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('t',{keyPath:'id'});d.createObjectStore('p',{keyPath:'id'});d.createObjectStore('b');};
  r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);
});}
const tx=(s,m)=>db.transaction(s,m).objectStore(s);
const req=r=>new Promise(ok=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>ok(undefined);});
const save=t=>{const {url,...m}=t;return req(tx('t','readwrite').put(m));};
const saveL=l=>req(tx('p','readwrite').put(l));
const delT=id=>{req(tx('t','readwrite').delete(id));req(tx('b','readwrite').delete(id));};
const putBlob=(id,b)=>req(tx('b','readwrite').put(b,id));
const getBlob=id=>req(tx('b','readonly').get(id));

/* ---- Audius ---- */
async function aj(path,params){
  const q=new URLSearchParams(Object.assign({app_name:APP},params||{}));
  const k=localStorage.getItem('audiusKey')||'';
  const r=await fetch(API+path+'?'+q,{headers:k?{Authorization:'Bearer '+k}:{}});
  if(!r.ok)throw new Error(r.status);
  return (await r.json()).data;
}
const streamUrl=id=>aj('/tracks/'+id+'/stream',{no_redirect:'true'});
async function addRemote(r){
  let t=tracks.find(x=>x.aid===r.id);
  if(!t){t={id:uid(),name:r.title+' · '+r.user.name,type:'musica',played:0,remote:true,aid:r.id,art:artOf(r),aimg:picOf(r)};tracks.push(t);await save(t);}
  else if((!t.art&&artOf(r))||(!t.aimg&&picOf(r))){t.art=t.art||artOf(r);t.aimg=t.aimg||picOf(r);await save(t);}
  return t;
}

/* ---- Reproduccion ---- */
async function srcOf(t){
  if(t.native)return Capacitor.convertFileSrc(t.uri);
  if(t.hasBlob){const b=await getBlob(t.id);if(b){if(objUrl)URL.revokeObjectURL(objUrl);objUrl=URL.createObjectURL(b);return objUrl;}}
  if(t.remote)return await streamUrl(t.aid);
  throw new Error('sin fuente');
}
async function playSrc(t){
  try{const u=await srcOf(t);if(cur!==t)return;a.src=u;await a.play();}
  catch(e){if(cur===t&&e.name!=='AbortError')toast('No se pudo reproducir');}
}
/* ---- Caratulas de archivos locales (ID3 / m4a) ---- */
async function headOf(t){
  const N=524288;
  if(t.hasBlob){const b=await getBlob(t.id);return b?new Uint8Array(await b.slice(0,N).arrayBuffer()):null;}
  if(t.native){
    const r=await fetch(Capacitor.convertFileSrc(t.uri),{headers:{Range:'bytes=0-'+(N-1)}});
    const rd=r.body.getReader();const parts=[];let n=0;
    while(n<N){const x=await rd.read();if(x.done)break;parts.push(x.value);n+=x.value.length;}
    rd.cancel().catch(()=>{});
    const o=new Uint8Array(Math.min(n,N));let p=0;
    for(const c of parts){const k=Math.min(c.length,o.length-p);o.set(c.subarray(0,k),p);p+=k;if(p>=o.length)break;}
    return o;
  }
  return null;
}
function findArt(b){
  const be=(i,n)=>{let v=0;for(let k=0;k<n;k++)v=v*256+b[i+k];return v;};
  const ss=i=>((b[i]&127)<<21)|((b[i+1]&127)<<14)|((b[i+2]&127)<<7)|(b[i+3]&127);
  const str=(i,n)=>String.fromCharCode(...b.subarray(i,i+n));
  if(str(0,3)==='ID3'){
    const v=b[3],end=Math.min(b.length,10+ss(6));let i=10;
    while(i+10<end){
      const id=v===2?str(i,3):str(i,4),hl=v===2?6:10;
      const sz=v===2?be(i+3,3):v===4?ss(i+4):be(i+4,4);
      if(!sz||!/^[A-Z0-9]+$/.test(id))break;
      if(id==='APIC'||id==='PIC'){
        let j=i+hl;const enc=b[j++];
        if(v===2)j+=3;else{while(j<end&&b[j])j++;j++;}
        j++;
        if(enc===1||enc===2){while(j+1<end&&!(b[j]===0&&b[j+1]===0))j+=2;j+=2;}
        else{while(j<end&&b[j])j++;j++;}
        return b.subarray(j,Math.min(i+hl+sz,b.length));
      }
      i+=hl+sz;
    }
  }
  const c=str(0,b.length).indexOf('covr');
  if(c>0){
    const d=str(0,b.length).indexOf('data',c);
    if(d>0){const sz=be(d-4,4);return b.subarray(d+8,Math.min(d-4+sz,b.length));}
  }
  return null;
}
async function readArt(t,q){
  try{
    const h=await headOf(t);const img=h&&findArt(h);
    if(img&&img.length>16){
      const bm=await createImageBitmap(new Blob([img]));
      const k=Math.min(1,300/Math.max(bm.width,bm.height));
      const cv=document.createElement('canvas');cv.width=Math.round(bm.width*k);cv.height=Math.round(bm.height*k);
      cv.getContext('2d').drawImage(bm,0,0,cv.width,cv.height);
      t.art=cv.toDataURL('image/jpeg',.8);
    }else t.noart=true;
  }catch(e){t.noart=true;}
  await save(t);
  if(t.art){if(cur===t)sesMeta(t);if(!q)refresh();}
}
async function bgArt(){
  const L=tracks.filter(t=>!t.remote&&!t.art&&!t.noart).sort((x,y)=>(y.liked?1:0)-(x.liked?1:0)||(y.played||0)-(x.played||0)).slice(0,60);
  let n=0;
  for(const t of L){await readArt(t,true);if(t.art&&++n%10===0)refresh();}
  if(n%10)refresh();
}
function play(t){if(!t)return;cur=t;t.played=Date.now();t.plays=(t.plays||0)+1;save(t);playSrc(t);syncPlayer();if(!t.remote&&!t.art&&!t.noart)readArt(t);}
function playList(list,t,sh){
  Q=list.slice();if(sh!==undefined)shuffle=sh;bag=[];hist=[];
  if(!t)t=shuffle?Q[Math.floor(Math.random()*Q.length)]:Q[0];
  play(t);
}
function refill(){
  bag=Q.filter(x=>x!==cur);
  for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
}
function next(){
  if(!Q.length)return;
  if(shuffle){
    if(!bag.length)refill();
    if(!bag.length)return play(cur);
    if(cur)hist.push(cur);
    play(bag.pop());
  }else play(Q[(Q.indexOf(cur)+1)%Q.length]);
}
function prev(){
  if(!Q.length)return;
  if(a.currentTime>3){a.currentTime=0;return;}
  if(shuffle){if(hist.length)play(hist.pop());}
  else play(Q[(Q.indexOf(cur)-1+Q.length)%Q.length]);
}
function togglePlay(){
  if(!cur){const L=visible();if(L.length)playList(L,L[0]);return;}
  if(a.paused)a.play().catch(()=>{});else a.pause();
}

/* ---- Descargar, importar, escanear ---- */
async function bajar(t){
  if(!t.remote||t.hasBlob)return;
  toast('Descargando…');
  try{
    const r=await fetch(await streamUrl(t.aid));
    if(!r.ok)throw new Error(r.status);
    await putBlob(t.id,await r.blob());t.hasBlob=true;await save(t);toast('Descargada ✓');
  }catch(e){toast('No se pudo descargar: '+e.message);}
  refresh();
}
async function importar(files){
  const have=new Set(tracks.map(t=>t.key).filter(Boolean));
  let n=0,dup=0;
  for(const f of files){
    if(!f.type.startsWith('audio/')&&!EXT.test(f.name))continue;
    const nombre=f.name.replace(EXT,'');const key=nombre+'|'+f.size;
    if(have.has(key)){dup++;continue;}
    have.add(key);
    const t={id:uid(),key,name:nombre,type:'musica',played:0,hasBlob:true};
    await putBlob(t.id,f);tracks.push(t);await save(t);n++;
    if(n%10===0)toast('Importando… '+n);
  }
  toast(n+' nuevas'+(dup?' ('+dup+' ya estaban)':''));refresh();
}
async function walk(d,out){for await(const [n,h] of d.entries()){if(h.kind==='file')out.push(await h.getFile());else await walk(h,out);}}
async function pickMusic(){
  if(window.showDirectoryPicker&&!NATIVE){
    try{const d=await showDirectoryPicker();const fs=[];await walk(d,fs);return importar(fs);}catch(e){return;}
  }
  $('#files').click();
}
function ms(){
  const P=window.Capacitor&&Capacitor.Plugins||{};
  return P.CapacitorMediaStore||Object.values(P).find(p=>p&&typeof p.getMediasByType==='function');
}
async function escanear(){
  const m=ms();
  if(!m){toast('Plugin de música no encontrado');return;}
  toast('Escaneando…');
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
    const have=new Set(tracks.map(t=>t.key));let n=0;
    for(const x of found){
      const key='dev:'+x.id;if(have.has(key))continue;
      const art=x.artist&&!/unknown/i.test(x.artist)?x.artist:'';
      const t={id:key,key,name:(x.title||String(x.displayName).replace(EXT,''))+(art?' · '+art:''),type:'musica',played:0,native:true,uri:x.uri};
      tracks.push(t);await save(t);n++;
    }
    if(found.length){
      const ids=new Set(found.map(x=>'dev:'+x.id));
      const gone=tracks.filter(t=>t.native&&!ids.has(t.key));
      for(const t of gone)delT(t.id);
      tracks=tracks.filter(t=>!gone.includes(t));
    }
    toast(n?n+' canciones nuevas del teléfono':'Biblioteca al día');refresh();
  }catch(e){toast('Escaneo falló: '+(e.message||e));}
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
  s.setMetadata({title:p[0],artist:p.slice(1).join(' · '),album:'Mi Música',artwork:t.art?[{src:t.art,sizes:'480x480',type:'image/jpeg'}]:[]}).catch(()=>{});
  if(isFinite(a.duration))s.setPositionState({duration:a.duration,position:a.currentTime,playbackRate:1}).catch(()=>{});
}
function initSession(){
  const s=NATIVE&&msess();if(!s)return;
  const h=(act,fn)=>s.setActionHandler({action:act},fn).catch(()=>{});
  h('play',()=>a.play());h('pause',()=>a.pause());
  h('nexttrack',next);h('previoustrack',prev);
  h('seekto',d=>{if(d&&d.seekTime!=null)a.currentTime=d.seekTime;});
}
a.addEventListener('play',()=>{sesMeta(cur);sesState('playing');syncPlayer();});
a.addEventListener('pause',()=>{sesState('paused');syncPlayer();});
a.addEventListener('loadedmetadata',()=>sesMeta(cur));
a.addEventListener('timeupdate',()=>tick());
let sleepT=null,sleepEnd=0,sleepSong=false;
const sleepOn=()=>sleepSong||sleepEnd>0;
const sleepTxt=()=>sleepSong?'Se detiene al terminar la canción':sleepEnd?'Se pausa en '+Math.max(1,Math.ceil((sleepEnd-Date.now())/60000))+' min':'';
function setSleep(v){
  clearTimeout(sleepT);sleepT=null;sleepEnd=0;sleepSong=false;
  if(v==='song')sleepSong=true;
  else if(+v>0){sleepEnd=Date.now()+v*60000;sleepT=setTimeout(()=>{a.pause();sleepEnd=0;sleepT=null;syncPlayer();toast('Temporizador: música pausada');},v*60000);}
  hideSheet();syncPlayer();toast(sleepOn()?sleepTxt():'Temporizador apagado');
}
function openSleep(){
  const o=[['5','5 minutos'],['15','15 minutos'],['30','30 minutos'],['45','45 minutos'],['60','1 hora'],['song','Al terminar la canción'],['0','Apagar temporizador']];
  openSheet('<div class="si sm"><div class="tx"><b>Temporizador</b></div></div>'+o.map(x=>`<div class="si sm" data-a="sleepset" data-v="${x[0]}"><div class="ic">${ic('timer',20)}</div><b>${x[1]}</b></div>`).join(''),'menu',true);
}
/* ---- Letras (LRCLIB, gratis y sin clave) ---- */
let lyLines=null,lyIdx=-1;
function parseLrc(x){
  const o=[];
  (x||'').split('\n').forEach(l=>{const m=l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);if(m)o.push({t:+m[1]*60+ +m[2],s:m[3]});});
  return o;
}
async function getLyrics(t){
  if(t.lyr!==undefined)return t.lyr;
  const ar=tArtist(t).split(',')[0].trim();
  const q=new URLSearchParams(ar?{track_name:tTitle(t),artist_name:ar}:{q:tTitle(t)});
  let r=null;
  try{
    const x=await fetch('https://lrclib.net/api/search?'+q);
    if(!x.ok)throw 0;
    const j=await x.json();
    r=j.find(y=>y.syncedLyrics)||j.find(y=>y.plainLyrics)||null;
  }catch(e){return null;}
  t.lyr=r?{s:r.syncedLyrics||'',p:r.plainLyrics||''}:0;
  save(t);return t.lyr;
}
function lyHtml(L){
  if(!L)return '<p class="mut" style="padding:16px">No encontré la letra de esta canción.</p>';
  lyLines=parseLrc(L.s);lyIdx=-1;
  if(lyLines.length)return '<div id="ly" class="ly">'+lyLines.map((l,i)=>`<p data-a="lseek" data-v="${l.t}" data-i="${i}">${esc(l.s)||'♪'}</p>`).join('')+'</div>';
  lyLines=null;
  return '<div id="ly" class="ly plain">'+(L.p||'').split('\n').map(l=>`<p>${esc(l)||'&nbsp;'}</p>`).join('')+'</div>';
}
async function openLyrics(){
  if(!cur)return;const t=cur;
  openSheet('<div class="si sm"><div class="tx"><b>Letra</b><span class="d">'+esc(tTitle(t))+'</span></div></div><p class="mut" style="padding:16px">Buscando letra…</p>','lyrics',true);
  const L=await getLyrics(t);
  if(sheetKind!=='lyrics'||cur!==t)return;
  $('#sheet .sh').innerHTML='<div class="si sm"><div class="tx"><b>Letra</b><span class="d">'+esc(tTitle(t))+'</span></div></div>'+lyHtml(L===null?0:L);
  if(L===null)$('#sheet .sh').innerHTML+='<p class="mut" style="padding:0 16px">Necesitas internet para buscar la letra.</p>';
  lyTick();
}
function lyTick(){
  if(!lyLines||!$('#ly'))return;
  let i=-1;for(let k=0;k<lyLines.length;k++){if(lyLines[k].t<=a.currentTime+.3)i=k;else break;}
  if(i===lyIdx)return;lyIdx=i;
  document.querySelectorAll('#ly p').forEach((p,k)=>p.classList.toggle('on',k===i));
  const e=document.querySelector('#ly p.on');if(e)e.scrollIntoView({block:'center',behavior:'smooth'});
}
/* ---- Copia de seguridad ---- */
async function exportar(){
  const data={v:1,fecha:new Date().toISOString(),tracks:tracks.map(t=>{const {url,...m}=t;return m;}),lists:lists,ajustes:{only:cfg.only,sort:sortBy,nombre:localStorage.getItem('nombre')||''}};
  const name='mi-musica-copia-'+new Date().toISOString().slice(0,10)+'.json';
  const file=new File([JSON.stringify(data)],name,{type:'application/json'});
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});toast('Copia lista');return;}
  }catch(e){if(e&&e.name==='AbortError')return;}
  const u=URL.createObjectURL(file),l=document.createElement('a');
  l.href=u;l.download=name;document.body.appendChild(l);l.click();l.remove();
  setTimeout(()=>URL.revokeObjectURL(u),4000);toast('Copia descargada');
}
async function restaurar(f){
  try{
    const d=JSON.parse(await f.text());
    if(!d||!Array.isArray(d.tracks))throw 0;
    let nt=0,up=0,nl=0;
    for(const x of d.tracks){
      const t=byId(x.id)||tracks.find(y=>x.aid&&y.aid===x.aid);
      if(t){
        ['liked','plays','type','art','aimg','lyr'].forEach(k=>{if(x[k]!==undefined&&(t[k]===undefined||k==='liked'&&x.liked))t[k]=x[k];});
        t.played=Math.max(t.played||0,x.played||0);await save(t);up++;
      }else if(x.remote){tracks.push(x);await save(x);nt++;}
    }
    for(const l of d.lists||[]){if(!lists.find(y=>y.id===l.id)){lists.push(l);await saveL(l);nl++;}}
    toast('Restaurado: '+nt+' canciones, '+nl+' playlists, '+up+' actualizadas');refresh();
  }catch(e){toast('Ese archivo no es una copia válida');}
}
/* ---- Importar playlist .m3u ---- */
async function importarM3u(f){
  try{
    const norm=x=>String(x).toLowerCase().replace(EXT,'').replace(/[^a-z0-9áéíóúñü]+/g,' ').trim();
    const idx=tracks.map(t=>({t,k:norm(tTitle(t)),k2:norm(t.name)}));
    const ids=[];let miss=0;
    for(const raw of (await f.text()).split(/\r?\n/)){
      const ln=raw.trim();if(!ln||ln[0]==='#')continue;
      const base=norm(decodeURIComponent(ln.split(/[\\/]/).pop()));
      const m=idx.find(x=>x.k===base||x.k2===base)||idx.find(x=>base&&x.k&&(base.includes(x.k)||x.k.includes(base))&&x.k.length>3);
      if(m){if(!ids.includes(m.t.id))ids.push(m.t.id);}else miss++;
    }
    if(!ids.length)throw 0;
    const l={id:uid(),name:f.name.replace(/\.m3u8?$/i,'')||'Playlist importada',ids,created:Date.now()};
    lists.push(l);await saveL(l);
    toast(ids.length+' canciones'+(miss?' ('+miss+' no encontradas)':''));refresh();
  }catch(e){toast('No encontré canciones de esa playlist en tu biblioteca');}
}
function shareCur(){
  if(!cur)return;const txt=tTitle(cur)+(tArtist(cur)?' - '+tArtist(cur):'');
  if(navigator.share)navigator.share({title:tTitle(cur),text:txt}).catch(()=>{});
  else if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>toast('Copiado: '+txt)).catch(()=>{});
}
a.addEventListener('ended',()=>{if(sleepSong){sleepSong=false;syncPlayer();return;}if(!shuffle&&Q.indexOf(cur)===Q.length-1)return;next();});

/* ===== INTERFAZ ===== */
const I={
 home:'<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 library:'<path d="M5 4v16M10 4v16M15 5l4 15"/>',
 star:'<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 heart:'<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
 play:'<path d="M7 4v16l13-8z"/>',
 pause:'<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
 next:'<path d="M6 5l10 7-10 7z"/><path d="M18 5v14"/>',
 prev:'<path d="M18 5 8 12l10 7z"/><path d="M6 5v14"/>',
 shuffle:'<path d="M3 7h4c6 0 6 10 12 10h2M3 17h4c2 0 3-1 4-2.5M14 9c1-1 2-2 5-2h2M18 4l3 3-3 3M18 14l3 3-3 3"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 back:'<path d="M15 5l-7 7 7 7"/>',
 dots:'<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
 pin:'<path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7"/>',
 dl:'<path d="M12 4v11m-5-4 5 5 5-5M5 20h14"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
 note:'<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
 off:'<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM17 9l4 6m0-6-4 6"/>',
 list:'<path d="M4 6h16M4 12h16M4 18h10"/>',
 trash:'<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
 sort:'<path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 timer:'<circle cx="12" cy="14" r="7"/><path d="M12 14v-3M9 3h6M12 3v4"/>',
 share:'<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>'
};
const ic=(n,s,f)=>`<svg viewBox="0 0 24 24" width="${s||24}" height="${s||24}" fill="${f?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]||''}</svg>`;
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return h;};
const tTitle=t=>t.name.split(' · ')[0];
const tArtist=t=>t.name.split(' · ').slice(1).join(' · ');
const tc=(t,px)=>cover(t.name,px,t.art?{img:t.art}:{});
const artOf=r=>r&&r.artwork&&(r.artwork['480x480']||r.artwork['150x150']||'')||'';
const rc=(r,px)=>cover(r.title+r.user.name,px,artOf(r)?{img:artOf(r)}:{});
const picOf=r=>r&&r.user&&r.user.profile_picture&&(r.user.profile_picture['480x480']||r.user.profile_picture['150x150'])||'';
const NAME=()=>localStorage.getItem('nombre')||'David García';
const firstArt=L=>{const t=(L||[]).find(x=>x.art);return t?t.art:'';};
const artistImg=L=>{const t=(L||[]).find(x=>x.aimg);return t?t.aimg:firstArt(L);};
const LIKEBG='linear-gradient(135deg,#4b2cff,#a8f0c6)';
function cover(seed,px,o){
  o=o||{};const h=hue(seed);
  const bg=o.bg||`linear-gradient(135deg,hsl(${h} 55% 42%),hsl(${(h+50)%360} 55% 22%))`;
  const s=o.img?sm(o.img,px):'';
  const inner=o.img?`<img class="im${warm.has(s)?' ld':''}" src="${esc(s)}"${s!==o.img?` data-o="${esc(o.img)}"`:''} alt="" decoding="async" style="width:100%;height:100%;object-fit:cover" onload="imgOk(this)" onerror="imgBad(this)">`:(o.in!==undefined?o.in:ic('note',Math.round(px*.42)));
  return `<div class="cv${o.round?' rd':''}" style="width:${px}px;height:${px}px;background:${bg}">${inner}</div>`;
}

let tab='home',stack=[],layers=[],skip=0,chip='',sq='',sbusy=false,serr='',stimer,trend=false,tload=false,sheetKind='';
const visible=()=>tracks.filter(t=>!cfg.only||t.type!=='podcast');
const likes=()=>visible().filter(t=>t.liked);
const byId=id=>tracks.find(t=>t.id===id);
const listTracks=l=>l.ids.map(byId).filter(t=>t&&(!cfg.only||t.type!=='podcast'));
const recents=()=>visible().filter(t=>t.played).sort((x,y)=>y.played-x.played).slice(0,20);
function artists(){const m={};visible().forEach(t=>{const n=tArtist(t)||'Artista desconocido';(m[n]=m[n]||[]).push(t);});return m;}
let sortBy=localStorage.getItem('sort')||'';
const SORTS=[['','Orden original'],['az','Título A-Z'],['art','Artista'],['rec','Escuchado recientemente']];
function srt(L){
  if(!sortBy)return L;
  const c=L.slice(),T=(x,y)=>tTitle(x).localeCompare(tTitle(y));
  if(sortBy==='az')c.sort(T);
  else if(sortBy==='art')c.sort((x,y)=>tArtist(x).localeCompare(tArtist(y))||T(x,y));
  else if(sortBy==='rec')c.sort((x,y)=>(y.played||0)-(x.played||0));
  return c;
}
function resolve(k){const r=resolve0(k);if(r)r.list=srt(r.list);return r;}
function openSort(){
  openSheet('<div class="si sm"><div class="tx"><b>Ordenar por</b></div></div>'+SORTS.map(o=>`<div class="si sm" data-a="sortset" data-v="${o[0]}"><div class="ic">${ic(o[0]===sortBy?'check':'sort',20)}</div><b>${o[1]}</b></div>`).join(''),'menu',true);
}
function resolve0(k){
  if(k==='likes')return{title:'Tus me gusta',list:likes(),heart:1};
  if(k==='all')return{title:'Todas tus canciones',list:visible().slice().sort((x,y)=>tTitle(x).localeCompare(tTitle(y)))};
  if(k&&k.startsWith('pl:')){const l=lists.find(x=>x.id===k.slice(3));return l?{title:l.name,list:listTracks(l),l:l}:null;}
  if(k&&k.startsWith('ar:')){const n=k.slice(3);return{title:n,list:artists()[n]||[],round:1};}
  return null;
}
const favs=()=>visible().filter(t=>t.plays>0).sort((x,y)=>y.plays-x.plays).slice(0,5);
function ctxList(c){
  if(c==='rec')return recents();
  if(c==='fav')return favs();
  if(!c||c==='one')return null;
  const r=resolve(c);return r?r.list:null;
}

const rowT=(t,c)=>`<div class="row" data-a="play" data-v="${esc(t.id)}" data-c="${esc(c)}">${tc(t,48)}<div class="tx"><b>${esc(tTitle(t))}</b><span>${esc(tArtist(t)||'Tu música')}</span></div>${t.remote&&t.hasBlob?'<span class="ok">'+ic('check',18)+'</span>':''}<button class="ib" data-a="menu" data-v="${esc(t.id)}" data-c="${esc(c)}">${ic('dots',22,true)}</button></div>`;
const rowR=(r,s,i)=>`<div class="row" data-a="rem" data-s="${s}" data-v="${i}">${rc(r,48)}<div class="tx"><b>${esc(r.title)}</b><span>${esc(r.user.name)}</span></div><span class="ib">${ic('plus',22)}</span></div>`;
const rowL=(k,name,sub,o,pin)=>`<div class="row" data-a="open" data-v="${esc(k)}">${cover(name,64,o)}<div class="tx"><b>${esc(name)}</b><span>${pin?'<i class="pn">'+ic('pin',14,true)+'</i> ':''}${esc(sub)}</span></div></div>`;
const addT=(a_,txt)=>`<div class="row" data-a="${a_}">${cover('+',64,{bg:'#2a2a2a',in:ic('plus',28)})}<div class="tx"><b>${txt}</b></div></div>`;
const shelf=(h,list,c)=>list.length?`<h2>${h}</h2><div class="hs">`+list.map(t=>`<div class="card" data-a="play" data-v="${esc(t.id)}" data-c="${c}">${tc(t,150)}<b>${esc(tTitle(t))}</b><span>${esc(tArtist(t)||'Tu música')}</span></div>`).join('')+'</div>':'';

function greet(){const h=new Date().getHours();return h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';}

/* ---- Estantes del Inicio (Audius por genero, estilo Spotify) ---- */
const SH=[
  {k:'lat',t:'Éxitos latinos',g:'Latin',q:'reggaeton'},
  {k:'pop',t:'Pop del momento',g:'Pop',q:'pop'},
  {k:'hip',t:'Hip-Hop y Rap',g:'Hip-Hop/Rap',q:'rap'},
  {k:'edm',t:'Electrónica para moverte',g:'Electronic',q:'electronic'}
];
const shState={},shFail={};
SH.forEach(x=>{res['sh_'+x.k]=[];});
const skCards=Array(5).fill('<div class="card"><div class="sk" style="width:150px;height:150px"></div><div class="sk" style="height:12px;width:80%;margin-top:10px"></div><div class="sk" style="height:10px;width:55%;margin-top:6px"></div></div>').join('');
const skRows=n=>Array(n).fill('<div class="row"><div class="sk" style="width:48px;height:48px;flex-shrink:0"></div><div class="tx"><div class="sk" style="height:14px;width:62%"></div><div class="sk" style="height:11px;width:38%;margin-top:6px"></div></div></div>').join('');
function good(L,n){
  const seen={},out=[];
  for(const r of L||[]){
    if(!r||!r.user||!r.title||!artOf(r))continue;
    if(r.is_streamable===false||r.is_delete||r.is_unlisted)continue;
    if(r.duration&&r.duration<60)continue;
    if(/podcast|episode|dj set|full mix|mixtape/i.test(r.title)||/podcast|audiobook|spoken|comedy/i.test(r.genre||''))continue;
    const u=r.user.id||r.user.name;seen[u]=(seen[u]||0)+1;if(seen[u]>2)continue;
    out.push(r);if(out.length>=n)break;
  }
  return out;
}
const slim=r=>{const a=r.artwork||{},pp=r.user.profile_picture||{};return{id:r.id,title:r.title,duration:r.duration,genre:r.genre,artwork:{'150x150':a['150x150'],'480x480':a['480x480']},user:{id:r.user.id,name:r.user.name,profile_picture:{'150x150':pp['150x150'],'480x480':pp['480x480']}}};};
function shelfInner(x){
  const st=shState[x.k],L=res['sh_'+x.k];
  if(st==='ok'&&L.length)return `<h2>${x.t}</h2><div class="hs">`+L.map((r,i)=>`<div class="card" data-a="rem" data-s="sh_${x.k}" data-v="${i}">${rc(r,150)}<b>${esc(r.title)}</b><span>${esc(r.user.name)}</span></div>`).join('')+'</div>';
  if(st==='err'||st==='ok')return '';
  return `<h2>${x.t}</h2><div class="hs">${skCards}</div>`;
}
function trendHtml(){return SH.map(x=>`<div id="sh-${x.k}">${shelfInner(x)}</div>`).join('');}
function paintShelf(x){
  const el=document.getElementById('sh-'+x.k);
  if(el){el.innerHTML=shelfInner(x);el.classList.remove('fin');void el.offsetWidth;el.classList.add('fin');}
  if(x.k==='lat'&&tab==='search'&&!stack.length&&$('#sres')&&!sq.trim())$('#sres').innerHTML=sres();
}
async function loadShelf(x){
  const key='shelf2_'+x.k;let L=null;
  try{const c=JSON.parse(localStorage.getItem(key)||'null');if(c&&Date.now()-c.t<216e5&&c.d&&c.d.length>=4)L=c.d;}catch(e){}
  if(!L){
    L=good(await aj('/tracks/trending',{genre:x.g,time:'week',limit:40}),10);
    if(L.length<6)L=good(await aj('/tracks/trending',{genre:x.g,time:'month',limit:40}),10);
    if(L.length<4&&x.q)L=good(await aj('/tracks/search',{query:x.q,limit:40}),10);
    L=L.map(slim);
    if(L.length>=4)try{localStorage.setItem(key,JSON.stringify({t:Date.now(),d:L}));}catch(e){}
  }
  await preload(L.map(r=>artOf(r)),3000);
  res['sh_'+x.k]=L;shState[x.k]=L.length?'ok':'err';paintShelf(x);
}
let shBusy=false;
async function loadShelves(){
  if(shBusy)return;shBusy=true;
  for(const x of SH){
    if(shState[x.k]==='ok'||Date.now()-(shFail[x.k]||0)<30000)continue;
    shState[x.k]='load';
    try{await loadShelf(x);}catch(e){shState[x.k]='err';shFail[x.k]=Date.now();paintShelf(x);}
  }
  shBusy=false;
}
function vHome(){
  const short=[{k:'likes',t:'Tus me gusta',h:1},{k:'all',t:'Tus canciones',a:firstArt(visible())}].concat(lists.slice(0,4).map(l=>({k:'pl:'+l.id,t:l.name,a:firstArt(listTracks(l))})));
  let h=`<div class="hd"><div class="av">${esc(NAME()[0].toUpperCase())}</div><div class="chips" style="margin:0"><button class="chip${cfg.only?'':' on'}" data-a="chipall">Todo</button><button class="chip${cfg.only?' on':''}" data-a="chipmus">Música</button></div></div><div class="grid2">`+short.map(s=>`<div class="sc" data-a="open" data-v="${esc(s.k)}">${cover(s.t,56,s.h?{bg:LIKEBG,in:ic('heart',24,true)}:(s.a?{img:s.a}:{}))}<b>${esc(s.t)}</b></div>`).join('')+'</div>';
  const fv=favs();
  if(fv.length)h+='<h2>Tus favoritos del momento</h2>'+fv.map(t=>rowT(t,'fav')).join('');
  h+=shelf('Escuchado recientemente',recents().slice(0,10),'rec');
  h+=`<h2>Para ti</h2><div class="hs"><div class="card" data-a="surprise">${cover('sorpresa',150,{in:ic('shuffle',56)})}<b>Mezcla sorpresa</b><span>Al azar de tu biblioteca</span></div></div>`;
  h+=trendHtml();
  if(!tracks.length)h+='<p class="mut">Importa tu música desde Crear o busca en Audius.</p>';
  return h;
}
const GEN=[['Hip-Hop','hip hop','Hip-Hop/Rap'],['Electrónica','electronic','Electronic'],['Pop','pop','Pop'],['Latina','latin','Latin'],['Rock','rock','Rock'],['Reggae','reggae','Reggae'],['R&B','r&b','R&B/Soul'],['Lo-fi','lofi','Lo-Fi']];
const rowS=t=>`<div class="row" data-a="play" data-v="${esc(t.id)}" data-c="rec">${tc(t,48)}<div class="tx"><b>${esc(tTitle(t))}</b><span>Canción • ${esc(tArtist(t)||'Tu música')}</span></div>${t.remote&&t.hasBlob?'<span class="ok">'+ic('check',18)+'</span>':''}<button class="ib" data-a="unrec" data-v="${esc(t.id)}">${ic('x',22)}</button></div>`;
function tilesHtml(){
  const tl=(k,name,h,art)=>`<div class="tile" style="background:hsl(${h} 50% 36%)" data-a="tile" data-v="${esc(k)}"><span>${esc(name)}</span>${art?cover(name,70,{img:art}):''}</div>`;
  let h='<div class="tiles">'+tl('likes','Tus me gusta',255,'')+tl('all','Tus canciones',150,firstArt(visible()));
  h+=GEN.map(g=>tl('q:'+g[1],g[0],hue(g[0]),'')).join('')+'</div>';
  return h;
}
function sres(){
  const q=sq.trim().toLowerCase();
  if(!q){const rc_=recents().slice(0,8),pl=res.sh_lat||[];return tilesHtml()+(rc_.length?'<h2>Recientes</h2>'+rc_.map(rowS).join(''):'')+(pl.length?'<h2>Populares ahora</h2>'+pl.map((r,i)=>rowR(r,'sh_lat',i)).join(''):'');}
  const loc=visible().filter(t=>t.name.toLowerCase().includes(q)).slice(0,20);
  let h=loc.length?'<h2>En tu biblioteca</h2>'+loc.map(t=>rowT(t,'one')).join(''):'';
  h+='<h2>'+(sgen?'Populares: '+esc(sq):'En Audius')+'</h2>'+(sbusy?skRows(8):(res.search.length?res.search.map((r,i)=>rowR(r,'search',i)).join(''):'<p class="mut">'+esc(serr||'Sin resultados')+'</p>'));
  return h;
}
function showRes(){
  const e=$('#sres');if(!e)return;
  e.innerHTML=sres();e.classList.remove('fx');void e.offsetWidth;e.classList.add('fx');
  setTimeout(()=>e.classList.remove('fx'),800);
}
function vSearch(){
  return `<div class="hd"><div class="av">${esc(NAME()[0].toUpperCase())}</div><h1>Buscar</h1></div><div class="sb">${ic('search',22)}<input id="q" placeholder="¿Qué quieres escuchar?" value="${esc(sq)}" enterkeyhint="search"></div><div id="sres">${sres()}</div>`;
}
function onq(e){
  sq=e.target.value;sgen='';clearTimeout(stimer);
  if(sq.trim().length<2){sid++;sbusy=false;res.search=[];serr='';$('#sres').innerHTML=sres();return;}
  sbusy=true;$('#sres').innerHTML=sres();
  stimer=setTimeout(doSearch,450);
}
async function doSearch(){
  const q=sq.trim(),my=++sid,g=sgen;sbusy=true;serr='';
  if($('#sres'))$('#sres').innerHTML=sres();
  let r=[];
  try{
    if(g)r=good(await aj('/tracks/trending',{genre:g,time:'month',limit:50}),25);
    else{
      r=(await aj('/tracks/search',{query:q,limit:25})||[]).filter(x=>x&&x.user&&x.title&&x.is_streamable!==false&&!x.is_delete);
      r=r.filter(x=>artOf(x)).concat(r.filter(x=>!artOf(x)));
    }
  }catch(e){r=[];serr='Audius no respondió ('+e.message+'). Si es 401 o 403, agrega tu API key en Gratis → Ajustes.';}
  if(my!==sid)return;
  await preload(r.map(x=>sm(artOf(x),48)),2500);
  if(my!==sid)return;
  res.search=r;sbusy=false;
  if(q===sq.trim())showRes();
}
function vLib(){
  const L=lists.slice().sort((x,y)=>(y.pinned?1:0)-(x.pinned?1:0)||y.created-x.created);
  const pl=L.map(l=>rowL('pl:'+l.id,l.name,'Playlist • '+NAME()+' • '+listTracks(l).length+' canciones',{img:firstArt(listTracks(l))},l.pinned)).join('');
  const lk=rowL('likes','Tus me gusta','Playlist • '+likes().length+' canciones',{bg:LIKEBG,in:ic('heart',28,true)},true);
  const all=rowL('all','Todas tus canciones','Canciones • '+visible().length,{img:firstArt(visible())});
  const ar=Object.entries(artists()).sort((x,y)=>y[1].length-x[1].length);
  const arR=n=>ar.slice(0,n).map(e=>rowL('ar:'+e[0],e[0],'Artista',{round:1,img:artistImg(e[1]),in:'<b class="ini">'+esc(e[0][0].toUpperCase())+'</b>'})).join('');
  let h=`<div class="hd"><div class="av">${esc(NAME()[0].toUpperCase())}</div><h1>Tu biblioteca</h1><button class="ib" data-a="searchtab">${ic('search',26)}</button><button class="ib" data-a="crear">${ic('plus',28)}</button></div>`;
  h+='<div class="chips">'+['Playlists','Artistas','Canciones'].map(c=>`<button class="chip${chip===c?' on':''}" data-a="chip" data-v="${c}">${c}</button>`).join('')+'</div>';
  if(chip==='Playlists')h+=lk+pl+addT('newpl','Crear playlist');
  else if(chip==='Artistas')h+=ar.length?arR(999):'<p class="mut">Aún no hay artistas.</p>';
  else if(chip==='Canciones')h+=visible().length?resolve('all').list.map(t=>rowT(t,'all')).join(''):'<p class="mut">Aún no hay canciones.</p>';
  else h+=lk+pl+all+arR(5)+addT('pickfile','Importar tu música')+(NATIVE?addT('scan','Escanear el teléfono'):'')+addT('newpl','Crear playlist');
  return h;
}
function vFree(){
  const feat=[['off','Sin anuncios, nunca'],['dl','Descarga canciones para escuchar sin internet'],['shuffle','Aleatorio real: no repite hasta que suenen todas'],['list','Favoritos y playlists sin límite'],['note','Música libre de Audius y la que ya tienes en el teléfono']];
  return `<div class="hero"><h1>Todo incluido.<br>Gratis.</h1><p>Sin planes, sin pruebas, sin anuncios.</p></div>
  <div class="fc2">${feat.map(f=>`<div class="fr">${ic(f[0],24)}<span>${f[1]}</span></div>`).join('')}</div>
  <h2>Ajustes</h2>
  <div class="set" data-a="only"><div class="tx"><b>Solo música</b><span>Oculta los podcasts de tu biblioteca</span></div><i class="sw${cfg.only?' on':''}"></i></div>
  ${NATIVE?'<div class="set" data-a="scan"><div class="tx"><b>Escanear el teléfono</b><span>Busca música nueva ahora</span></div></div>':''}
  <div class="set" data-a="name"><div class="tx"><b>Tu nombre</b><span>${esc(NAME())}</span></div></div>
  <div class="set" data-a="export"><div class="tx"><b>Guardar copia de seguridad</b><span>Playlists, me gusta y canciones de Audius (no incluye archivos de audio)</span></div></div>
  <div class="set" data-a="restore"><div class="tx"><b>Restaurar copia de seguridad</b><span>Une la copia con lo que ya tienes</span></div></div>
  <div class="set" data-a="key"><div class="tx"><b>API key de Audius</b><span>Opcional: solo si la búsqueda da error 401 o 403</span></div></div>
  <p class="mut">La música de Audius pertenece a sus artistas.</p>`;
}
function vDetail(k){
  const r=resolve(k);
  if(!r)return `<button class="ib" data-a="back">${ic('back',26)}</button><p class="mut">Esto ya no existe.</p>`;
  const cov=cover(r.title,200,r.heart?{bg:LIKEBG,in:ic('heart',90,true)}:{img:r.round?artistImg(r.list):firstArt(r.list),round:r.round,in:r.round?'<b class="ini">'+esc((r.title[0]||'?').toUpperCase())+'</b>':undefined});
  return `<div class="dh"><button class="ib" data-a="back">${ic('back',26)}</button></div>
  <div class="dc">${cov}</div><h1 class="dt">${esc(r.title)}</h1><p class="mut">${r.list.length} canciones</p>
  <div class="da">${r.l?`<button class="ib" data-a="dmenu" data-v="${esc(r.l.id)}">${ic('dots',26,true)}</button>`:''}<span class="sp"></span><button class="ib${sortBy?' g':''}" data-a="sort">${ic('sort',26)}</button><button class="ib${shuffle?' g':''}" data-a="shuf">${ic('shuffle',26)}</button><button class="bigplay" data-a="playall" data-v="${esc(k)}">${ic('play',28,true)}</button></div>
  ${r.list.length?r.list.map(t=>rowT(t,k)).join(''):'<p class="mut">Aún no hay canciones aquí.</p>'}`;
}

/* ---- Pintar ---- */
const NAV=[['home','Inicio','home'],['search','Buscar','search'],['lib','Tu biblioteca','library'],['free','Gratis','star'],['crear','Crear','plus']];
function drawNav(){
  $('#nav').innerHTML=NAV.map(n=>{
    const cr=n[0]==='crear',x=cr&&sheetKind==='create';
    return `<button data-a="${cr?'crear':'nav'}" data-v="${n[0]}" class="${tab===n[0]&&!cr?'on':''}${x?' xo':''}">${ic(x?'x':n[2],26)}<span>${n[1]}</span></button>`;
  }).join('');
}
function render(){
  drawNav();
  const top=stack[stack.length-1];
  $('#view').innerHTML=top?vDetail(top):({home:vHome,search:vSearch,lib:vLib,free:vFree}[tab])();
  const q=$('#q');if(q)q.oninput=onq;
  if((tab==='home'||tab==='search')&&!top)loadShelves();
  syncPlayer();
}
function refresh(){
  const q=document.activeElement;
  if(q&&q.id==='q')syncPlayer();else render();
}
function fullHtml(){
  return `<div class="fh"><button class="ib" data-a="back">${ic('down',28)}</button><span>Reproduciendo</span><button class="ib" data-a="menu" data-v="${esc(cur.id)}" data-c="">${ic('dots',24,true)}</button></div>
  <div class="fc">${tc(cur,Math.min(window.innerWidth-48,360))}</div>
  <div class="ft"><div class="tx"><h2>${esc(tTitle(cur))}</h2><span class="mut">${esc(tArtist(cur)||'Tu música')}</span></div><button class="ib${cur.liked?' g':''}" data-a="like" data-v="${esc(cur.id)}">${ic('heart',28,!!cur.liked)}</button></div>
  <input type="range" id="fs" min="0" max="1000" value="0"><div class="tm"><span id="t1">0:00</span><span id="t2">0:00</span></div>
  <div class="ctl"><button class="ib${shuffle?' g':''}" data-a="shuf">${ic('shuffle',26)}</button><button class="ib" data-a="prev">${ic('prev',34,true)}</button><button class="pp" data-a="pp">${ic(a.paused?'play':'pause',30,true)}</button><button class="ib" data-a="next">${ic('next',34,true)}</button><button class="ib${sleepOn()?' g':''}" data-a="sleep">${ic('timer',26)}</button></div>
  <div class="fb"><span class="mut">${esc(sleepTxt())}</span><span class="sp"></span><button class="ib" data-a="lyrics">${ic('mic',24)}</button><button class="ib" data-a="share">${ic('share',24)}</button><button class="ib" data-a="queue">${ic('list',24)}</button></div>`;
}
function tick(){
  lyTick();
  const p=a.duration?a.currentTime/a.duration:0;
  const mp=$('#mp');if(mp)mp.style.width=(p*100)+'%';
  const fs=$('#fs');
  if(fs&&!$('#full').hidden){
    if(document.activeElement!==fs)fs.value=p*1000;
    $('#t1').textContent=fmt(a.currentTime);$('#t2').textContent=fmt(a.duration);
  }
}
function syncPlayer(){
  const m=$('#mini');
  document.querySelectorAll('.row[data-a="play"]').forEach(r=>r.classList.toggle('on',!!cur&&r.dataset.v===cur.id));
  const bp=document.querySelector('.bigplay');
  if(bp){const r=resolve(bp.dataset.v);const on=!!(r&&cur&&!a.paused&&r.list.includes(cur));bp.innerHTML=ic(on?'pause':'play',28,true);}
  if(!cur){m.hidden=true;return;}
  const col='hsl('+hue(cur.name)+' 45% 24%)';
  m.hidden=false;m.style.setProperty('--c',col);
  m.innerHTML=`${tc(cur,48)}<div class="tx"><b>${esc(tTitle(cur))}</b><span>${esc(tArtist(cur)||'Tu música')}</span></div><button class="ib${cur.liked?' g':''}" data-a="like" data-v="${esc(cur.id)}">${ic('heart',26,!!cur.liked)}</button><button class="ib" data-a="pp">${ic(a.paused?'play':'pause',30,true)}</button><div class="pb"><i id="mp"></i></div>`;
  const f=$('#full');
  if(!f.hidden){
    if(f.dataset.id!==cur.id){f.dataset.id=cur.id;f.classList.add('chg');clearTimeout(chgT);chgT=setTimeout(()=>f.classList.remove('chg'),700);}
    f.style.setProperty('--c',col);f.style.setProperty('--img',cur.art?'url("'+cur.art.replace(/"/g,'%22')+'")':'none');f.innerHTML=fullHtml();
    const fs=$('#fs');fs.oninput=()=>{if(a.duration)a.currentTime=fs.value/1000*a.duration;};
  }
  tick();
}

/* ===== ACCIONES ===== */
let tt;
function toast(m){const e=$('#toast');e.textContent=m;e.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),2200);}
function pushLayer(f){layers.push(f);history.pushState({},'');}
function popLayer(){const f=layers.pop();if(f)f();skip++;history.back();}
window.addEventListener('popstate',()=>{
  if(skip>0){skip--;return;}
  hideSheet();
  const f=layers.pop();if(f)f();
});
function goTab(t){
  const n=layers.length;layers=[];stack=[];$('#full').hidden=true;
  if(n){skip++;history.go(-n);}
  tab=t;hideSheet();render();animView('tab');window.scrollTo(0,0);
}
function openDetail(k){
  if(!resolve(k))return;
  stack.push(k);pushLayer(()=>{stack.pop();render();animView('pop');});
  render();animView('push');window.scrollTo(0,0);
}
function closeFull(){
  const f=$('#full');if(f.hidden||f.classList.contains('out'))return;
  f.classList.add('out');fuT=setTimeout(()=>{f.classList.remove('out');f.hidden=true;},230);
}
function openFull(){
  if(!cur)return;
  clearTimeout(fuT);const f=$('#full');f.classList.remove('out');f.hidden=false;pushLayer(closeFull);syncPlayer();
}
function openSheet(html,kind,over){
  const s=$('#sheet');clearTimeout(shT);sheetKind=kind||'';s.className=over?'top':'';
  s.innerHTML='<div class="bg" data-a="close"></div><div class="sh">'+html+'</div>';
  s.hidden=false;drawNav();
}
function hideSheet(){
  const s=$('#sheet');if(s.hidden||s.classList.contains('out'))return;
  sheetKind='';drawNav();s.classList.add('out');
  shT=setTimeout(()=>{s.hidden=true;s.innerHTML='';s.classList.remove('out');},180);
}
function openCreate(){
  const it=(a_,i,t,d)=>`<div class="si" data-a="${a_}"><div class="ic">${ic(i,26)}</div><div><b>${t}</b><span class="d">${d}</span></div></div>`;
  openSheet(it('newpl','note','Playlist','Crea una playlist con tus canciones')+it('mixsave','shuffle','Mezcla sorpresa','Una playlist con 25 canciones al azar')+it('pickfile','plus','Importar música','Agrega canciones de tu teléfono')+it('m3u','list','Importar playlist (.m3u)','Crea una playlist desde un archivo')+(NATIVE?it('scan','search','Escanear teléfono','Busca música nueva ahora'):''),'create');
}
function trackMenu(id,c){
  const t=byId(id);if(!t)return;
  const inPl=c&&c.startsWith('pl:');
  const hd=`<div class="si sm">${tc(t,48)}<div class="tx"><b>${esc(tTitle(t))}</b><span class="d">${esc(tArtist(t)||'Tu música')}</span></div></div>`;
  const it=(k,i,x)=>`<div class="si sm" data-a="tm" data-k="${k}" data-v="${esc(id)}" data-c="${esc(c||'')}"><div class="ic">${ic(i,20)}</div><b>${x}</b></div>`;
  openSheet(hd+it('like','heart',t.liked?'Quitar de Tus me gusta':'Agregar a Tus me gusta')+it('addpl','plus','Agregar a playlist')+(inPl?it('rmpl','x','Quitar de esta playlist'):'')+(t.remote&&!t.hasBlob?it('dl','dl','Descargar para escuchar sin internet'):'')+it('type','note',t.type==='podcast'?'Marcar como música':'Marcar como podcast')+(t.native?'':it('del','trash','Eliminar de la biblioteca')),'menu',true);
}
function trackAct(k,id,c){
  const t=byId(id);if(!t)return;
  if(k==='like'){t.liked=!t.liked;save(t);hideSheet();refresh();}
  else if(k==='addpl')plPicker(id);
  else if(k==='newadd'){const l=newPlaylist();if(l){l.ids.push(id);saveL(l);hideSheet();toast('Agregada a '+l.name);refresh();}}
  else if(k==='rmpl'){const l=lists.find(x=>x.id===c.slice(3));if(l){l.ids=l.ids.filter(x=>x!==id);saveL(l);}hideSheet();refresh();}
  else if(k==='dl'){hideSheet();bajar(t);}
  else if(k==='type'){t.type=t.type==='podcast'?'musica':'podcast';save(t);hideSheet();refresh();}
  else if(k==='del'){if(confirm('¿Eliminar "'+tTitle(t)+'" de tu biblioteca?')){hideSheet();removeTrack(t);}}
}
function upcoming(){
  if(!Q.length)return[];
  if(shuffle){if(!bag.length)refill();return bag.slice().reverse();}
  const i=Q.indexOf(cur);return i<0?Q.slice():Q.slice(i+1).concat(Q.slice(0,i));
}
function openQueue(){
  if(!cur)return;
  const U=upcoming().slice(0,50);
  const row=t=>`<div class="si sm" data-a="qplay" data-v="${esc(t.id)}">${tc(t,48)}<div class="tx"><b>${esc(tTitle(t))}</b><span class="d">${esc(tArtist(t)||'Tu música')}</span></div></div>`;
  openSheet('<h2 style="padding:4px 12px">Reproduciendo ahora</h2>'+row(cur).replace('data-a="qplay"','')+
    '<h2 style="padding:4px 12px">A continuación'+(shuffle?' (aleatorio)':'')+'</h2>'+(U.length?U.map(row).join(''):'<p class="mut" style="padding:0 12px">No hay más canciones en la cola.</p>'),'menu',true);
}
function plPicker(id){
  const it=(k,i,x,extra)=>`<div class="si sm" ${extra}><div class="ic">${ic(i,20)}</div><b>${x}</b></div>`;
  openSheet(it('','plus','Nueva playlist',`data-a="tm" data-k="newadd" data-v="${esc(id)}"`)+lists.map(l=>it('','list',esc(l.name),`data-a="addto" data-v="${esc(l.id)}" data-t="${esc(id)}"`)).join(''),'menu',true);
}
function addTo(lid,tid){
  const l=lists.find(x=>x.id===lid);if(!l)return;
  if(!l.ids.includes(tid)){l.ids.push(tid);saveL(l);}
  hideSheet();toast('Agregada a '+l.name);refresh();
}
function removeTrack(t){
  tracks=tracks.filter(x=>x!==t);delT(t.id);
  lists.forEach(l=>{if(l.ids.includes(t.id)){l.ids=l.ids.filter(x=>x!==t.id);saveL(l);}});
  Q=Q.filter(x=>x!==t);
  if(cur===t){a.pause();cur=null;}
  refresh();
}
function newPlaylist(){
  const n=prompt('Nombre de la playlist','Mi playlist');
  if(!n||!n.trim())return null;
  const l={id:uid(),name:n.trim().slice(0,60),ids:[],created:Date.now()};
  lists.push(l);saveL(l);return l;
}
function listMenu(id){
  const l=lists.find(x=>x.id===id);if(!l)return;
  const it=(k,i,x)=>`<div class="si sm" data-a="lm" data-k="${k}" data-v="${esc(id)}"><div class="ic">${ic(i,20)}</div><b>${x}</b></div>`;
  openSheet(`<div class="si sm"><div class="tx"><b>${esc(l.name)}</b></div></div>`+it('pin','pin',l.pinned?'Desfijar':'Fijar arriba')+it('ren','edit','Cambiar nombre')+it('del','trash','Eliminar playlist'),'menu',true);
}
function listAct(k,id){
  const l=lists.find(x=>x.id===id);if(!l)return;
  if(k==='pin'){l.pinned=!l.pinned;saveL(l);hideSheet();refresh();}
  else if(k==='ren'){const n=prompt('Nuevo nombre',l.name);if(n&&n.trim()){l.name=n.trim().slice(0,60);saveL(l);}hideSheet();refresh();}
  else if(k==='del'){
    if(confirm('¿Eliminar la playlist "'+l.name+'"?')){
      lists=lists.filter(x=>x!==l);req(tx('p','readwrite').delete(l.id));hideSheet();popLayer();
    }
  }
}
function playAll(k){
  const r=resolve(k);if(!r||!r.list.length)return;
  const isCur=cur&&r.list.includes(cur);
  if(isCur){if(a.paused)a.play().catch(()=>{});else a.pause();return;}
  playList(r.list);
}
function surprise(keep){
  const L=visible();if(!L.length){toast('Agrega música primero');return;}
  const pick=L.slice().sort(()=>Math.random()-.5).slice(0,25);
  if(keep){
    const l={id:uid(),name:'Mezcla sorpresa '+new Date().toLocaleDateString('es'),ids:pick.map(t=>t.id),created:Date.now()};
    lists.push(l);saveL(l);toast('Playlist creada');refresh();return;
  }
  playList(pick,pick[0],true);
}
async function playRemote(s,i){
  const r=res[s][i];if(!r)return;
  toast('Cargando…');
  const t=await addRemote(r);
  playList([t],t);refresh();
}

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-a]');if(!el)return;
  const v=el.dataset.v;
  switch(el.dataset.a){
    case 'nav':return goTab(v);
    case 'crear':return sheetKind==='create'?hideSheet():openCreate();
    case 'open':return openDetail(v);
    case 'back':return popLayer();
    case 'chip':chip=chip===v?'':v;render();return animView('chip');
    case 'searchtab':return goTab('search');
    case 'play':{const t=byId(v);if(!t)return;const L=ctxList(el.dataset.c);return playList(L&&L.includes(t)?L:[t],t);}
    case 'rem':return playRemote(el.dataset.s,+v);
    case 'full':return openFull();
    case 'chipall':case 'chipmus':cfg.only=el.dataset.a==='chipmus';localStorage.setItem('only',cfg.only?'1':'0');render();return animView('chip');
    case 'name':{const n=prompt('Tu nombre',NAME());if(n&&n.trim()){localStorage.setItem('nombre',n.trim().slice(0,40));render();}return;}
    case 'sort':return openSort();
    case 'sortset':sortBy=v;localStorage.setItem('sort',v);hideSheet();return render();
    case 'queue':return openQueue();
    case 'sleep':return openSleep();
    case 'sleepset':return setSleep(v);
    case 'share':return shareCur();
    case 'lyrics':return openLyrics();
    case 'lseek':a.currentTime=+v;return lyTick();
    case 'tile':if(v.startsWith('q:')){const g=GEN.find(x=>x[1]===v.slice(2));sq=g?g[0]:v.slice(2);sgen=g?g[2]:'';render();doSearch();return;}return openDetail(v);
    case 'unrec':{const t=byId(v);if(t){t.played=0;save(t);}return render();}
    case 'qplay':{const t=byId(v);if(!t)return;hideSheet();if(shuffle){bag=bag.filter(x=>x!==t);if(cur)hist.push(cur);}return play(t);}
    case 'pp':return togglePlay();
    case 'next':return next();
    case 'prev':return prev();
    case 'shuf':shuffle=!shuffle;bag=[];hist=[];return refresh();
    case 'like':{const t=byId(v);if(t){t.liked=!t.liked;save(t);refresh();if(t.liked)document.querySelectorAll('[data-a="like"].g svg').forEach(x=>x.classList.add('pop'));}return;}
    case 'menu':return trackMenu(v,el.dataset.c||'');
    case 'tm':return trackAct(el.dataset.k,v,el.dataset.c||'');
    case 'addto':return addTo(v,el.dataset.t);
    case 'playall':return playAll(v);
    case 'dmenu':return listMenu(v);
    case 'lm':return listAct(el.dataset.k,v);
    case 'surprise':return surprise(false);
    case 'mixsave':hideSheet();return surprise(true);
    case 'newpl':{hideSheet();const l=newPlaylist();if(l){tab='lib';openDetail('pl:'+l.id);}return;}
    case 'pickfile':hideSheet();return pickMusic();
    case 'scan':hideSheet();return escanear();
    case 'only':cfg.only=!cfg.only;localStorage.setItem('only',cfg.only?'1':'0');return render();
    case 'key':{const k=prompt('API key de Audius (opcional)',localStorage.getItem('audiusKey')||'');if(k!==null)localStorage.setItem('audiusKey',k.trim());return;}
    case 'm3u':hideSheet();return $('#m3').click();
    case 'export':return exportar();
    case 'restore':return $('#bk').click();
    case 'close':return hideSheet();
  }
});
const bk=document.createElement('input');bk.type='file';bk.id='bk';bk.accept='.json,application/json';bk.hidden=true;document.body.appendChild(bk);
bk.onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)restaurar(f);};
const m3=document.createElement('input');m3.type='file';m3.id='m3';m3.accept='.m3u,.m3u8,audio/x-mpegurl,application/vnd.apple.mpegurl';m3.hidden=true;document.body.appendChild(m3);
m3.onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)importarM3u(f);};
$('#files').onchange=e=>{const f=[...e.target.files];e.target.value='';importar(f);};

(async()=>{
  try{db=await openDB();}catch(e){toast('No se pudo abrir el almacenamiento');return;}
  const T=await req(tx('t','readonly').getAll());
  const L=await req(tx('p','readonly').getAll());
  tracks=T||[];lists=L||[];
  cfg.only=localStorage.getItem('only')==='1';
  render();
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
  initSession();
  if(NATIVE)escanear().then(()=>setTimeout(bgArt,1500));else setTimeout(bgArt,2500);
})();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
