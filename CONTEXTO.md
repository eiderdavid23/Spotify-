# Clon de Spotify - CONTEXTO

## Reglas de trabajo
- Cada tarea terminada se marca [x] aquí para continuar en otros chats.
- Código propio, sin assets ni marca de Spotify.
- Stack: HTML + CSS + JS (PWA). Se sube a GitHub desde Termux.
- Música: archivos propios o fuentes libres (Jamendo/Audius).

## Tareas
- [x] Estructura base y diseño (sidebar, biblioteca, reproductor)
- [x] Reproductor (play, pausa, siguiente, barra de progreso)
- [x] Shuffle real sin repeticiones
- [x] Modo solo música (ocultar podcasts/audiolibros)
- [x] Fijar 20+ favoritos arriba de la biblioteca
- [x] Recientes siempre visibles
- [x] Modo offline (PWA + service worker)
- [x] Botón "sorpréndeme"
- Guardado local con IndexedDB (las canciones persisten al recargar)
- URL: https://eiderdavid23.github.io/Spotify-/
- PWA: manifest.json + sw.js (network-first, cache del shell). Sorpréndeme prioriza lo nunca escuchado.
- [x] Búsqueda y streaming desde Audius (tocar un resultado lo guarda en la biblioteca)
- Las canciones de Audius necesitan internet; no funcionan offline. Siempre se muestra el artista (requisito de Audius).
- Si Audius responde 401/403: botón 🔑 para pegar API key (registro en audius.co/settings).
- Pendiente: descargar canciones de Audius para offline, Jamendo como segunda fuente.
- [x] Descarga offline de canciones de Audius (botón ⬇, se guarda como blob en IndexedDB, marca ✅)
- [x] Importar música del teléfono: botón 📁 (selección múltiple o carpeta si el navegador la soporta), con detección de repetidas
- Limitación: una web no puede escanear el almacenamiento sola; se importa una vez y queda guardada. Las importadas se copian al navegador (ocupan espacio).
- Pendiente: Jamendo como segunda fuente, app nativa (Capacitor) si se quiere escaneo automático.
