const C='musica-v12';
const F=['./','index.html','style.css','app.js','manifest.json','icon.svg'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(F.map(u=>new Request(u,{cache:'reload'})))));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(
    fetch(e.request,{cache:'no-cache'}).then(r=>{
      if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}
      return r;
    }).catch(()=>caches.match(e.request))
  );
});
