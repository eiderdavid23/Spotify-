/* Portadas en linea para audios sin caratula. Se engancha a refresh() */
(function () {
  if (!window.Capacitor || !Capacitor.isNativePlatform()) return;
  if (!window.refresh) return;

  const hechos = new Set();
  let pintando = false;
  const MAX = 4;

  function partes(t) {
    const n = (t.name || '').replace(/\.(m4a|mp3|flac|opus|ogg|wav|aac)$/i, '');
    if (n.indexOf(' · ') > -1) {
      const trozos = n.split(' · ');
      return { ti: trozos[0].trim(), ar: (t.artist || trozos[1] || '').trim() };
    }
    return { ti: n.trim(), ar: (t.artist || '').trim() };
  }

  const limpiar = s => s
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((official|video|audio|lyrics|letra|hd|hq|remaster)[^)]*\)/gi, ' ')
    .replace(/official\s*(video|audio|music\s*video)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  async function aDataUrl(url) {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) throw new Error('http ' + r.status);
    const b = await r.blob();
    return await new Promise((ok, mal) => {
      const f = new FileReader();
      f.onload = () => ok(f.result);
      f.onerror = mal;
      f.readAsDataURL(b);
    });
  }

  async function buscar(t) {
    const { ti, ar } = partes(t);
    const titulo = limpiar(ti);
    if (titulo.length < 2) return false;
    const term = encodeURIComponent((titulo + ' ' + limpiar(ar)).trim());
    const url = 'https://itunes.apple.com/search?entity=song&limit=3&term=' + term;
    let j;
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) throw new Error('http ' + r.status);
      j = await r.json();
    } catch (x) {
      return false;
    }
    const hit = (j.results || []).find(x => x && x.artworkUrl100);
    if (!hit) return false;
    const grande = hit.artworkUrl100.replace('100x100', '600x600');
    let art = grande;
    try { art = await aDataUrl(grande); } catch (x) {}
    t.art = art;
    t.artv = 2;
    if (hit.artistName && !t.artist) t.artist = hit.artistName;
    await save(t);
    return true;
  }

  async function tanda() {
    if (pintando) return;
    pintando = true;
    let n = 0;
    const lista = (window.tracks || []).filter(t =>
      t && !t.art && (t.artv || 0) < 2 && t.name && !hechos.has(t.id));
    for (const t of lista) {
      if (n >= MAX) break;
      hechos.add(t.id);
      n++;
      try { await buscar(t); } catch (x) {}
      await new Promise(r => setTimeout(r, 350));
    }
    pintando = false;
    if (n > 0 && lista.length > 0) {
      try { refresh(); } catch (x) {}
    }
  }

  const rOrig = window.refresh;
  window.refresh = function () {
    const salida = rOrig.apply(this, arguments);
    setTimeout(tanda, 700);
    return salida;
  };
})();
