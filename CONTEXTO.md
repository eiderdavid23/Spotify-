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
- [x] App nativa Android con Capacitor 7, compilada en GitHub Actions (.github/workflows/android.yml); el APK sale en Releases
- [x] Escaneo automático del teléfono con @odion-cloud/capacitor-mediastore (ignora audios de menos de 30 s; no copia archivos)
- Si hay cambios en GitHub (ej. la firma debug.keystore), antes de subir hacer: git pull --rebase
- Pendiente: reproducción en segundo plano y controles en pantalla de bloqueo, icono propio, Jamendo
- [x] Segundo plano + controles en notificación (@jofr/capacitor-media-session 4.x). Por eso el proyecto usa Capacitor 6 y Java 17 en el workflow
- [x] Icono propio generado en CI (make-icons.js + icon.svg + icon-fg.svg)
- [x] Jamendo como segunda fuente (requiere Client ID gratis; botón 🔑 guarda Jamendo y Audius)
- Si Jamendo falla con "Failed to fetch" en la app: es CORS; activar "plugins":{"CapacitorHttp":{"enabled":true}} en capacitor.config.json
- Nota: el plugin de media session es GPL-3.0 (el repo es público, no hay problema para uso personal)
