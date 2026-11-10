/* Buscador propio de YouTube (yt-dlp) */
(function () {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) return;

  const PAGINA = 20;
  const MAX = 60;

  let YT = null;
  let modo = 'yt';
  let seq = 0, timer = null, descargando = null, res = [], ver = 0, aud = [];
  let conCookies = false, nativosPrevios = [];

  const dur = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const titulo = t => t.name.split(' · ')[0];
  const canal = t => t.name.split(' · ').slice(1).join(' · ');
  const yid = () => 'yt-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  try { arrancar(); } catch (e) { try { toast('YouTube: ' + e.message); } catch (x) {} }

  function arrancar() {
    YT = Capacitor.registerPlugin('YtDlp');

    const st = document.createElement('style');
    st.textContent = '.yta{position:fixed;inset:0;z-index:850;background:#121212;display:flex;flex-direction:column;padding-top:env(safe-area-inset-top)}'
      + '.yh{display:flex;gap:8px;align-items:center;padding:10px 12px}'
      + '.yib{background:transparent;border:0;color:#eee;padding:8px;display:flex}'
      + '.ysb{flex:1;display:flex;gap:8px;align-items:center;background:#242424;border-radius:8px;padding:9px 12px;color:#a7a7a7}'
      + '.ysb input{flex:1;background:transparent;border:0;outline:0;color:#eee;font:inherit;font-size:15px;min-width:0}'
      + '.ych{display:flex;gap:8px;padding:0 12px 8px;overflow-x:auto;scrollbar-width:none}'
      + '.ych::-webkit-scrollbar{display:none}'
      + '.ych .chip{white-space:nowrap;padding:6px 12px;border-radius:999px;border:1px solid #3a3a3a;background:transparent;color:#cfcfcf;font:inherit;font-size:12px}'
      + '.ych .chip.on{background:#1ed760;border-color:#1ed760;color:#000;font-weight:700}'
      + '.ybody{flex:1;overflow-y:auto;padding:0 12px 120px}'
      + '.yr{display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #1e1e1e}'
      + '.yr img,.yr .no{width:52px;height:52px;border-radius:6px;object-fit:cover;background:#282828;flex:none}'
      + '.yr .tx{flex:1;min-width:0}'
      + '.yr b{display:block;font-size:14px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.yr span{display:block;font-size:12px;color:#a7a7a7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.yr .ok{color:#1ed760;font-size:18px;padding:0 6px}'
      + '.ydl{background:transparent;border:0;color:#b3b3b3;font-size:20px;padding:8px}'
      + '.ymsg{padding:28px 4px;color:#a7a7a7;font-size:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
      + '.ymore{display:block;width:100%;margin:16px 0 8px;padding:11px;border-radius:999px;border:1px solid #3a3a3a;background:transparent;color:#eee;font:inherit;font-size:13px}'
      + '.yhst{display:flex;gap:8px;flex-wrap:wrap;padding:4px 0 12px}'
      + '.yhst button{padding:7px 13px;border-radius:999px;border:1px solid #333;background:#1c1c1c;color:#ddd;font:inherit;font-size:13px}'
      + '.dlov{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.7);display:flex;align-items:flex-end}'
      + '.dlbx{width:100%;background:#181818;border-radius:14px 14px 0 0;padding:18px;color:#eee;font-size:14px}'
      + '.dltit{display:block;margin-bottom:12px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.dlbar{height:6px;border-radius:999px;background:#2a2a2a;overflow:hidden}'
      + '.dlbar i{display:block;height:100%;width:0;background:#1ed760;transition:width .3s linear}'
      + '.dlbar.ind i{width:35%;animation:dlInd 1.1s ease-in-out infinite alternate}'
      + '@keyframes dlInd{from{transform:translateX(-60%)}to{transform:translateX(220%)}}'
      + '.dlrow{display:flex;gap:8px;margin-top:12px;align-items:center;justify-content:space-between}'
      + '.dlrow button{flex:1;padding:11px;border-radius:999px;border:0;background:#2a2a2a;color:#eee;font:inherit;font-size:13px}'
      + '.dlrow span{font-size:12px;color:#a7a7a7}'
      + '.dlrow #dlC{color:#ff7b7b}'
      + '.ckov{position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.7);display:flex;align-items:flex-end}'
      + '.ckbx{width:100%;background:#181818;border-radius:14px 14px 0 0;padding:18px;color:#eee;font-size:14px}'
      + '.ckbx p{color:#a7a7a7;font-size:13px;margin:6px 0 12px}'
      + '.ckbx textarea{width:100%;height:130px;background:#0d0d0d;color:#ddd;border:1px solid #333;border-radius:8px;padding:10px;font-family:monospace;font-size:11px;box-sizing:border-box}'
      + '.ckrow{display:flex;gap:8px;margin-top:12px}'
      + '.ckrow button{flex:1;padding:11px;border-radius:999px;border:0;background:#2a2a2a;color:#eee;font:inherit;font-size:13px}'
      + '.ckrow #ckGo{background:#1ed760;color:#000;font-weight:700}';
    document.head.appendChild(st);

    /* ---------- pantalla ---------- */
    let pantalla = null;

    function crear() {
      const o = document.createElement('div');
      o.id = 'ytApp';
      o.className = 'yta';
      o.hidden = true;
      o.innerHTML = '<div class="yh"><button class="yib" id="ytBack">' + ic('back', 26) + '</button>'
        + '<div class="ysb">' + ic('search', 20) + '<input id="ytQ" placeholder="Buscar en YouTube" enterkeyhint="search" autocomplete="off" spellcheck="false"></div>'
        + '<button class="yib" id="ytX">' + ic('x', 24) + '</button></div>'
        + '<div class="ych"><button class="chip' + (modo === 'yt' ? ' on' : '') + '" id="ytMy">YouTube</button>'
        + '<button class="chip' + (modo === 'aud' ? ' on' : '') + '" id="ytMa">Audius</button>'
        + '<button class="chip" id="ytSp">Spotify</button>'
        + '<button class="chip" id="ytSpCfg">claves</button>'
        + '<button class="chip" id="ytCk">cookies</button>'
        + '<button class="chip" id="ytUp">actualizar extractor</button>'
        + '<button class="chip" id="ytRs">restaurar</button></div>'
        + '<div class="ybody"><div id="ytRes"></div></div>';

      o.querySelector('#ytBack').onclick = cerrar;
      o.querySelector('#ytX').onclick = () => {
        const i = o.querySelector('#ytQ');
        i.value = ''; res = []; aud = []; historial();
        i.focus();
      };
      const i = o.querySelector('#ytQ');
      i.oninput = () => {
        clearTimeout(timer);
        const q = i.value.trim();
        if (q.length < 2) { seq++; res = []; aud = []; historial(); return; }
        cuerpo('<div class="ymsg">Buscando…</div>');
        timer = setTimeout(() => buscar(q), 420);
      };
      i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); buscar(i.value.trim()); } };
      o.querySelector('#ytMy').onclick = () => { modo = 'yt'; marcarModo(); const q = i.value.trim(); q ? buscar(q) : historial(); };
      o.querySelector('#ytMa').onclick = () => { modo = 'aud'; marcarModo(); const q = i.value.trim(); q ? buscar(q) : historial(); };
      o.querySelector('#ytSp').onclick = () => { modo = 'sp'; marcarModo(); const q = i.value.trim(); q ? buscar(q) : historial(); };
      o.querySelector('#ytSpCfg').onclick = () => window.spClaves && window.spClaves();
      o.querySelector('#ytCk').onclick = panelCookies;
      o.querySelector('#ytUp').onclick = async () => {
        toast('Actualizando extractor…');
        try { await YT.update(); toast('Extractor actualizado'); }
        catch (x) { toast('No se pudo actualizar'); }
      };
      o.querySelector('#ytRs').onclick = async () => {
        toast('Restaurando extractor…');
        try { await YT.restore(); toast('Restaurado, reinicia la app'); }
        catch (x) { toast('No se pudo restaurar'); }
      };
      return o;
    }

    function marcarModo() {
      if (!pantalla) return;
      pantalla.querySelector('#ytMy').classList.toggle('on', modo === 'yt');
      pantalla.querySelector('#ytMa').classList.toggle('on', modo === 'aud');
      const sp = pantalla.querySelector('#ytSp');
      if (sp) sp.classList.toggle('on', modo === 'sp');
    }

    function cuerpo(html) {
      const r = document.querySelector('#ytRes');
      if (r) r.innerHTML = html;
    }

    function abrir(q) {
      if (!pantalla) { pantalla = crear(); document.body.appendChild(pantalla); }
      pantalla.hidden = false;
      history.pushState({ yt: 1 }, '');
      const i = pantalla.querySelector('#ytQ');
      i.value = q || '';
      if (q) buscar(q); else { historial(); setTimeout(() => i.focus(), 60); }
    }
    window.ytAbrir = abrir;
    window.ytCerrar = cerrar;

    function cerrar() {
      if (!pantalla || pantalla.hidden) return;
      pantalla.hidden = true;
      if (history.state && history.state.yt) history.back();
    }

    window.addEventListener('popstate', () => {
      if (pantalla && !pantalla.hidden) pantalla.hidden = true;
    });

    /* ---------- historial ---------- */
    function hist() {
      try { return JSON.parse(localStorage.getItem('ytHist') || '[]'); } catch (e) { return []; }
    }
    function guardarHist(q) {
      const L = hist().filter(x => x !== q);
      L.unshift(q);
      localStorage.setItem('ytHist', JSON.stringify(L.slice(0, 12)));
    }
    function historial() {
      const L = hist();
      cuerpo(L.length
        ? '<h2 style="padding:6px 0">Búsquedas recientes</h2><div class="yhst">'
          + L.map(q => '<button data-h="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>'
        : '<div class="ymsg">Escribe el nombre de una canción o artista.</div>');
    }

    /* ---------- busqueda ---------- */
    async function buscar(q) {
      q = (q || '').trim();
      if (!q) return;
      guardarHist(q);
      if (modo === 'aud') return buscarAudius(q);
      if (modo === 'sp') return window.spBuscar ? window.spBuscar(q) : null;
      const mio = ++seq;
      ver = PAGINA;
      cuerpo('<div class="ymsg">Buscando en YouTube…</div>');
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
          d: x.duration || 0,
          thumb: x.thumbnails && x.thumbnails.length ? x.thumbnails[x.thumbnails.length - 1].url : ''
        }));
      } catch (err) {
        if (mio !== seq) return;
        cuerpo('<div class="ymsg">YouTube no respondió. Toca "actualizar extractor" o reintenta. '
          + '<button class="chip" id="ytFall">Probar con Audius</button></div>');
        const f = document.querySelector('#ytFall');
        if (f) f.onclick = () => { modo = 'aud'; marcarModo(); buscar(q); };
        return;
      }
      if (mio !== seq) return;
      res = items;
      pintar();
    }

    function pintar() {
      if (!res.length) { cuerpo('<div class="ymsg">Nada encontrado.</div>'); return; }
      cuerpo(res.slice(0, ver).map((r, i) => {
        const ya = tracks.some(x => x.key === 'yt:' + r.id && x.native);
        return '<div class="yr" data-i="' + i + '">'
          + (r.thumb ? '<img src="' + esc(r.thumb) + '" alt="" loading="lazy">' : '<div class="no"></div>')
          + '<div class="tx"><b>' + esc(r.title) + '</b><span>' + esc(r.ch) + (r.d ? ' · ' + dur(r.d) : '') + '</span></div>'
          + (ya ? '<span class="ok">✓</span>' : '<button class="ydl" data-i="' + i + '">\u2b07</button>')
          + '</div>';
      }).join('') + (ver < res.length ? '<button class="ymore" id="ytMore">Ver más resultados</button>' : ''));
      const m = document.querySelector('#ytMore');
      if (m) m.onclick = () => { ver = Math.min(res.length, ver + PAGINA); pintar(); };
    }

    async function buscarAudius(q) {
      const mio = ++seq;
      cuerpo('<div class="ymsg">Buscando en Audius…</div>');
      try {
        const r = (await aj('/tracks/search', { query: q, limit: 25 }) || [])
          .filter(x => x && x.user && x.title && x.is_streamable !== false && !x.is_delete);
        if (mio !== seq) return;
        aud = r;
        if (!r.length) { cuerpo('<div class="ymsg">Nada encontrado en Audius.</div>'); return; }
        cuerpo(r.map((x, i) => '<div class="yr" data-aud="' + i + '">'
          + (artOf(x) ? '<img src="' + esc(artOf(x)) + '" alt="" loading="lazy">' : '<div class="no"></div>')
          + '<div class="tx"><b>' + esc(x.title) + '</b><span>' + esc(x.user.name) + '</span></div>'
          + '<span class="ok">+</span></div>').join(''));
      } catch (e) {
        if (mio !== seq) return;
        cuerpo('<div class="ymsg">Audius no respondió (' + esc(e.message) + ').</div>');
      }
    }

    /* ---------- clics de la lista ---------- */
    document.addEventListener('click', async e => {
      const h = e.target.closest('[data-h]');
      if (h) { const i = document.querySelector('#ytQ'); if (i) i.value = h.dataset.h; buscar(h.dataset.h); return; }

      const dl = e.target.closest('.ydl');
      if (dl) { descargarDesde(+dl.dataset.i); return; }

      const ar = e.target.closest('[data-aud]');
      if (ar) {
        const x = aud[+ar.dataset.aud]; if (!x) return;
        toast('Cargando…');
        const t = await addRemote(x);
        playList([t], t); cerrar();
        return;
      }

      const row = e.target.closest('.yr[data-i]');
      if (row) {
        const r = res[+row.dataset.i]; if (!r) return;
        toast('Cargando…');
        const t = await asegurar(r);
        playList([t], t); cerrar();
      }
    });

    /* ---------- pistas ---------- */
    async function asegurar(r) {
      let t = tracks.find(x => x.yt === r.id);
      if (!t) {
        t = { id: yid(), key: 'yt:' + r.id, name: r.title + ' · ' + (r.ch || 'YouTube'), type: 'musica', played: 0, yt: r.id, art: r.thumb };
        tracks.push(t); await save(t);
      }
      return t;
    }

    const sOrig = window.srcOf;
    window.srcOf = async function (t) {
      if (t && t.yt && !t.native) return (await YT.streamUrl({ url: 'https://youtu.be/' + t.yt })).url;
      return sOrig(t);
    };

    /* ---------- descargas ---------- */
    function cerrarPanel() {
      const o = document.querySelector('#dlOv');
      if (o) o.remove();
    }

    function panel(tituloTxt) {
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
      if (eta) eta.textContent = e.eta > 0 ? 'quedan ' + dur(e.eta) : '';
    });

    async function descargar(t) {
      if (!t || !t.yt || t.native) return;
      if (descargando) { toast('Ya hay una descarga en marcha'); return; }
      const fileId = 'yt-' + t.yt;
      descargando = fileId;
      const p = panel(t.name);
      p.querySelector('#dlBar').classList.add('ind');
      try {
        const out = await YT.download({ url: 'https://youtu.be/' + t.yt, id: fileId });
        t.native = true; t.uri = 'file://' + out.path; await save(t);
        nativosPrevios = urisNativas();
        descargando = null;
        cerrarPanel();
        toast('Descargada');
        refresh();
        if (!pantalla || pantalla.hidden) return;
        if (modo === 'yt') pintar();
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

    async function descargarDesde(i) {
      const r = res[i]; if (!r) return;
      if (tracks.some(x => x.key === 'yt:' + r.id && x.native)) { toast('Ya está descargada'); return; }
      const t = await asegurar(r);
      descargar(t);
    }

    /* ---------- menu ⋯ de una cancion de YouTube ---------- */
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

    /* ---------- entrada en Buscar y en Crear ---------- */
    function entrada() {
      const box = document.querySelector('#sres');
      if (!box || !box.parentNode || document.getElementById('ytEntrar')) return;
      const d = document.createElement('div');
      d.id = 'ytEntrar';
      d.className = 'row';
      d.innerHTML = '<div class="cv" style="width:48px;height:48px;border-radius:6px;background:#c4302b;color:#fff;display:flex;align-items:center;justify-content:center">'
        + ic('play', 22, true) + '</div><div class="tx"><b>Buscar en YouTube</b>'
        + '<span>Escucha y descarga de YouTube</span></div>';
      box.parentNode.insertBefore(d, box);
    }

    new MutationObserver(() => {
      entrada();
      if (pantalla && !pantalla.hidden && modo === 'aud') marcarModo();
    }).observe(document.body, { childList: true, subtree: true });
    entrada();

    document.addEventListener('click', e => {
      if (!e.target.closest('#ytEntrar')) return;
      abrir();
    });

    const crOrig = window.openCreate;
    if (crOrig) {
      window.openCreate = function () {
        crOrig.apply(this, arguments);
        setTimeout(() => {
          if (sheetKind !== 'create') return;
          const sh = document.querySelector('#sheet .sh');
          if (!sh || sh.querySelector('[data-a="ytgo"]')) return;
          const d = document.createElement('div');
          d.className = 'si';
          d.dataset.a = 'ytgo';
          d.innerHTML = '<div class="ic">' + ic('down', 26) + '</div><div><b>Descargar de YouTube</b>'
            + '<span class="d">Busca por nombre y baja el audio</span></div>';
          sh.insertBefore(d, sh.children[1] || null);
        }, 0);
      };
    }
    document.addEventListener('click', e => {
      if (!e.target.closest('[data-a="ytgo"]')) return;
      hideSheet();
      abrir();
    });

    /* ---------- cookies ---------- */
    function panelCookies() {
      const viejo = document.querySelector('#ckOv');
      if (viejo) { viejo.remove(); return; }
      const o = document.createElement('div');
      o.id = 'ckOv';
      o.className = 'ckov';
      o.innerHTML = '<div class="ckbx"><b>Cookies de YouTube</b>'
        + '<p>Sirve cuando sale "Sign in to confirm you\'re not a bot". Exporta cookies.txt de una sesión iniciada y pega el contenido.</p>'
        + '<textarea id="ckTx" spellcheck="false" placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1790000000&#9;SID&#9;..."></textarea>'
        + '<div class="ckrow"><button id="ckGo">Guardar</button><button id="ckDel">Borrar</button><button id="ckX">Cerrar</button></div></div>';
      document.body.appendChild(o);
      o.querySelector('#ckX').onclick = () => o.remove();
      o.querySelector('#ckGo').onclick = async () => {
        try {
          await YT.setCookies({ text: o.querySelector('#ckTx').value || '' });
          conCookies = true;
          const c = pantalla && pantalla.querySelector('#ytCk');
          if (c) c.classList.add('on');
          o.remove();
          toast('Cookies guardadas');
        } catch (x) { toast('Cookies invalidas'); }
      };
      o.querySelector('#ckDel').onclick = async () => {
        try {
          await YT.clearCookies();
          conCookies = false;
          const c = pantalla && pantalla.querySelector('#ytCk');
          if (c) c.classList.remove('on');
          o.remove();
          toast('Cookies borradas');
        } catch (x) { toast('No se pudieron borrar'); }
      };
    }

    /* ---------- borrado de archivos huerfanos ---------- */
    function urisNativas() {
      return tracks.filter(t => t && t.native && t.uri).map(t => t.uri);
    }
    nativosPrevios = urisNativas();

    function revisar(antes, ahora) {
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
        revisar(antes, ahora);
        return salida;
      };
    }

    setInterval(function () {
      const ahora = urisNativas();
      const antes = nativosPrevios;
      nativosPrevios = ahora;
      revisar(antes, ahora);
    }, 4000);

    try { YT.hasCookies().then(r => { conCookies = !!r.value; }).catch(() => {}); } catch (x) {}

    console.log('buscador yt listo');
  }
})();
