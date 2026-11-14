# Cómo editar el sitio de A³ Autismo Guatemala

El sitio tiene un panel de edición en **https://autismogt.org/admin/**.
Desde ahí se cambian todos los textos, las cifras (por ejemplo, las evaluaciones realizadas) y las fotos.

## Entrar

1. Abrir **https://autismogt.org/admin/** y tocar **«Iniciar sesión»**.
2. Se abre una ventanita: escribir el **usuario y la contraseña** que les dio Haricode y tocar **Entrar**.
   (Si el navegador bloquea la ventanita, permitir las ventanas emergentes de autismogt.org.)
3. La sesión dura 12 horas; después se vuelve a entrar igual.

No hace falta cuenta de GitHub. Cada persona tiene su propio usuario: no compartirlo.
¿Olvidaron la contraseña o alguien deja de editar? Avisar a Haricode para generar una nueva o quitar el usuario.

## Editar

- En **Sitio web** aparece cada sección de la página. Se abre, se cambia y se toca **Guardar**.
- Para cambiar una foto: tocar la imagen del campo → **Subir** → elegir la foto. El panel la
  convierte a un formato liviano automáticamente.
- En los textos, `*así*` se ve en cursiva y `**así**` en negrita.
- El contador de evaluaciones está en **Nosotros y cifras → Cifras**.
- Las **franjas con foto y frase** (la de la Ing. Indira Araya y «Aspiramos a una Guatemala…») están
  en **Fotos de fondo y frases**: ahí se cambia la frase, quién la dice (sale en su propia línea) y la foto.
- En **Fotos de fondo y frases → Foto de fondo de cada sección** se puede poner una foto detrás de
  cualquier sección. «Qué tanto se ve la foto» la deja más suave o más visible; vacía = fondo normal.
- A la derecha está la **vista previa**: es la página real armada con lo que van escribiendo, y se
  actualiza mientras escriben. Arriba pueden cambiar entre **Computadora** y **Celular**. Lo que se ve
  ahí todavía no está publicado: se publica al tocar **Guardar**.
- Después de guardar, el sitio se actualiza solo en uno o dos minutos.

Si reemplazan una foto de Wikimedia por una propia, borren su crédito en **General → Créditos de fotografía**.

### A3 Informa (blog)

- Las entradas se escriben en **A3 Informa · entradas → Nueva entrada**: título, fecha, resumen
  (dos o tres líneas: es lo que se ve en la tarjeta y en Google), categoría, autor, imagen y el texto.
- Las tres más recientes aparecen en la portada; todas están en autismogt.org/informa/.
- La vista previa muestra la entrada tal como quedará publicada.
- Los textos de la sección (título, mensaje cuando aún no hay entradas) están en **Sitio web → A3 Informa**.

### Impulsadores de cambio y WhatsApp

- Para agregar una empresa: **Sitio web → Impulsadores de cambio → Empresas → Agregar**, con su
  nombre, su logo y, si quieren, el enlace a su sitio.
- El número del botón verde de WhatsApp está en **General → WhatsApp**. Si se deja vacío, el botón
  desaparece.

## Para Haricode (administración)

- Usuarios: `node herramientas/usuario-panel.js crear <usuario> "<Nombre>"`, `clave <usuario>` (nueva contraseña),
  `quitar <usuario>`, `lista`. Luego `git commit` + `git push`. La contraseña solo se muestra al generarla;
  en el repo queda solo su hash.
- El token de GitHub del servidor está en Vercel → proyecto `a3-autismo-gt` → Environment Variables → `GITHUB_TOKEN`
  (fine-grained, solo este repo, *Contents: Read and write*). Si se cambia, todas las sesiones se cierran.
- `api/entrar.js` = página de usuario y contraseña; `api/gh.js` = intermediario que solo permite leer este repo
  y guardar commits en `main`. Cada commit dice quién editó: «Panel (Nombre): …».
- El panel funciona solo desde autismogt.org (no desde la copia de GitHub Pages).
