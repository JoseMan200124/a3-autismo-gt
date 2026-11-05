// Utilidades compartidas del panel: usuarios, contraseñas y sesiones.
// Los archivos de api/ que empiezan con «_» no se publican como rutas en Vercel.
const crypto = require('crypto');
const USUARIOS = require('./_usuarios.json');

const REPO = 'JoseMan200124/a3-autismo-gt';
const ORIGEN = 'https://autismogt.org';
const DURACION_SESION = 12 * 60 * 60; // segundos

// Token de GitHub (fine-grained, solo este repo, Contents: lectura y escritura).
// Vive únicamente en las variables de entorno de Vercel.
function tokenGitHub() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('Falta GITHUB_TOKEN en Vercel');
  return t;
}

// Clave para firmar sesiones. Si se cambia PANEL_SECRET (o el token de GitHub),
// todas las sesiones abiertas se cierran.
function claveSesion() {
  const base = process.env.PANEL_SECRET || tokenGitHub();
  return crypto.createHash('sha256').update('a3-panel-sesion:' + base).digest();
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');

function firmar(datos) {
  const cuerpo = b64(JSON.stringify(datos));
  const firma = b64(crypto.createHmac('sha256', claveSesion()).update(cuerpo).digest());
  return 'a3.' + cuerpo + '.' + firma;
}

function crearSesion(usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  return firmar({ u: usuario.usuario, iat: ahora, exp: ahora + DURACION_SESION });
}

// Devuelve el usuario si la sesión es válida, vigente y el usuario sigue activo.
function leerSesion(token) {
  if (typeof token !== 'string' || !token.startsWith('a3.')) return null;
  const [, cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;
  const esperada = crypto.createHmac('sha256', claveSesion()).update(cuerpo).digest();
  const recibida = Buffer.from(firma, 'base64url');
  if (recibida.length !== esperada.length || !crypto.timingSafeEqual(recibida, esperada)) return null;
  let datos;
  try { datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString()); } catch { return null; }
  if (!datos.exp || datos.exp < Date.now() / 1000) return null;
  const usuario = USUARIOS.find((x) => x.usuario === datos.u && x.activo !== false);
  return usuario || null;
}

// Contraseñas guardadas como scrypt: «scrypt$N$r$p$sal$hash» (base64url).
function verificarClave(clave, guardado) {
  const [alg, N, r, p, sal, hash] = String(guardado).split('$');
  if (alg !== 'scrypt') return false;
  const esperado = Buffer.from(hash, 'base64url');
  const calculado = crypto.scryptSync(String(clave), Buffer.from(sal, 'base64url'), esperado.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(calculado, esperado);
}

// Hash de relleno para que un usuario inexistente tarde lo mismo que uno real.
const HASH_FALSO = 'scrypt$16384$8$1$' + b64(Buffer.alloc(16)) + '$' + b64(Buffer.alloc(32));

function autenticar(nombreUsuario, clave) {
  const u = USUARIOS.find((x) => x.usuario === String(nombreUsuario || '').trim().toLowerCase() && x.activo !== false);
  const ok = verificarClave(clave || '', u ? u.hash : HASH_FALSO);
  return ok && u ? u : null;
}

module.exports = { REPO, ORIGEN, USUARIOS, tokenGitHub, crearSesion, leerSesion, autenticar };
