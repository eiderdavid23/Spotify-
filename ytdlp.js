/* Fuente YouTube (yt-dlp). Se engancha a Buscar sin tocar app.js */
(function () {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) return;
  const YT = Capacitor.registerPlugin('YtDlp');

  let ytOn = false, ytRes = [], ytSeq = 0, ytTimer = null, ultimo = 0;

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
    + '.ckov{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.7);display:flex;align-items:flex-end}'
    + '.ckbx{width:100%;background:#181818;border-radius:14px 14px 0 0;padding:18px;color:#eee;font-size:14px}'
    + '.ckbx p{color:#a7a7a7;font-size:13px;margin:6px 0 12px}'
    + '.ckbx textarea{width:100%;height:130px;background:#0d0d0d;color:#ddd;border:1px solid #333;border-radius:8px;padding:10px;font-family:monospace;font-size:11px;box-sizing:border-box}'
    + '.ckrow{display:flex;gap:8px;margin-top:12px}'
    + '.ckrow button{flex:1;padding:11px;border-radius:999px;border:0;background:#2a2a2a;color:#eee;font:inherit;font-size:13px}'
    + '.ckrow #ckGo{background:#1ed760;color:#000;font-weight:700}';
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

  /* ---- descargar ---- */
  YT.addListener('downloadProgress', e => {
    const n = Math.round(e.progress || 0);
    if (Date.now() - ultimo < 700) return;
    ultimo = Date.now();
    toast('Descargando… ' + n + '%');
  });

  async function ytDownload(i) {
    const r = ytRes[i]; if (!r) return;
    const key = 'yt:' + r.id;
    if (tracks.some(x => x.key === key)) { toast('Ya esta descargada'); return; }
    toast('Descargando…');
    try {
      const out = await YT.download({ url: 'https://youtu.be/' + r.id, id: 'yt-' + r.id });
      const t = { id: yid(), key: key, name: r.title + ' · ' + r.ch, type: 'musica', played: 0, native: true, uri: 'file://' + out.path, art: r.thumb };
      tracks.push(t); await save(t); refresh();
      toast('Descargada');
    } catch (err) {
      toast('Fallo la descarga');
    }
  }

  /* ---- cookies ---- */
  let conCookies = false;
  try { YT.hasCookies().then(r => { conCookies = !!r.value; }).catch(() => {}); } catch (x) {}

  function panelCookies() {
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
      return;
    }
  });
})();
