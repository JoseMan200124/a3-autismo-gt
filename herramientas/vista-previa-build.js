#!/usr/bin/env node
// Se ejecuta en Vercel después de «jekyll build». Junta en _site/admin/vista/paquete.json
// la plantilla de la página (index.html sin front matter), los _includes y los datos
// publicados, para que la vista previa del panel arme la página igual que Jekyll.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, '_site', 'admin', 'vista');
const datosJson = path.join(destino, 'datos.json');

const plantilla = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
const includes = {};
for (const f of fs.readdirSync(path.join(raiz, '_includes'))) {
  includes[f] = fs.readFileSync(path.join(raiz, '_includes', f), 'utf8');
}
const datos = JSON.parse(fs.readFileSync(datosJson, 'utf8'));

fs.writeFileSync(path.join(destino, 'paquete.json'), JSON.stringify({ plantilla, includes, datos }));
fs.unlinkSync(datosJson);
console.log(`[vista previa] paquete.json listo (${Object.keys(datos).length} archivos de datos, ${Object.keys(includes).length} includes)`);
