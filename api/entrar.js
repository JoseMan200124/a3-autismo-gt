// Inicio de sesión del panel /admin/ con usuario y contraseña (sin cuenta de GitHub).
// Sveltia CMS abre esta ruta en una ventana emergente; al entrar, la ventana le
// entrega al panel una sesión firmada (no el token de GitHub) y se cierra sola.
const { ORIGEN, crearSesion, autenticar } = require('./_lib.js');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pagina({ error = '', usuario = '', script = '' } = {}) {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Entrar al panel · A³ Autismo Guatemala</title>
<link rel="icon" type="image/png" href="/assets/img/favicon.png">
<style>
  :root{--navy:#0b2c66;--blue:#0058b8;--sky-wash:#eaf6fe;--orange:#f96b22}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--sky-wash);
       font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--navy);padding:16px}
  main{width:100%;max-width:360px;background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 10px 30px rgba(11,44,102,.12)}
  img{display:block;height:56px;margin:0 auto 12px}
  h1{font-size:1.2rem;text-align:center;margin:0 0 20px}
  label{display:block;font-weight:600;font-size:.9rem;margin:14px 0 6px}
  input{width:100%;padding:11px 12px;border:1.5px solid #c9d6ea;border-radius:10px;font:inherit;color:inherit}
  input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px rgba(0,88,184,.15)}
  button{width:100%;margin-top:22px;padding:12px;border:0;border-radius:10px;background:var(--navy);color:#fff;font:inherit;font-weight:600;cursor:pointer}
  button:hover{background:var(--blue)}
  .error{background:#fff1ea;color:#9a3a07;border-radius:10px;padding:10px 12px;font-size:.9rem;margin:0 0 6px}
  .ok{text-align:center}
  small{display:block;text-align:center;margin-top:16px;color:#5a6b88}
</style></head><body><main>
<img src="/assets/img/logo.webp" alt="A³ Autismo Guatemala">
${script ? `<h1 class="ok">Listo, entrando al panel…</h1><small>Esta ventana se cierra sola.</small>` : `
<h1>Panel de edición</h1>
${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
<form method="post" autocomplete="on">
  <label for="u">Usuario</label>
  <input id="u" name="usuario" value="${esc(usuario)}" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
  <label for="c">Contraseña</label>
  <input id="c" name="clave" type="password" autocomplete="current-password" required>
  <button type="submit">Entrar</button>
</form>
<small>¿Olvidaste tu contraseña? Pídele una nueva al administrador del sitio.</small>`}
</main>${script}</body></html>`;
}

// Entrega la sesión a la ventana del panel con el mismo protocolo que usan
// los proveedores OAuth de Decap/Sveltia («authorization:github:success:…»).
function scriptEntrega(token) {
  const msg = 'authorization:github:success:' + JSON.stringify({ provider: 'github', token });
  return `<script>
(function(){
  var msg = ${JSON.stringify(msg).replace(/</g, '\\u003c')};
  if (!window.opener) { document.querySelector('h1').textContent = 'Abre el panel desde autismogt.org/admin/'; return; }
  function recibir(e){
    if (e.origin !== location.origin || e.source !== window.opener) return;
    if (e.data === 'authorizing:github') {
      window.removeEventListener('message', recibir);
      window.opener.postMessage(msg, location.origin);
    }
  }
  window.addEventListener('message', recibir);
  window.opener.postMessage('authorizing:github', location.origin);
})();
</script>`;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function leerFormulario(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  const partes = [];
  for await (const p of req) partes.push(p);
  return Object.fromEntries(new URLSearchParams(Buffer.concat(partes).toString()));
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method === 'GET') return res.status(200).send(pagina());
  if (req.method !== 'POST') return res.status(405).send(pagina({ error: 'Método no permitido.' }));

  // Solo se aceptan formularios enviados desde el propio sitio.
  const origen = req.headers.origin;
  if (origen && origen !== ORIGEN) return res.status(403).send(pagina({ error: 'Origen no permitido.' }));

  const { usuario = '', clave = '' } = await leerFormulario(req);
  const u = autenticar(usuario, clave);
  if (!u) {
    await espera(800); // frena intentos repetidos
    return res.status(401).send(pagina({ error: 'Usuario o contraseña incorrectos.', usuario }));
  }
  console.log(`[panel] entrada: ${u.usuario}`);
  return res.status(200).send(pagina({ script: scriptEntrega(crearSesion(u)) }));
};
