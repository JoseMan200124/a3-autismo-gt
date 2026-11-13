// Arreglos para que el panel pueda guardar siempre, cargado ANTES de Sveltia CMS.
//
// 1) Fotos livianas en cualquier navegador. Sveltia convierte las fotos a webp,
//    pero Safari (iPhone/iPad/Mac) no sabe crear webp y devuelve un PNG enorme
//    (2–6 MB por foto). Aquí, si el navegador no entrega webp, la foto se guarda
//    como JPEG (calidad 82). Solo se deja en PNG si la imagen tiene transparencia.
//
// 2) Guardados grandes partidos en varios commits. Vercel rechaza cualquier
//    petición de más de 4,5 MB (error 413) y Sveltia solo muestra «Se produjo un
//    error al guardar la entrada». Si un guardado pasa del límite, se envía en
//    varios commits seguidos, cada uno encadenado al anterior.
(function () {
  'use strict';

  // ---------- 1) Fotos: JPEG cuando no hay webp ----------
  if (typeof OffscreenCanvas !== 'undefined' && OffscreenCanvas.prototype.convertToBlob) {
    var original = OffscreenCanvas.prototype.convertToBlob;
    var tieneTransparencia = function (lienzo) {
      try {
        var ctx = lienzo.getContext('2d');
        if (!ctx) return false;
        var px = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
        for (var i = 3; i < px.length; i += 4) if (px[i] < 250) return true;
      } catch (e) { /* lienzo sin contexto 2d: se trata como opaco */ }
      return false;
    };
    OffscreenCanvas.prototype.convertToBlob = function (opciones) {
      var lienzo = this;
      return original.call(lienzo, opciones).then(function (blob) {
        var pedido = opciones && opciones.type;
        // El lienzo de 1×1 con que Sveltia prueba si hay webp no se toca.
        if (pedido !== 'image/webp' || blob.type === 'image/webp' || lienzo.width * lienzo.height <= 1) return blob;
        if (tieneTransparencia(lienzo)) return blob;
        var calidad = typeof opciones.quality === 'number' ? opciones.quality : 0.82;
        return original.call(lienzo, { type: 'image/jpeg', quality: calidad });
      });
    };
  }

  // ---------- 2) Guardados en partes ----------
  var LIMITE = 3500000; // bytes por petición (Vercel corta en 4,5 MB; se deja margen)
  var fetchOriginal = window.fetch.bind(window);

  function avisar(texto) {
    var caja = document.createElement('div');
    caja.setAttribute('role', 'alert');
    caja.textContent = texto;
    caja.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;' +
      'max-width:min(560px,calc(100% - 32px));background:#9a3a07;color:#fff;padding:14px 18px;border-radius:12px;' +
      'font:15px/1.45 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer';
    caja.addEventListener('click', function () { caja.remove(); });
    document.body.appendChild(caja);
    setTimeout(function () { caja.remove(); }, 15000);
  }

  function respuestaError(mensaje) {
    return new Response(JSON.stringify({ message: mensaje, errors: [{ message: mensaje }] }), {
      status: 413, headers: { 'Content-Type': 'application/json' },
    });
  }

  async function guardarEnPartes(url, init, cuerpo) {
    var input = cuerpo.variables.input;
    var adiciones = (input.fileChanges && input.fileChanges.additions) || [];
    var borrados = (input.fileChanges && input.fileChanges.deletions) || [];
    var base = JSON.stringify(Object.assign({}, cuerpo, { variables: { input: Object.assign({}, input, { fileChanges: {} }) } })).length + 2000;

    // Agrupa los archivos para que cada petición quede bajo el límite.
    var grupos = [[]];
    var tam = base;
    adiciones.forEach(function (a) {
      var t = JSON.stringify(a).length;
      if (base + t > LIMITE) throw Object.assign(new Error('grande'), { archivo: a.path, bytes: t });
      if (grupos[grupos.length - 1].length && tam + t > LIMITE) { grupos.push([]); tam = base; }
      grupos[grupos.length - 1].push(a);
      tam += t;
    });

    var cabeza = input.expectedHeadOid;
    var respuesta;
    for (var i = 0; i < grupos.length; i++) {
      var ultimo = i === grupos.length - 1;
      var parte = Object.assign({}, input, {
        expectedHeadOid: cabeza,
        fileChanges: Object.assign({ additions: grupos[i] }, ultimo && borrados.length ? { deletions: borrados } : {}),
        message: ultimo ? input.message : Object.assign({}, input.message, {
          headline: input.message.headline + ' (parte ' + (i + 1) + ' de ' + grupos.length + ')',
        }),
      });
      respuesta = await fetchOriginal(url, Object.assign({}, init, {
        body: JSON.stringify(Object.assign({}, cuerpo, { variables: Object.assign({}, cuerpo.variables, { input: parte }) })),
      }));
      if (ultimo) return respuesta;
      var datos;
      try { datos = await respuesta.clone().json(); } catch (e) { return respuesta; }
      var oid = datos && datos.data && datos.data.createCommitOnBranch && datos.data.createCommitOnBranch.commit &&
        datos.data.createCommitOnBranch.commit.oid;
      if (!respuesta.ok || !oid) return respuesta;
      cabeza = oid;
    }
    return respuesta;
  }

  window.fetch = async function (recurso, init) {
    try {
      var url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
      var body = init && init.body;
      if (/\/gh\/api\/graphql$/.test(url) && typeof body === 'string' && body.length > LIMITE &&
          body.indexOf('createCommitOnBranch') !== -1) {
        var cuerpo = JSON.parse(body);
        if (cuerpo && cuerpo.variables && cuerpo.variables.input && cuerpo.variables.input.fileChanges) {
          try {
            return await guardarEnPartes(url, init, cuerpo);
          } catch (e) {
            if (e && e.archivo) {
              var nombre = e.archivo.split('/').pop();
              var mb = (e.bytes * 0.75 / 1048576).toFixed(1);
              avisar('No se pudo guardar: el archivo «' + nombre + '» pesa ' + mb + ' MB y el máximo es 2,5 MB. ' +
                'Quítalo, achica la foto (o haz una captura de pantalla de ella) y vuelve a subirla.');
              return respuestaError('Archivo demasiado grande: ' + nombre);
            }
            throw e;
          }
        }
      }
    } catch (e) {
      console.error('[panel] guardado en partes', e);
    }
    return fetchOriginal(recurso, init);
  };
})();
