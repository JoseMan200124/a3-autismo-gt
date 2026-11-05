#!/usr/bin/env node
// Administra los usuarios del panel /admin/ (api/_usuarios.json).
//   node herramientas/usuario-panel.js crear <usuario> "<Nombre visible>" [correo]
//   node herramientas/usuario-panel.js clave <usuario>      (genera contraseña nueva)
//   node herramientas/usuario-panel.js quitar <usuario>
//   node herramientas/usuario-panel.js lista
// Luego: git commit + git push; Vercel publica y el cambio queda activo.
// Las contraseñas se generan al azar y solo se muestran una vez; en el repo queda
// únicamente su hash (scrypt), nunca la contraseña.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ARCHIVO = path.join(__dirname, '..', 'api', '_usuarios.json');
const leer = () => (fs.existsSync(ARCHIVO) ? JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) : []);
const guardar = (l) => fs.writeFileSync(ARCHIVO, JSON.stringify(l, null, 2) + '\n');

// 4 bloques de 4 caracteres sin letras confusas (0/O, 1/l/I): ~80 bits de azar.
function claveNueva() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bloques = [];
  for (let b = 0; b < 4; b++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += abc[crypto.randomInt(abc.length)];
    bloques.push(s);
  }
  return bloques.join('-');
}

function hash(clave) {
  const N = 16384, r = 8, p = 1;
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(clave, sal, 32, { N, r, p });
  return ['scrypt', N, r, p, sal.toString('base64url'), h.toString('base64url')].join('$');
}

const [accion, usuarioArg, nombre, correo] = process.argv.slice(2);
const usuario = String(usuarioArg || '').trim().toLowerCase();
const lista = leer();

if (accion === 'lista') {
  for (const u of lista) console.log(`${u.usuario}\t${u.nombre}${u.correo ? '\t' + u.correo : ''}`);
  process.exit(0);
}
if (!usuario || !/^[a-z0-9._-]{3,30}$/.test(usuario)) {
  console.error('Usuario no válido (3–30 caracteres: letras, números, punto, guion).');
  process.exit(1);
}
const i = lista.findIndex((u) => u.usuario === usuario);

if (accion === 'crear') {
  if (i >= 0) { console.error('Ese usuario ya existe; usa «clave» para cambiarle la contraseña.'); process.exit(1); }
  const clave = claveNueva();
  lista.push({ usuario, nombre: nombre || usuario, ...(correo ? { correo } : {}), hash: hash(clave) });
  guardar(lista);
  console.log(`${usuario}\t${clave}`);
} else if (accion === 'clave') {
  if (i < 0) { console.error('No existe ese usuario.'); process.exit(1); }
  const clave = claveNueva();
  lista[i].hash = hash(clave);
  guardar(lista);
  console.log(`${usuario}\t${clave}`);
} else if (accion === 'quitar') {
  if (i < 0) { console.error('No existe ese usuario.'); process.exit(1); }
  lista.splice(i, 1);
  guardar(lista);
  console.log(`Quitado: ${usuario}`);
} else {
  console.error('Acción: crear | clave | quitar | lista');
  process.exit(1);
}
