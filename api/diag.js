// Registro de errores del panel /admin/: el navegador avisa aquí cuando un guardado
// o una petición falla, para verlo en los registros de Vercel («[panel-diag] …»).
// No guarda nada ni devuelve datos; solo escribe una línea recortada en el registro.
const { ORIGEN, leerSesion } = require('./_lib.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const origen = String(req.headers.origin || '');
  if (origen && origen !== ORIGEN) return res.status(403).end();
  let datos = req.body;
  try {
    if (typeof datos === 'string') datos = JSON.parse(datos);
  } catch { datos = { texto: String(req.body) }; }
  const editor = leerSesion(String((datos && datos.sesion) || ''));
  if (datos) delete datos.sesion;
  const linea = JSON.stringify(datos || {}).slice(0, 1500);
  console.log(`[panel-diag] ${editor ? editor.usuario : 'sin-sesion'} ua=${String(req.headers['user-agent'] || '').slice(0, 160)} ${linea}`);
  return res.status(204).end();
};
