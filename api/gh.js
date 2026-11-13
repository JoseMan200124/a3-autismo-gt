// Intermediario entre el panel /admin/ y la API de GitHub.
// El panel manda la sesión del editor; aquí se valida y se reenvía a GitHub con
// el token del servidor, que nunca llega al navegador. Solo deja leer este
// repositorio y guardar commits en main.
//   /gh/api/v3/<ruta>  → https://api.github.com/<ruta>   (REST, solo lectura)
//   /gh/api/graphql    → https://api.github.com/graphql  (consultas + createCommitOnBranch)
const { REPO, ORIGEN, tokenGitHub, leerSesion } = require('./_lib.js');

const PREFIJO_REPO = '/repos/' + REPO.toLowerCase();
const RAMA = 'main';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGEN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, If-None-Match');
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Link, Retry-After, X-RateLimit-Remaining, X-RateLimit-Reset');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Vary', 'Origin, Authorization');
}

const json = (res, status, datos) => res.status(status).json(datos);

// Datos del editor que ve el panel (y que firma los mensajes de commit).
function perfil(u) {
  return {
    id: Number.parseInt(require('crypto').createHash('sha1').update(u.usuario).digest('hex').slice(0, 8), 16),
    login: u.usuario,
    name: u.nombre || u.usuario,
    email: u.correo || null,
    avatar_url: '',
    html_url: ORIGEN,
  };
}

async function leerCuerpo(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const partes = [];
  for await (const p of req) partes.push(p);
  return JSON.parse(Buffer.concat(partes).toString() || '{}');
}

// Solo se permite la mutación que usa el panel para guardar, y solo sobre main de este repo.
function graphqlPermitido(cuerpo) {
  const q = String(cuerpo && cuerpo.query || '');
  if (!/\bmutation\b/.test(q)) return true;
  const campos = [...q.matchAll(/(\w+)\s*\(\s*input\s*:/g)].map((m) => m[1]);
  if (!campos.length || campos.some((c) => c !== 'createCommitOnBranch')) return false;
  const rama = cuerpo.variables && cuerpo.variables.input && cuerpo.variables.input.branch;
  return !!rama && String(rama.repositoryNameWithOwner || '').toLowerCase() === REPO.toLowerCase() && rama.branchName === RAMA;
}

module.exports = async (req, res) => {
  cors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = String(req.headers.authorization || '');
  const editor = leerSesion(auth.replace(/^(token|bearer)\s+/i, ''));
  if (!editor) return json(res, 401, { message: 'Sesión vencida o no válida. Vuelve a entrar.' });

  // Ruta pedida (viene de la reescritura en vercel.json) y resto de parámetros.
  const url = new URL(req.url, 'https://x');
  const ruta = '/' + String(url.searchParams.get('__p') || '').replace(/^\/+/, '');
  url.searchParams.delete('__p');
  const consulta = url.searchParams.toString();

  if (ruta.includes('..') || ruta.includes('//')) return json(res, 400, { message: 'Ruta no válida.' });

  let destino;
  const opciones = { method: req.method, headers: {
    Authorization: 'Bearer ' + tokenGitHub(),
    Accept: req.headers.accept || 'application/vnd.github+json',
    'User-Agent': 'a3-autismo-panel',
    'X-GitHub-Api-Version': '2022-11-28',
  } };

  if (ruta === '/graphql') {
    if (req.method !== 'POST') return json(res, 405, { message: 'Método no permitido.' });
    let cuerpo;
    try { cuerpo = await leerCuerpo(req); } catch { return json(res, 400, { message: 'JSON no válido.' }); }
    if (!graphqlPermitido(cuerpo)) return json(res, 403, { message: 'Operación no permitida desde el panel.' });
    if (/\bmutation\b/.test(cuerpo.query)) {
      const adds = (cuerpo.variables && cuerpo.variables.input && cuerpo.variables.input.fileChanges && cuerpo.variables.input.fileChanges.additions) || [];
      console.log(`[panel] guardado por ${editor.usuario}: ${adds.map((a) => a.path + ' (' + Math.round(String(a.contents || '').length * 0.75 / 1024) + ' KB)').join(', ')}`);
    }
    destino = 'https://api.github.com/graphql';
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  } else {
    const rest = ruta.replace(/^\/v3(?=\/|$)/, '') || '/';
    if (req.method !== 'GET') return json(res, 405, { message: 'Método no permitido.' });
    if (rest === '/user') return json(res, 200, perfil(editor));
    if (rest === '/user/repository_invitations') return json(res, 200, []);
    const r = rest.toLowerCase();
    if (r !== PREFIJO_REPO && !r.startsWith(PREFIJO_REPO + '/') && r !== '/rate_limit') {
      return json(res, 403, { message: 'Solo se permite este repositorio.' });
    }
    if (req.headers['if-none-match']) opciones.headers['If-None-Match'] = req.headers['if-none-match'];
    destino = 'https://api.github.com' + rest + (consulta ? '?' + consulta : '');
  }

  let resp;
  try { resp = await fetch(destino, opciones); } catch {
    return json(res, 502, { message: 'No se pudo contactar a GitHub.' });
  }
  for (const h of ['content-type', 'etag', 'link', 'retry-after', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const v = resp.headers.get(h);
    if (v) res.setHeader(h, h === 'link' ? v.replaceAll('https://api.github.com/', ORIGEN + '/gh/api/v3/') : v);
  }
  const datos = Buffer.from(await resp.arrayBuffer());
  if (ruta === '/graphql' && (resp.status >= 400 || datos.includes('"errors"'))) {
    console.log(`[panel] GitHub respondió ${resp.status}: ${datos.toString().slice(0, 600)}`);
  }
  return res.status(resp.status).send(datos);
};
