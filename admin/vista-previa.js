// Vista previa en vivo del panel: arma la página real del sitio (misma plantilla de
// index.html, mismos estilos y scripts) con lo que se está escribiendo, mientras se escribe.
// La plantilla y los datos publicados vienen de /admin/vista/paquete.json (se genera al compilar).
(function () {
  'use strict';
  var CMS = window.CMS;
  if (!CMS || !window.liquidjs || !window.marked) {
    console.warn('[vista previa] faltan CMS, liquidjs o marked');
    return;
  }
  var h = window.h || CMS.React.createElement;
  var createClass = window.createClass;

  // Archivo del panel → sección de la página a la que se lleva la vista al abrir.
  var SECCION = {
    fondos: 'inicio', general: 'inicio', inicio: 'inicio', nosotros: 'nosotros', programas: 'programas',
    esencia: 'esencia', fundadores: 'fundadores', apoyar: 'apoyar',
    impulsadores: 'impulsadores', informa: 'informa',
  };
  var ANCHO = { escritorio: 1280, celular: 390 };
  var ORIGEN = window.location.origin;
  var dispositivo = 'escritorio';
  try { dispositivo = localStorage.getItem('a3-vista-dispositivo') || 'escritorio'; } catch (e) {}

  // ---------- Motor de plantillas (equivalente a Jekyll) ----------
  var paquete = null;
  function cargarPaquete() {
    if (!paquete) {
      paquete = fetch('/admin/vista/paquete.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('paquete ' + r.status); return r.json(); })
        .then(function (p) {
          var mem = p.includes;
          var memfs = {
            sep: '/', dirname: function () { return ''; }, contains: function () { return true; },
            resolve: function (root, file) { return file; },
            exists: function (f) { return Promise.resolve(f in mem); }, existsSync: function (f) { return f in mem; },
            readFile: function (f) { return Promise.resolve(mem[f]); }, readFileSync: function (f) { return mem[f]; },
          };
          var motor = new window.liquidjs.Liquid({
            fs: memfs, root: ['/'], extname: '', jekyllInclude: true, dynamicPartials: false, strictFilters: true,
          });
          var url = function (v, abs) {
            v = String(v == null ? '' : v);
            if (/^[a-z]+:|^\/\//i.test(v)) return v;
            return (abs ? ORIGEN : '') + (v.charAt(0) === '/' ? v : '/' + v);
          };
          motor.registerFilter('relative_url', function (v) { return url(v, false); });
          motor.registerFilter('absolute_url', function (v) { return url(v, true); });
          motor.registerFilter('markdownify', function (v) { return window.marked.parse(String(v == null ? '' : v)); });
          motor.registerFilter('jsonify', function (v) { return JSON.stringify(v == null ? null : v); });
          motor.registerFilter('date_to_xmlschema', function (v) {
            var d = v instanceof Date ? v : new Date(v);
            return isNaN(d) ? '' : d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
          });
          motor.registerFilter('xml_escape', function (v) {
            return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; });
          });
          return {
            motor: motor, plantilla: motor.parse(p.plantilla), datos: p.datos.data, posts: p.datos.posts || [],
            pagina: motor.parse(p.layouts.pagina), entrada: motor.parse(p.layouts.entrada),
          };
        });
      paquete.catch(function () { paquete = null; });
    }
    return paquete;
  }

  // Fotos recién subidas (aún sin guardar) se muestran desde el navegador.
  var urlsLocales = {};
  function resolverImagenes(valor, getAsset) {
    if (Array.isArray(valor)) return valor.map(function (v) { return resolverImagenes(v, getAsset); });
    if (valor && typeof valor === 'object') {
      var o = {};
      Object.keys(valor).forEach(function (k) { o[k] = resolverImagenes(valor[k], getAsset); });
      return o;
    }
    if (typeof valor === 'string' && /^\/?assets\/.+\.(webp|png|jpe?g|gif|svg|avif)$/i.test(valor) && getAsset) {
      try {
        var a = getAsset(valor);
        if (a) {
          if (typeof a.url === 'string' && a.url.indexOf('blob:') === 0) return a.url;
          if (a.fileObj instanceof Blob) {
            if (!urlsLocales[valor] || urlsLocales[valor].archivo !== a.fileObj) {
              urlsLocales[valor] = { archivo: a.fileObj, url: URL.createObjectURL(a.fileObj) };
            }
            return urlsLocales[valor].url;
          }
        }
      } catch (e) {}
    }
    return valor;
  }

  // Se agrega a la página de la vista previa: sin animaciones de entrada, cifras ya
  // contadas, y los enlaces solo desplazan (no navegan fuera).
  var EXTRA = '<base href="' + ORIGEN + '/">' +
    '<style>.reveal{opacity:1!important;transform:none!important;transition:none!important}' +
    'html{scroll-behavior:auto!important}</style>' +
    '<script>(function(){var mm=window.matchMedia.bind(window);' +
    'window.matchMedia=function(q){return /prefers-reduced-motion/.test(q)?{matches:true,media:q,onchange:null,' +
    'addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){},' +
    'dispatchEvent:function(){return false}}:mm(q)};' +
    'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(!a)return;' +
    'e.preventDefault();var u=a.getAttribute("href")||"";if(u.charAt(0)==="#"){var t=document.getElementById(u.slice(1));' +
    'if(t)window.scrollTo(0,t.getBoundingClientRect().top+window.scrollY-70)}},true);' +
    'document.addEventListener("submit",function(e){e.preventDefault()},true)})();<\/script>';

  function crear(doc, tag, estilos, texto) {
    var el = doc.createElement(tag);
    if (estilos) el.style.cssText = estilos;
    if (texto) el.textContent = texto;
    return el;
  }

  var Vista = createClass({
    componentDidMount: function () { this.montar(); this.programar(true); },
    componentDidUpdate: function () { this.programar(false); },
    componentWillUnmount: function () {
      clearTimeout(this.temporizador);
      if (this.observador) this.observador.disconnect();
    },
    // React no vuelve a dibujar el componente: solo se rearma la página del marco.
    shouldComponentUpdate: function (siguientes) { this.ultimas = siguientes; this.programar(false); return false; },

    montar: function () {
      var yo = this, caja = this.caja, doc = caja.ownerDocument;
      caja.style.cssText = 'display:flex;flex-direction:column;gap:8px;height:calc(100vh - 150px);min-height:420px;';

      var barra = crear(doc, 'div', 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:13px/1.3 system-ui,sans-serif;');
      this.botones = {};
      [['escritorio', '🖥  Computadora'], ['celular', '📱  Celular']].forEach(function (par) {
        var b = crear(doc, 'button', '', par[1]);
        b.type = 'button';
        b.addEventListener('click', function () {
          dispositivo = par[0];
          try { localStorage.setItem('a3-vista-dispositivo', dispositivo); } catch (e) {}
          yo.pintarBotones(); yo.acomodar();
        });
        yo.botones[par[0]] = b;
        barra.appendChild(b);
      });
      this.estado = crear(doc, 'span', 'margin-left:auto;color:#5a6b88;font-size:12px;', 'Cargando vista previa…');
      barra.appendChild(this.estado);
      caja.appendChild(barra);

      this.escenario = crear(doc, 'div', 'position:relative;flex:1;overflow:hidden;border-radius:10px;background:#dfe7f3;');
      caja.appendChild(this.escenario);
      this.marcos = [0, 1].map(function () {
        var f = crear(doc, 'iframe', 'position:absolute;top:0;border:0;background:#fff;transform-origin:0 0;visibility:hidden;');
        f.title = 'Vista previa del sitio';
        yo.escenario.appendChild(f);
        return f;
      });
      this.frente = null;
      this.pintarBotones();
      if (window.ResizeObserver) {
        this.observador = new ResizeObserver(function () { yo.acomodar(); });
        this.observador.observe(this.escenario);
      }
      this.acomodar();
    },

    pintarBotones: function () {
      var yo = this;
      Object.keys(this.botones).forEach(function (k) {
        var activo = k === dispositivo;
        yo.botones[k].style.cssText = 'cursor:pointer;border-radius:999px;padding:5px 12px;font:inherit;' +
          (activo ? 'background:#0b2c66;color:#fff;border:1px solid #0b2c66;' : 'background:#fff;color:#0b2c66;border:1px solid #c9d6ea;');
        yo.botones[k].setAttribute('aria-pressed', String(activo));
      });
    },

    // Ajusta el tamaño: la computadora se ve completa a escala; el celular a 390 px.
    acomodar: function () {
      if (!this.escenario) return;
      var w = this.escenario.clientWidth, alto = this.escenario.clientHeight;
      var ancho = ANCHO[dispositivo];
      var escala = Math.min(1, (w - (dispositivo === 'celular' ? 24 : 0)) / ancho);
      var izq = Math.max(0, (w - ancho * escala) / 2);
      this.marcos.forEach(function (f) {
        f.style.width = ancho + 'px';
        f.style.height = (alto / escala) + 'px';
        f.style.left = izq + 'px';
        f.style.transform = 'scale(' + escala + ')';
        f.style.boxShadow = dispositivo === 'celular' ? '0 0 0 1px #c9d6ea, 0 8px 24px rgba(11,44,102,.15)' : 'none';
      });
    },

    programar: function (primera) {
      var yo = this;
      clearTimeout(this.temporizador);
      this.temporizador = setTimeout(function () { yo.pintar(primera); }, primera ? 0 : 300);
    },

    pintar: function () {
      var yo = this, props = this.ultimas || this.props;
      var clave = props.archivoVista;
      var datosEditados = props.entry && props.entry.getIn(['data']);
      datosEditados = datosEditados && datosEditados.toJS ? datosEditados.toJS() : (datosEditados || {});
      var turno = (this.turno = (this.turno || 0) + 1);

      cargarPaquete().then(function (p) {
        var data = {};
        Object.keys(p.datos).forEach(function (k) { data[k] = p.datos[k]; });
        var site = { url: ORIGEN, baseurl: '', data: data, posts: p.posts, time: new Date() };
        if (clave === 'entradas') {
          // Una entrada de A3 Informa: se arma con sus plantillas (entrada dentro de página).
          var e = resolverImagenes(datosEditados, props.getAsset);
          var page = {
            title: e.title || 'Entrada sin título', date: e.date ? new Date(e.date) : new Date(), resumen: e.resumen || '',
            categoria: e.categoria || '', autor: e.autor || '', imagen: e.imagen || '', imagen_alt: e.imagen_alt || '',
            layout: 'entrada', url: '/informa/vista-previa/',
          };
          var cuerpo = window.marked.parse(String(e.body || ''));
          return p.motor.render(p.entrada, { site: site, page: page, content: cuerpo }).then(function (html) {
            return p.motor.render(p.pagina, { site: site, page: page, content: html });
          });
        }
        data[clave] = resolverImagenes(datosEditados, props.getAsset);
        return p.motor.render(p.plantilla, { site: site });
      }).then(function (html) {
        if (turno !== yo.turno) return; // llegó otro cambio mientras se armaba
        html = html.replace(/<head([^>]*)>/i, function (m) { return m + EXTRA; });
        var atras = yo.marcos[yo.frente === yo.marcos[0] ? 1 : 0];
        var adelante = yo.frente;
        var y = 0;
        try { y = adelante ? adelante.contentWindow.scrollY : 0; } catch (e) {}
        atras.onload = function () {
          if (turno !== yo.turno) return;
          var w = atras.contentWindow;
          try {
            if (!adelante) {
              var sec = w.document.getElementById(SECCION[clave] || 'inicio');
              if (sec && SECCION[clave] !== 'inicio') w.scrollTo(0, sec.getBoundingClientRect().top + w.scrollY - 70);
            } else {
              w.scrollTo(0, y);
            }
          } catch (e) {}
          // Deja que carguen estilos y fuentes antes de cambiar de marco (sin parpadeo).
          setTimeout(function () {
            if (turno !== yo.turno) return;
            atras.style.visibility = 'visible';
            atras.style.zIndex = '1';
            if (adelante) { adelante.style.visibility = 'hidden'; adelante.style.zIndex = '0'; }
            yo.frente = atras;
            yo.estado.textContent = 'Vista previa · se actualiza mientras escribes (aún no está publicado)';
          }, adelante ? 60 : 0);
        };
        atras.srcdoc = html;
      }).catch(function (err) {
        console.error('[vista previa]', err);
        if (turno === yo.turno) yo.estado.textContent = 'No se pudo armar la vista previa: ' + (err && err.message || err);
      });
    },

    render: function () {
      var yo = this;
      return h('div', { ref: function (el) { if (el) yo.caja = el; } });
    },
  });

  Object.keys(SECCION).concat(['entradas']).forEach(function (clave) {
    CMS.registerPreviewTemplate(clave, function (props) {
      return h(Vista, Object.assign({}, props, { archivoVista: clave }));
    });
  });
})();
