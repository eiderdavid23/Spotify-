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
    + '.chipre{margin-left:auto;background:transparent;border:0;color:#8a8a8a;font-size:12px}';
  document.head.appendChild(st);

  /* ---- interfaz: chips de fuente dentro de Buscar ---- */
  const vOrig = window.vSearch;
  window.vSearch = function () {
    return vOrig().replace('<div id="sres">',
      '<div class="chips"><button class="chip' + (ytOn ? '' : ' on') + '" id="srcA">Audius</button>'
      + '<button class="chip' + (ytOn ? ' on' : '') + '" id="srcY">YouTube</button>'
      + '<button class="chipre" id="srcU">actualizar extractor</button></div><div id="sres">');
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
})();
