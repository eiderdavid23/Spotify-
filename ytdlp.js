/* Fuente YouTube (yt-dlp). Se engancha a Buscar sin tocar app.js */
(function () {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) return;
  const YT = Capacitor.registerPlugin('YtDlp');

  let ytOn = false, ytRes = [], ytSeq = 0, ytTimer = null, descargando = null;

  const yid = () => 'yt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

  const st = document.createElement('style');
  st.textContent = '.chips{display:flex;gap:8px;margin:10px 0;align-items:center}'
    + '.chip{padding:7px 14px;border-radius:999px;border:1px solid #3a3a3a;background:transparent;color:#cfcfcf;font:inherit;font-size:13px}'
    + '.chip.on{background:#1ed760;border-color:#1ed760;color:#000;font-weight:700}'
    + '.ytrow .ytim{width:48px;height:48px;border-radius:6px;object-fit:cover;background:#282828;flex:none}'
    + '.yt-load{padding:24px 4px;color:#a7a7a7;font-size:14px}'
    + '.ytdl{background:transparent;border:0;color:#b3b3b3;font-size:19px;padding:8px;cursor:pointer}'
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

  /* ---- interfaz: chips de fuente dentro de Buscar ---- */
  const vOrig = window.vSearch;
  window.vSearch = function () {
    return vOrig().replace('<div id="sres">',
      '<div class="chips"><button class="chip' + (ytOn ? '' : ' on') + '" id="srcA">Audius</button>'
      + '<button class="chip' + (ytOn ? ' on' : '') + '" id="srcY">YouTube</button>'
      + '<button class="chipre" id="srcC">' + (conCookies ? 'cookies ✓' : 'cookies') + '</button>'
      + '<button class="chipre" id="srcU">actualizar extractor</button><button class="chipre" id="srcR">restaurar</button></div><div id="sres">');
  };

  const dOrig = window.doSearch;
  window.doSearch = function () { return ytOn ? ytSearch() : dOrig(); };

  const sOrig = window.srcOf;
  window.srcOf = async function (t) {
    if (t.yt) return (await YT.streamUrl({ url: 'https://youtu.be/' + t.yt })).url;
    return sOrig(t);
  };

  document.addEventListener('click', async e => {
    if (e.target.closest('#srcA') || e.target.closest('#srcY')) {
      ytOn = !!e.target.closest('#srcY');
      const a = document.querySelector('#srcA'), y = document.querySelector('#srcY');
      if (a) a.classList.toggle('on', !ytOn);
      if (y) y.classList.toggle('on', ytOn);
      const r = document.querySelector('#sres'); if (r) r.innerHTML = '';
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
    if (dl) { ytDownload(+dl.dataset.i); return; }
    const row = e.target.closest('.ytrow');
    if (row) ytPlay(+row.dataset.i);
  });

  /* ---- busqueda ---- */
  function ytSearch() {
    clearTimeout(ytTimer);
    ytTimer = setTimeout(ytBuscar, 400);
  }

  async function ytBuscar() {
    const q = (sq || '').trim();
    const box = document.querySelector('#sres'); if (!box) return;
    if (!q) { box.innerHTML = ''; return; }
    const mio = ++ytSeq;
    box.innerHTML = '<div class="yt-load">Buscando en YouTube…</div>';
    let items = [];
    try {
      const j = JSON.parse((await YT.search({ q })).json);
      items = (j.entries || []).filter(x => x && x.id).map(x => ({
        id: x.id,
        title: x.title || '(sin titulo)',
        ch: x.channel || x.uploader || '',
        dur: x.duration || 0,
        thumb: x.thumbnails && x.thumbnails.length ? x.thumbnails[x.thumbnails.length - 1].url : ''
      }));
    } catch (err) {
      if (mio !== ytSeq) return;
      box.innerHTML = '<div class="yt-load">YouTube no respondio. Toca "actualizar extractor" o reintenta.</div>';
      return;
    }
    if (mio !== ytSeq) return;
    ytRes = items;
    render();
  }

  function render() {
    const box = document.querySelector('#sres'); if (!box) return;
    if (!ytRes.length) { box.innerHTML = '<div class="yt-load">Nada encontrado.</div>'; return; }
    box.innerHTML = ytRes.map((r, i) =>
      '<div class="row ytrow" data-i="' + i + '">'
      + (r.thumb ? '<img class="ytim" src="' + r.thumb + '" alt="">' : '<div class="ytim"></div>')
      + '<div class="tx"><b>' + esc(r.title) + '</b><span>' + esc(r.ch) + (r.dur ? ' · ' + fmt(r.dur) : '') + '</span></div>'
      + '<button class="ytdl" data-i="' + i + '">\u2b07</button></div>').join('');
  }

  /* ---- reproducir ---- */
  async function ytPlay(i) {
    const r = ytRes[i]; if (!r) return;
    toast('Cargando…');
    let t = tracks.find(x => x.yt === r.id);
    if (!t) {
      t = { id: yid(), name: r.title + ' · ' + r.ch, type: 'musica', played: 0, yt: r.id, art: r.thumb };
      tracks.push(t); await save(t);
    }
    playList([t], t); refresh();
  }

  /* ---- descarga con progreso ---- */
  function cerrarPanel() {
    const o = document.querySelector('#dlOv');
    if (o) o.remove();
  }

  function panelDescarga(titulo) {
    cerrarPanel();
    const o = document.createElement('div');
    o.id = 'dlOv';
    o.className = 'dlov';
    o.innerHTML = '<div class="dlbx"><b class="dltit"></b>'
      + '<div class="dlbar" id="dlBar"><i id="dlFill"></i></div>'
      + '<div class="dlrow"><span id="dlPct">0%</span><span id="dlEta"></span></div>'
      + '<div class="dlrow"><button id="dlX">Ocultar</button><button id="dlC">Cancelar</button></div></div>';
    document.body.appendChild(o);
    o.querySelector('.dltit').textContent = titulo;
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

  async function ytDownload(i) {
    const r = ytRes[i]; if (!r) return;
    const key = 'yt:' + r.id;
    if (tracks.some(x => x.key === key)) { toast('Ya esta descargada'); return; }
    const fileId = 'yt-' + r.id;
    descargando = fileId;
    const p = panelDescarga(r.title + ' · ' + r.ch);
    p.querySelector('#dlBar').classList.add('ind');
    try {
      const out = await YT.download({ url: 'https://youtu.be/' + r.id, id: fileId });
      const t = { id: yid(), key: key, name: r.title + ' · ' + r.ch, type: 'musica', played: 0, native: true, uri: 'file://' + out.path, art: r.thumb };
      tracks.push(t); await save(t); refresh();
      nativosPrevios = urisNativas();
      descargando = null;
      cerrarPanel();
      toast('Descargada');
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

  /* ---- borrado: si una cancion nativa sale de la biblioteca, borra su archivo ---- */
  function urisNativas() {
    return (window.tracks || []).filter(t => t && t.native && t.uri).map(t => t.uri);
  }
  let nativosPrevios = urisNativas();

  const rOrig = window.refresh;
  if (rOrig) {
    window.refresh = function () {
      const antes = nativosPrevios;
      const salida = rOrig.apply(this, arguments);
      const ahora = urisNativas();
      nativosPrevios = ahora;
      antes.filter(u => ahora.indexOf(u) < 0).forEach(u => {
        const base = decodeURIComponent(u.split('/').pop()).replace(/\.[^.]+$/, '');
        setTimeout(() => {
          if (!urisNativas().includes(u)) {
            try { YT.borrarArchivo({ id: base }).catch(() => {}); } catch (x) {}
          }
        }, 2500);
      });
      return salida;
    };
  }

  /* ---- cookies ---- */
  let conCookies = false;
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
})();
