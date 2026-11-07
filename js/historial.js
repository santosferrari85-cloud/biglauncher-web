(() => {
  const REPO = 'santosferrari85-cloud/biglauncher-web';
  const API = `https://api.github.com/repos/${REPO}/releases?per_page=100`;
  const PAGINA_RELEASES = `https://github.com/${REPO}/releases`;
  // La API sin autenticar admite 60 peticiones por hora y IP; con la caché de sesión
  // recargar la página o cambiar de idioma no gasta peticiones.
  const CLAVE_CACHE = 'biglauncher-releases';
  const DURACION_CACHE_MS = 10 * 60 * 1000;

  const TEXTOS = {
    es: {
      actual: 'Versión actual',
      sinNotas: 'Primera versión publicada.',
      descargas: 'Descargas',
      verEnGithub: 'Ver en GitHub',
      vacio: 'Todavía no hay versiones publicadas.',
      error: 'No se ha podido cargar el historial de versiones.',
      enlaceError: 'Consúltalo en GitHub',
    },
    en: {
      actual: 'Current version',
      sinNotas: 'First published release.',
      descargas: 'Downloads',
      verEnGithub: 'View on GitHub',
      vacio: 'No releases have been published yet.',
      error: "The release history couldn't be loaded.",
      enlaceError: 'See it on GitHub',
    },
  };

  const contenedor = document.getElementById('historial');
  if (!contenedor) return;
  const txt = TEXTOS[contenedor.dataset.idioma] || TEXTOS.es;

  const escapar = (s) => s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  const enLinea = (s) => escapar(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  // Las notas de las releases son listas Markdown sencillas; basta con listas,
  // párrafos y títulos, sin cargar un parser completo.
  function markdownAHtml(md) {
    const html = [];
    let enLista = false;
    const cerrarLista = () => {
      if (enLista) { html.push('</ul>'); enLista = false; }
    };
    for (const bruta of md.replace(/\r/g, '').split('\n')) {
      const linea = bruta.trim();
      if (!linea) { cerrarLista(); continue; }
      const item = linea.match(/^[-*]\s+(.*)$/);
      if (item) {
        if (!enLista) { html.push('<ul>'); enLista = true; }
        html.push(`<li>${enLinea(item[1])}</li>`);
        continue;
      }
      cerrarLista();
      const titulo = linea.match(/^#{1,6}\s+(.*)$/);
      html.push(titulo ? `<h4>${enLinea(titulo[1])}</h4>` : `<p>${enLinea(linea)}</p>`);
    }
    cerrarLista();
    return html.join('');
  }

  function pintar(releases) {
    const publicadas = releases.filter((r) => !r.draft && !r.prerelease);
    if (!publicadas.length) {
      contenedor.innerHTML = `<p class="historial-estado">${txt.vacio}</p>`;
      return;
    }
    contenedor.innerHTML = publicadas.map((r, i) => {
      const cuerpo = (r.body || '').trim();
      const descargas = (r.assets || []).map((a) =>
        `<a href="${escapar(a.browser_download_url)}" rel="noopener">${escapar(a.name)}</a>`).join('');
      return `
        <details class="historial-version"${i === 0 ? ' open' : ''}>
          <summary>
            <span class="historial-nombre">${escapar(r.tag_name)}</span>
            ${i === 0 ? `<span class="historial-actual">${txt.actual}</span>` : ''}
          </summary>
          <div class="historial-cuerpo">
            ${cuerpo ? markdownAHtml(cuerpo) : `<p>${txt.sinNotas}</p>`}
            <div class="historial-enlaces">
              ${descargas ? `<span>${txt.descargas}:</span>${descargas}` : ''}
              <a href="${escapar(r.html_url)}" target="_blank" rel="noopener" class="historial-github">${txt.verEnGithub}</a>
            </div>
          </div>
        </details>`;
    }).join('');
  }

  function pintarError() {
    contenedor.innerHTML = `<p class="historial-estado">${txt.error}
      <a href="${PAGINA_RELEASES}" target="_blank" rel="noopener">${txt.enlaceError}</a>.</p>`;
  }

  function leerCache() {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(CLAVE_CACHE));
      if (guardado && Date.now() - guardado.fecha < DURACION_CACHE_MS) return guardado.datos;
    } catch { /* sin almacenamiento disponible */ }
    return null;
  }

  function guardarCache(datos) {
    try {
      sessionStorage.setItem(CLAVE_CACHE, JSON.stringify({ fecha: Date.now(), datos }));
    } catch { /* sin almacenamiento disponible */ }
  }

  const enCache = leerCache();
  if (enCache) { pintar(enCache); return; }

  fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((datos) => {
      if (!Array.isArray(datos)) throw new Error('Respuesta inesperada');
      const minimos = datos.map(({ tag_name, name, body, html_url, draft, prerelease, assets }) => ({
        tag_name, name, body, html_url, draft, prerelease,
        assets: (assets || []).map(({ name: n, browser_download_url }) => ({ name: n, browser_download_url })),
      }));
      guardarCache(minimos);
      pintar(minimos);
    })
    .catch(pintarError);
})();
