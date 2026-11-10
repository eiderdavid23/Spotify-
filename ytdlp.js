/* Fuente YouTube (yt-dlp). Se engancha a Buscar sin tocar app.js */
(function () {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) return;
  const YT = Capacitor.registerPlugin('YtDlp');

  const PAGINA = 20;   /* resultados que se muestran por tanda */
  const MAX = 60;      /* resultados que se le piden a yt-dlp */

  let conCookies = false;
  let ytOn = localStorage.getItem('fuente') !== 'audius';
  let ytRes = [], ytSeq = 0, ytTimer = null, descargando = null;
  let ytBusy = false, ytErr = '', ytLoc = '', ytVer = 0;

  window.ytActivo = () => ytOn;

  const yid = () => 'yt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const titulo = t => t.name.split(' · ')[0];
  const canal = t => t.name.split(' · ').slice(1).join(' · ');

  const st = document.createElement('style');
  st.textContent = '.chips{display:flex;gap:8px;margin:10px 0;align-items:center;flex-wrap:wrap}'
    + '.chip{padding:7px 14px;border-radius:999px;border:1px solid #3a3a3a;background:transparent;color:#cfcfcf;font:inherit;font-size:13px}'
    + '.chip.on{background:#1ed760;border-color:#1ed760;color:#000;font-weight:700}'
    + '.ytrow .ytim{width:48px;height:48px;border-radius:6px;object-fit:cover;background:#282828;flex:none}'
    + '.ytrow .ok{color:#1ed760;font-size:18px;padding:0 8px}'
    + '.yt-load{padding:24px 4px;color:#a7a7a7;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
    + '.ytdl{background:transparent;border:0;color:#b3b3b3;font-size:19px;padding:8px;cursor:pointer}'
    + '.ytmore{display:block;width:100%;margin:14px 0 24px;padding:11px;border-radius:999px;border:1px solid #3a3a3a;background:transparent;color:#eee;font:inherit;font-size:13px}'
    + '.chipre{margin-left:auto;background:transparent;border:0;color:#8a8a8a;font-size:12px}'
    + '.ckov,.dlov{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.7);display:flex;align-items:flex-end}'
    + '.ckbx,.dlbx{width:100%;background:#181818;border-radius:14px 14px 0 0;padding:18px;color:#eee;font-size:14px}'
    + '.ckbx p{color:#a7a7a7;font-size:13px;margin:6px 0 12px}'
    + '.ckbx textarea{width:100%;height:130px;background:#0d0d0d;color:#ddd;border:1px solid #333;border-radius:8px;padding:10px;font-family:monospace;font-size:11px;box-sizing:border-box}'
    + '.ckrow,.dlrow{display:flex;gap:8px;margin-top:12px;align-items:center;justify-content:space-between}'
    + '.ckrow button,.dlrow button{flex:1;padding:11px;border-radius:999px;border:0;background:#2a2a2a;color:#eee;font:inherit;font-size:13px}'
    + '.ckrow #ckGo{background:#1ed760;color:#000;font-weight:700}'
    + '.dltit{display:block;margin-bottom:12px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.dlbar{height:6px;border-radius:999px;background:#2a2a2a;overflow:hidden}'
    + '.dlbar i{display:block;height:100%;width:0;background:#1ed760;transition:width .3s linear}'
    + '.dlbar.ind i{width:35%;animation:dlInd 1.1s ease-in-out infinite alternate}'
    + '@keyframes dlInd{from{transform:translateX(-60%)}to{transform:translateX(220%)}}'
    + '.dlrow span{font-size:12px;color:#a7a7a7}'
    + '.dlrow #dlC{color:#ff7b7b}';
  document.head.appendChild(st);

  /* ---- chips de fuente dentro de Buscar ---- */
  const vOrig = window.vSearch;
  window.vSearch = function () {
    return vOrig().replace('<div id="sres">',
      '<div class="chips"><button class="chip' + (ytOn ? ' on' : '') + '" id="srcY">YouTube</button>'
      + '<button class="chip' + (ytOn ? '' : ' on') + '" id="srcA">Audius</button>'
      + '<button class="chipre" id="srcC">' + (conCookies ? 'cookies ✓' : 'cookies') + '</button>'
      + '<button class="chipre" id="srcU">actualizar extractor</button>'
      + '<button class="chipre" id="srcR">restaurar</button></div><div id="sres">');
  };

  const dOrig = window.doSearch;
  window.doSearch = function () { return ytOn ? ytBuscar() : dOrig(); };

  const sOrig = window.srcOf;
  window.srcOf = async function (t) {
    if (t && t.yt && !t.native) return (await YT.streamUrl({ url: 'https://youtu.be/' + t.yt })).url;
    return sOrig(t);
  };

  function pintar() {
    const box = document.querySelector('#sres'); if (!box) return;
    let h = ytLoc;
    if (ytBusy) h += '<div class="yt-load">Buscando en YouTube…</div>';
    else if (ytErr) h += '<div class="yt-load">' + esc(ytErr)
      + ' <button class="chip" id="ytA">Probar con Audius</button></div>';
    else if (!ytRes.length) h += '<div class="yt-load">Nada encontrado en YouTube.</div>';
    else h += '<h2>En YouTube</h2>' + ytRes.slice(0, ytVer).map(filaYt).join('')
      + (ytVer < ytRes.length ? '<button class="ytmore" id="ytMore">Ver más resultados</button>' : '');
    box.innerHTML = h;
  }

  function repintar() {
    if (!ytOn || !sq.trim()) return;
    if (!document.querySelector('#sres')) return;
    pintar();
  }

  const rdOrig = window.render;
  if (rdOrig) window.render = function () { const o = rdOrig.apply(this, arguments); repintar(); return o; };

  document.addEventListener('click', async e => {
    if (e.target.closest('#srcA') || e.target.closest('#srcY')) {
      ytOn = !!e.target.closest('#srcY');
      localStorage.setItem('fuente', ytOn ? 'youtube' : 'audius');
      const a = document.querySelector('#srcA'), y = document.querySelector('#srcY');
      if (a) a.classList.toggle('on', !ytOn);
      if (y) y.classList.toggle('on', ytOn);
      const r = document.querySelector('#sres'); if (r) r.innerHTML = '';
      if (sq.trim()) { if (ytOn) ytBuscar(); else dOrig(); }
      return;
    }
    if (e.target.closest('#ytA')) {
      ytOn = false; localStorage.setItem('fuente', 'audius');
      const a = document.querySelector('#srcA'), y = document.querySelector('#srcY');
      if (a) a.classList.add('on');
      if (y) y.classList.remove('on');
      dOrig();
      return;
    }
    if (e.target.closest('#ytMore')) {
      ytVer = Math.min(ytRes.length, ytVer + PAGINA);
      pintar();
      return;
    }
    if (e.target.closest('#srcR')) {
      toast('Restaurando extractor…');
      try { await YT.restore(); toast('Extractor restaurado, reinicia la app'); }
      catch (x) { toast('No se pudo restaurar'); }
      return;
    }
    if (e.target.closest('#srcU')) {
      toast('Actualizando extractor…');
      try { await YT.update(); toast('Extractor actualizado'); }
      catch (x) { toast('No se pudo actualizar'); }
      return;
    }
    const dl = e.target.closest('.ytdl');
    if (dl) { ytDescargarDesde(+dl.dataset.i); return; }
    const row = e.target.closest('.ytrow');
    if (row) ytPlay(+row.dataset.i);
  });

  /* ---- busqueda ---- */
  function ytSearch() {
    clearTimeout(ytTimer);
    ytTimer = setTimeout(ytBuscar, 400);
  }

  function locales(q) {
    const L = tracks.filter(t => t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
    if (!L.length) return '';
    return '<h2>En tu biblioteca</h2>' + L.map(t =>
      '<div class="row" data-a="play" data-v="' + esc(t.id) + '" data-c="one">'
      + '<div class="tx"><b>' + esc(titulo(t)) + '</b><span>' + esc(canal(t) || 'Tu música') + '</span></div></div>'
    ).join('');
  }

  async function ytBuscar() {
    const q = (sq || '').trim();
    const box = document.querySelector('#sres'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    const mio = ++ytSeq;
    ytBusy = true; ytErr = ''; ytRes = []; ytVer = PAGINA;
    ytLoc = locales(q);
    pintar();
    let items = [];
    try {
      const j = JSON.parse((await YT.search({ q, limit: MAX })).json);
      const vistos = new Set();
      items = (j.entries || []).filter(x => {
        if (!x || !x.id || vistos.has(x.id)) return false;
        vistos.add(x.id);
        return true;
      }).map(x => ({
        id: x.id,
        title: x.title || '(sin titulo)',
        ch: x.channel || x.uploader || '',
        dur: x.duration || 0,
        thumb: x.thumbnails && x.thumbnails.length ? x.thumbnails[x.thumbnails.length - 1].url : ''
      }));
    } catch (err) {
      if (mio !== ytSeq) return;
      ytBusy = false;
      ytErr = 'YouTube no respondió. Toca "actualizar extractor" o reintenta.';
      pintar();
      return;
    }
    if (mio !== ytSeq) return;
    ytBusy = false;
    ytRes = items;
    pintar();
  }

  function filaYt(r, i) {
    const ya = tracks.some(x => x.key === 'yt:' + r.id && x.native);
    return '<div class="row ytrow" data-i="' + i + '">'
      + (r.thumb ? '<img class="ytim" src="' + r.thumb + '" alt="" loading="lazy">' : '<div class="ytim"></div>')
      + '<div class="tx"><b>' + esc(r.title) + '</b><span>' + esc(r.ch) + (r.dur ? ' · ' + fmt(r.dur) : '') + '</span></div>'
      + (ya ? '<span class="ok">✓</span>' : '<button class="ytdl" data-i="' + i + '">\u2b07</button>')
      + '</div>';
  }

  /* ---- reproducir ---- */
  async function asegurar(r) {
    let t = tracks.find(x => x.yt === r.id);
    if (!t) {
      t = { id: yid(), key: 'yt:' + r.id, name: r.title + ' · ' + (r.ch || 'YouTube'), type: 'musica', played: 0, yt: r.id, art: r.thumb };
      tracks.push(t); await save(t);
    }
    return t;
  }

  async function ytPlay(i) {
    const r = ytRes[i]; if (!r) return;
    toast('Cargando…');
    const t = await asegurar(r);
    playList([t], t);
  }

  /* ---- descarga con progreso ---- */
  function cerrarPanel() {
    const o = document.querySelector('#dlOv');
    if (o) o.remove();
  }

  function panelDescarga(tituloTxt) {
    cerrarPanel();
    const o = document.createElement('div');
    o.id = 'dlOv';
    o.className = 'dlov';
    o.innerHTML = '<div class="dlbx"><b class="dltit"></b>'
      + '<div class="dlbar" id="dlBar"><i id="dlFill"></i></div>'
      + '<div class="dlrow"><span id="dlPct">0%</span><span id="dlEta"></span></div>'
      + '<div class="dlrow"><button id="dlX">Ocultar</button><button id="dlC">Cancelar</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('.dltit').textContent = tituloTxt;
    o.querySelector('#dlX').onclick = cerrarPanel;
    o.querySelector('#dlC').onclick = async () => {
      if (descargando) {
        try { await YT.cancel({ id: descargando }); } catch (x) {}
        toast('Descarga cancelada');
      }
      descargando = null;
      cerrarPanel();
    };
    return o;
  }

  YT.addListener('downloadProgress', e => {
    if (!descargando || (e.id && e.id !== descargando)) return;
    const bar = document.querySelector('#dlBar'), fill = document.querySelector('#dlFill');
    if (!bar || !fill) return;
    const n = Math.round(e.progress || 0);
    if (n < 0) { bar.classList.add('ind'); return; }
    bar.classList.remove('ind');
    fill.style.width = Math.max(0, Math.min(100, n)) + '%';
    const pct = document.querySelector('#dlPct'); if (pct) pct.textContent = n + '%';
    const eta = document.querySelector('#dlEta');
    if (eta) eta.textContent = e.eta > 0 ? 'quedan ' + fmt(e.eta) : '';
  });

  async function descargar(t) {
    if (!t || !t.yt || t.native) return;
    if (descargando) { toast('Ya hay una descarga en marcha'); return; }
    const fileId = 'yt-' + t.yt;
    descargando = fileId;
    const p = panelDescarga(t.name);
    p.querySelector('#dlBar').classList.add('ind');
    try {
      const out = await YT.download({ url: 'https://youtu.be/' + t.yt, id: fileId });
      t.native = true; t.uri = 'file://' + out.path; await save(t);
      nativosPrevios = urisNativas();
      descargando = null;
      cerrarPanel();
      toast('Descargada');
      refresh();
    } catch (err) {
      descargando = null;
      const b = document.querySelector('.dlbx');
      if (b) {
        b.querySelector('.dltit').textContent = 'Fallo la descarga';
        b.querySelector('#dlC').textContent = 'Cerrar';
        b.querySelector('#dlC').onclick = cerrarPanel;
        b.querySelector('#dlPct').textContent = '';
        b.querySelector('#dlEta').textContent = String(err && err.message || '');
      }
    }
  }

  async function ytDescargarDesde(i) {
    const r = ytRes[i]; if (!r) return;
    if (tracks.some(x => x.key === 'yt:' + r.id && x.native)) { toast('Ya está descargada'); return; }
    const t = await asegurar(r);
    descargar(t);
  }

  /* ---- menu de la cancion: añade Descargar tambien para las de YouTube ---- */
  const tmOrig = window.trackMenu;
  if (tmOrig) {
    window.trackMenu = function (id) {
      tmOrig.apply(this, arguments);
      const t = tracks.find(x => x.id === id);
      if (!t || !t.yt || t.native) return;
      setTimeout(() => {
        if (sheetKind !== 'menu') return;
        const sh = document.querySelector('#sheet .sh');
        if (!sh || sh.querySelector('[data-a="ytdlm"]')) return;
        const d = document.createElement('div');
        d.className = 'si sm';
        d.dataset.a = 'ytdlm';
        d.dataset.v = id;
        d.innerHTML = '<div class="ic">' + ic('dl', 20) + '</div><b>Descargar para escuchar sin internet</b>';
        sh.appendChild(d);
      }, 0);
    };
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a="ytdlm"]');
    if (!el) return;
    const t = tracks.find(x => x.id === el.dataset.v);
    hideSheet();
    if (t) descargar(t);
  });

  /* ---- borrado: si una cancion nativa sale de la biblioteca, borra su archivo ---- */
  function urisNativas() {
    return tracks.filter(t => t && t.native && t.uri).map(t => t.uri);
  }
  let nativosPrevios = urisNativas();

  function revisarBorrados(antes, ahora) {
    antes.filter(u => ahora.indexOf(u) < 0).forEach(u => {
      const base = decodeURIComponent(u.split('/').pop()).replace(/\.[^.]+$/, '');
      setTimeout(() => {
        if (!urisNativas().includes(u)) {
          try { YT.borrarArchivo({ id: base }).catch(() => {}); } catch (x) {}
        }
      }, 2500);
    });
  }

  const rOrig = window.refresh;
  if (rOrig) {
    window.refresh = function () {
      const antes = nativosPrevios;
      const salida = rOrig.apply(this, arguments);
      const ahora = urisNativas();
      nativosPrevios = ahora;
      revisarBorrados(antes, ahora);
      repintar();
      return salida;
    };
  }

  /* ---- cookies ---- */
  try { YT.hasCookies().then(r => { conCookies = !!r.value; }).catch(() => {}); } catch (x) {}

  function panelCookies() {
    cerrarPanel();
    const viejo = document.querySelector('#ckOv');
    if (viejo) viejo.remove();
    const o = document.createElement('div');
    o.id = 'ckOv';
    o.className = 'ckov';
    o.innerHTML = '<div class="ckbx"><b>Cookies de YouTube</b>'
      + '<p>Sirve cuando sale "Sign in to confirm you\'re not a bot". Exporta cookies.txt de una sesion iniciada y pega el contenido.</p>'
      + '<textarea id="ckTx" spellcheck="false" placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1790000000&#9;SID&#9;..."></textarea>'
      + '<div class="ckrow"><button id="ckGo">Guardar</button>'
      + '<button id="ckDel">Borrar</button><button id="ckX">Cerrar</button></div></div>';
    document.body.appendChild(o);
  }

  document.addEventListener('click', async e => {
    if (e.target.closest('#srcC')) { panelCookies(); return; }
    if (e.target.closest('#ckX')) { const o = document.querySelector('#ckOv'); if (o) o.remove(); return; }
    if (e.target.closest('#ckGo')) {
      const t = (document.querySelector('#ckTx') || {}).value || '';
      try {
        await YT.setCookies({ text: t });
        conCookies = true;
        const o = document.querySelector('#ckOv'); if (o) o.remove();
        toast('Cookies guardadas');
      } catch (x) { toast('Cookies invalidas'); }
      return;
    }
    if (e.target.closest('#ckDel')) {
      try {
        await YT.clearCookies();
        conCookies = false;
        const o = document.querySelector('#ckOv'); if (o) o.remove();
        toast('Cookies borradas');
      } catch (x) { toast('No se pudieron borrar'); }
    }
  });

  /* red de seguridad: revisa la lista cada 4 s por si el borrado no repinta */
  setInterval(function () {
    const ahora = urisNativas();
    const antes = nativosPrevios;
    nativosPrevios = ahora;
    revisarBorrados(antes, ahora);
  }, 4000);
})();
