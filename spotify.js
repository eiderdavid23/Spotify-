/* Fuente Spotify: catalogo real + audio exacto por ISRC */
(function () {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) return;

  const API = 'https://api.spotify.com/v1';
  const TOK = 'https://open.spotify.com/api/token';
  const SEC = 'https://raw.githubusercontent.com/xyloflake/spot-secrets-go/main/secrets/secretDict.json';
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
  const INST = ['https://monochrome.prigoana.com', 'https://music.binimum.org', 'https://tidal.squid.wtf'];
  const CH = window.CapacitorHttp || (Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp);

  let cache = null, res = [], seq = 0;

  const creds = () => { try { return JSON.parse(localStorage.getItem('spCred') || '{}'); } catch (e) { return {}; } };
  const dur = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const cuerpo = h => { const b = document.querySelector('#ytRes'); if (b) b.innerHTML = h; };

  async function req(url, o) {
    o = o || {};
    const r = await CH.request({
      url: url, method: o.method || 'GET', headers: o.headers || {}, data: o.body,
      connectTimeout: 15000, readTimeout: 20000
    });
    const d = typeof r.data === 'string' && /^[[{]/.test(r.data.trim()) ? JSON.parse(r.data) : r.data;
    return { status: r.status, data: d };
  }

  async function totp(arr) {
    let d = '';
    arr.forEach((e, i) => { d += String(e ^ ((i % 33) + 9)); });
    let hex = '';
    for (const b of new TextEncoder().encode(d)) hex += b.toString(16).padStart(2, '0');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(hex), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const buf = new Uint8Array(8);
    let c = Math.floor(Date.now() / 1000 / 30);
    for (let i = 7; i >= 0; i--) { buf[i] = c & 255; c = Math.floor(c / 256); }
    const m = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
    const off = m[19] & 15;
    const n = (((m[off] & 127) << 24) | (m[off + 1] << 16) | (m[off + 2] << 8) | m[off + 3]) % 1000000;
    return String(n).padStart(6, '0');
  }

  async function token(forzar) {
    if (!forzar && cache && cache.exp > Date.now() + 30000) return cache.tok;
    const c = creds();
    if (c.id && c.secret) {
      const r = await req('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + btoa(c.id + ':' + c.secret), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      if (r.status !== 200 || !r.data.access_token) throw new Error('claves rechazadas (' + r.status + ')');
      cache = { tok: r.data.access_token, exp: Date.now() + (r.data.expires_in || 3600) * 1000 };
      return cache.tok;
    }
    const s = await req(SEC);
    if (!s.data) throw new Error('no se pudieron leer los secretos');
    const ver = String(Math.max.apply(null, Object.keys(s.data).map(Number)));
    const code = await totp(s.data[ver]);
    const h = { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://open.spotify.com/', 'App-Platform': 'WebPlayer' };
    if (c.dc) h.Cookie = 'sp_dc=' + c.dc;
    const r = await req(TOK + '?reason=transport&productType=web-player&totp=' + code + '&totpServer=' + code + '&totpVer=' + ver, { headers: h });
    if (r.status !== 200 || !r.data.accessToken) throw new Error('token anónimo rechazado (' + r.status + ')');
    cache = { tok: r.data.accessToken, exp: r.data.accessTokenExpirationTimestampMs || Date.now() + 3600000 };
    return cache.tok;
  }

  async function sp(path) {
    let t = await token();
    let r = await req(API + path, { headers: { 'Authorization': 'Bearer ' + t } });
    if (r.status === 401) { t = await token(true); r = await req(API + path, { headers: { 'Authorization': 'Bearer ' + t } }); }
    if (r.status !== 200) throw new Error((r.data && r.data.error && r.data.error.message) || ('HTTP ' + r.status));
    return r.data;
  }

  async function porIsrc(isrc) {
    if (!isrc) return null;
    for (const base of INST) {
      try {
        const r = await req(base + '/search/?s=' + encodeURIComponent(isrc) + '&type=tracks');
        const d = r.data || {};
        const lista = (d.data && d.data.items) || (d.tracks && d.tracks.items) || d.items || [];
        for (const x of lista) {
          const t = x.track || x;
          if (!t || !t.id || t.allowStreaming === false) continue;
          if ((t.isrc || '').toUpperCase() !== isrc.toUpperCase()) continue;
          return 'https://tidal.com/track/' + t.id;
        }
      } catch (e) {}
    }
    return null;
  }

  const MALAS = ['cover', 'karaoke', 'instrumental', 'tribute', 'slowed', 'reverb', '8d audio', 'en vivo'];

  async function porYoutube(t) {
    const q = (t.artist ? t.artist + ' - ' : '') + t.name + ' audio';
    const j = JSON.parse((await YT.search({ q: q, limit: 12 })).json);
    const c = (j.entries || []).filter(x => x && x.id && x.duration);
    const nom = t.name.toLowerCase(), art = (t.artist || '').toLowerCase().split(/[,&]/)[0].trim();
    let mejor = null, best = -99;
    c.forEach(x => {
      if (t.ms && Math.abs(x.duration - t.ms / 1000) > 8) return;
      let p = 0;
      const canal = (x.channel || x.uploader || '').toLowerCase(), tit = (x.title || '').toLowerCase();
      if (/- topic$/.test(canal)) p += 6;
      if (art && canal.includes(art)) p += 5;
      if (tit.includes(nom)) p += 4;
      MALAS.forEach(m => { if (tit.includes(m) && !nom.includes(m)) p -= 4; });
      if (t.ms) p -= Math.abs(x.duration - t.ms / 1000) / 4;
      if (p > best) { best = p; mejor = x; }
    });
    if (!mejor || best < 3) throw new Error('sin coincidencia exacta');
    return 'https://youtu.be/' + mejor.id;
  }

  async function resolver(t) {
    return (await porIsrc(t.isrc)) || porYoutube(t);
  }

  function pintar() {
    if (!res.length) return cuerpo('<div class="ymsg">Nada encontrado.</div>');
    cuerpo(res.map((t, i) => '<div class="yr" data-sp="' + i + '">'
      + (t.art ? '<img src="' + esc(t.art) + '" alt="" loading="lazy">' : '<div class="no"></div>')
      + '<div class="tx"><b>' + esc(t.name) + (t.explicit ? ' <i class="spe">E</i>' : '') + '</b>'
      + '<span>' + esc(t.artist) + (t.album ? ' · ' + esc(t.album) : '') + (t.ms ? ' · ' + dur(t.ms / 1000) : '') + '</span></div>'
      + (tracks.some(x => x.key === 'sp:' + t.id) ? '<span class="ok">✓</span>' : '<button class="ydl" data-spdl="' + i + '">\u2b07</button>')
      + '</div>').join(''));
  }

  async function buscar(q) {
    const mio = ++seq;
    cuerpo('<div class="ymsg">Buscando…</div>');
    try {
      const d = await sp('/search?type=track&limit=30&market=CO&q=' + encodeURIComponent(q));
      if (mio !== seq) return;
      res = ((d.tracks && d.tracks.items) || []).filter(x => x && x.name && x.artists && x.artists.length).map(x => ({
        id: x.id, name: x.name,
        artist: x.artists.map(a => a.name).join(', '),
        album: x.album && x.album.name,
        art: x.album && x.album.images && x.album.images[0] ? x.album.images[0].url : '',
        ms: x.duration_ms, explicit: x.explicit,
        isrc: (x.external_ids && x.external_ids.isrc) || ''
      }));
      pintar();
    } catch (e) {
      if (mio !== seq) return;
      cuerpo('<div class="ymsg">No respondió (' + esc(e.message) + '). <button class="chip" id="spCfg2">Poner claves</button></div>');
      const b = document.querySelector('#spCfg2');
      if (b) b.onclick = panelClaves;
    }
  }

  async function topArtista(id) {
    const mio = ++seq;
    cuerpo('<div class="ymsg">Cargando artista…</div>');
    try {
      const d = await sp('/artists/' + id + '/top-tracks?market=CO');
      if (mio !== seq) return;
      res = (d.tracks || []).filter(x => x && x.name).map(x => ({
        id: x.id, name: x.name,
        artist: x.artists.map(a => a.name).join(', '),
        album: x.album && x.album.name,
        art: x.album && x.album.images && x.album.images[0] ? x.album.images[0].url : '',
        ms: x.duration_ms, explicit: x.explicit,
        isrc: (x.external_ids && x.external_ids.isrc) || ''
      }));
      pintar();
    } catch (e) { if (mio === seq) cuerpo('<div class="ymsg">Error: ' + esc(e.message) + '</div>'); }
  }

  async function abrir(i) {
    const t = res[i]; if (!t) return;
    const ya = tracks.find(x => x.key === 'sp:' + t.id);
    if (ya) { playList([ya], ya); return window.ytCerrar(); }
    toast('Buscando audio…');
    try {
      const src = await resolver(t);
      const loc = { id: uid(), key: 'sp:' + t.id, name: t.name + ' · ' + t.artist, type: 'musica', played: 0, src: src, art: t.art };
      tracks.push(loc); await save(loc);
      playList([loc], loc);
      window.ytCerrar();
    } catch (e) { toast('No se pudo: ' + e.message); }
  }

  async function descargar(i) {
    const t = res[i]; if (!t) return;
    if (tracks.some(x => x.key === 'sp:' + t.id && x.native)) return toast('Ya está descargada');
    toast('Preparando descarga…');
    try {
      const src = await resolver(t);
      let loc = tracks.find(x => x.key === 'sp:' + t.id);
      if (!loc) { loc = { id: uid(), key: 'sp:' + t.id, name: t.name + ' · ' + t.artist, type: 'musica', played: 0, src: src, art: t.art }; tracks.push(loc); await save(loc); }
      const out = await YT.download({ url: src, id: 'sp-' + t.id });
      loc.native = true; loc.uri = 'file://' + out.path; await save(loc);
      toast('Descargada'); refresh(); pintar();
    } catch (e) { toast('Falló: ' + e.message); }
  }

  document.addEventListener('click', e => {
    const dl = e.target.closest('[data-spdl]');
    if (dl) return descargar(+dl.dataset.spdl);
    const row = e.target.closest('.yr[data-sp]');
    if (row) return abrir(+row.dataset.sp);
    if (e.target.closest('#ytMy, #ytMa') && document.querySelector('#ytSp')) document.querySelector('#ytSp').classList.remove('on');
  });

  function panelClaves() {
    const viejo = document.querySelector('#spOv'); if (viejo) return viejo.remove();
    const c = creds();
    const o = document.createElement('div');
    o.id = 'spOv'; o.className = 'ckov';
    o.innerHTML = '<div class="ckbx"><b>Claves de Spotify</b>'
      + '<p>Crea una app gratis en developer.spotify.com (Web API) y pega Client ID y Secret. Si no quieres, deja vacío y usa la cookie sp_dc.</p>'
      + '<input id="spId" placeholder="Client ID" value="' + esc(c.id || '') + '" style="width:100%;background:#0d0d0d;color:#ddd;border:1px solid #333;border-radius:8px;padding:10px;margin-bottom:8px;box-sizing:border-box">'
      + '<input id="spSec" placeholder="Client Secret" value="' + esc(c.secret || '') + '" style="width:100%;background:#0d0d0d;color:#ddd;border:1px solid #333;border-radius:8px;padding:10px;margin-bottom:8px;box-sizing:border-box">'
      + '<input id="spDc" placeholder="sp_dc (opcional)" value="' + esc(c.dc || '') + '" style="width:100%;background:#0d0d0d;color:#ddd;border:1px solid #333;border-radius:8px;padding:10px;box-sizing:border-box">'
      + '<div class="ckrow"><button id="spGo">Guardar</button><button id="spDel">Borrar</button><button id="spX">Cerrar</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('#spX').onclick = () => o.remove();
    o.querySelector('#spGo').onclick = () => {
      localStorage.setItem('spCred', JSON.stringify({
        id: o.querySelector('#spId').value.trim(),
        secret: o.querySelector('#spSec').value.trim(),
        dc: o.querySelector('#spDc').value.trim()
      }));
      cache = null; o.remove(); toast('Claves guardadas');
    };
    o.querySelector('#spDel').onclick = () => { localStorage.removeItem('spCred'); cache = null; o.remove(); toast('Borradas'); };
  }

  const st = document.createElement('style');
  st.textContent = '.spe{display:inline-block;font-style:normal;font-size:9px;font-weight:700;background:#a7a7a7;color:#000;border-radius:2px;padding:0 3px;vertical-align:middle}';
  document.head.appendChild(st);

  window.spBuscar = buscar;
  window.spClaves = panelClaves;

  const srcOrig = window.srcOf;
  window.srcOf = async function (t) {
    if (t && t.src && !t.native) return (await YT.streamUrl({ url: t.src })).url;
    return srcOrig(t);
  };

  new MutationObserver(() => {
    const ch = document.querySelector('.ych');
    if (!ch || ch.querySelector('#ytSp') || !document.querySelector('#ytMy')) return;
    const a = document.createElement('button');
    a.className = 'chip'; a.id = 'ytSp'; a.textContent = 'Spotify';
    a.onclick = () => {
      document.querySelector('#ytMy').classList.remove('on');
      document.querySelector('#ytMa').classList.remove('on');
      a.classList.add('on');
      const i = document.querySelector('#ytQ');
      const q = i && i.value.trim();
      q ? buscar(q) : cuerpo('<div class="ymsg">Busca un artista o canción.</div>');
    };
    const b = document.createElement('button');
    b.className = 'chip'; b.id = 'ytSpCfg'; b.textContent = 'claves';
    b.onclick = panelClaves;
    ch.insertBefore(a, ch.querySelector('#ytCk'));
    ch.insertBefore(b, ch.querySelector('#ytCk'));
  }).observe(document.body, { childList: true, subtree: true });

  console.log('spotify listo');
})();
