#!/usr/bin/env node
// Se ejecuta en Vercel después de «jekyll build». Junta en _site/admin/vista/paquete.json
// la plantilla de la página (index.html sin front matter), los _includes y los datos
// publicados, para que la vista previa del panel arme la página igual que Jekyll.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, '_site', 'admin', 'vista');
const datosJson = path.join(destino, 'datos.json');

const sinFrontMatter = (f) => fs.readFileSync(path.join(raiz, f), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
const plantilla = sinFrontMatter('index.html');
const layouts = { pagina: sinFrontMatter('_layouts/pagina.html'), entrada: sinFrontMatter('_layouts/entrada.html') };
const includes = {};
for (const f of fs.readdirSync(path.join(raiz, '_includes'))) {
  includes[f] = fs.readFileSync(path.join(raiz, '_includes', f), 'utf8');
}
const datos = JSON.parse(fs.readFileSync(datosJson, 'utf8'));

fs.writeFileSync(path.join(destino, 'paquete.json'), JSON.stringify({ plantilla, layouts, includes, datos }));
fs.unlinkSync(datosJson);
console.log(`[vista previa] paquete.json listo (${Object.keys(datos.data).length} archivos de datos, ${datos.posts.length} entradas, ${Object.keys(includes).length} includes)`);
