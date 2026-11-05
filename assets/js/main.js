(() => {
  const doc = document.documentElement;
  doc.classList.add("js");

  /* Encabezado: sombra al hacer scroll */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Menú móvil */
  const toggle = document.getElementById("navToggle");
  const menu = document.getElementById("menu");
  const setMenu = (open) => {
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  };
  toggle.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  /* Aparición suave al entrar en pantalla */
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    // Escalonar elementos hermanos dentro de una misma cuadrícula
    items.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      const i = siblings.indexOf(el);
      if (i > 0) el.style.setProperty("--d", `${Math.min(i, 6) * 0.07}s`);
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add("is-in"));
  }

  /* Pestañas de programas (patrón WAI-ARIA, con flechas del teclado) */
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (e) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (e.key in keys) {
        e.preventDefault();
        select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true);
      } else if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); }
      else if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); }
    });
  });
  // Enlaces del pie que abren un programa concreto
  document.querySelectorAll("[data-tab]").forEach((a) =>
    a.addEventListener("click", () => { const t = document.getElementById(a.dataset.tab); if (t) select(t); })
  );

  /* Botones "Quiero donar", "voluntario"… preseleccionan el interés del formulario */
  const interes = document.getElementById("interes");
  document.querySelectorAll("[data-interes]").forEach((a) =>
    a.addEventListener("click", () => { if (interes) interes.value = a.dataset.interes; })
  );

  /* Formulario: arma el correo para la bandeja de A³ */
  const form = document.getElementById("contactForm");
  if (form) {
  const EMAIL = form.dataset.correo;
  const status = document.getElementById("formStatus");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let firstBad = null;
    form.querySelectorAll("[required]").forEach((f) => {
      const ok = f.value.trim() && (f.type !== "email" || /^\S+@\S+\.\S+$/.test(f.value.trim()));
      f.setAttribute("aria-invalid", String(!ok));
      if (!ok && !firstBad) firstBad = f;
    });
    if (firstBad) {
      status.textContent = "Revisa los campos marcados para poder enviar tu mensaje.";
      status.classList.add("is-error");
      firstBad.focus();
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    const body = [
      `Nombre: ${d.nombre}`,
      `Correo: ${d.correo}`,
      d.telefono ? `Teléfono: ${d.telefono}` : "",
      `Interés: ${d.interes}`,
      "",
      d.mensaje,
    ].filter((l, i) => l !== "" || i === 4).join("\n");
    const subject = `[Sitio web] ${d.interes} — ${d.nombre}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.classList.remove("is-error");
    status.textContent = "¡Gracias! Se abrió tu aplicación de correo con el mensaje listo para enviar.";
  });
  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid") === "true" && e.target.value.trim()) e.target.removeAttribute("aria-invalid");
  });
  }

  /* Parallax suave en las fotos de los banners.
     La foto avanza más lento que la página y se interpola hacia su destino
     en cada cuadro, así el movimiento se siente fluido y sin saltos. */
  const layers = [...document.querySelectorAll("[data-parallax]")];
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (layers.length && !calm.matches) {
    const EASE = 0.08;    // qué tan rápido alcanza su posición (más bajo = más lento)
    const state = layers.map(() => ({ y: 0, target: 0 }));
    let running = false;

    const measure = () => {
      const vh = window.innerHeight;
      layers.forEach((img, i) => {
        const box = img.parentElement.getBoundingClientRect();
        // Progreso de -1 (banner entrando por abajo) a 1 (saliendo por arriba)
        const travel = vh / 2 + box.height / 2;
        const p = Math.max(-1, Math.min(1, (vh / 2 - (box.top + box.height / 2)) / travel));
        // La foto solo se mueve dentro de su margen sobrante: nunca deja bordes vacíos
        const room = (img.offsetHeight - box.height) / 2;
        state[i].target = p * room;
      });
    };

    const tick = () => {
      let moving = false;
      layers.forEach((img, i) => {
        const s = state[i];
        s.y += (s.target - s.y) * EASE;
        if (Math.abs(s.target - s.y) > 0.1) moving = true;
        else s.y = s.target;
        img.style.setProperty("--py", `${s.y.toFixed(2)}px`);
      });
      running = moving;
      if (moving) requestAnimationFrame(tick);
    };

    const kick = () => {
      measure();
      if (!running) { running = true; requestAnimationFrame(tick); }
    };

    measure();
    state.forEach((s) => { s.y = s.target; });
    tick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
  }

  /* Cifras que se cuentan al entrar en pantalla */
  const counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && !calm.matches) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        co.unobserve(entry.target);
        const el = entry.target, end = Number(el.dataset.count.replace(/\D/g, "")), t0 = performance.now(), dur = 1400;
        const suffix = el.dataset.suffix || "";
        if (!end) return;
        const step = (now) => {
          const k = Math.min(1, (now - t0) / dur);
          el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))).toLocaleString("es-GT") + suffix;
          if (k < 1) requestAnimationFrame(step);
        };
        el.textContent = "0" + suffix;
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => co.observe(el));
  }

  /* Botón fijo "Quiero apoyar" en móvil: aparece al dejar la portada y
     se oculta cuando la sección de apoyo, el formulario o el pie están a la vista */
  const sticky = document.getElementById("stickyCta");
  if (sticky && "IntersectionObserver" in window) {
    const seen = new Map();
    const watch = ["inicio", "apoyar", "contacto"].map((id) => document.getElementById(id))
      .concat(document.querySelector(".footer")).filter(Boolean);
    const so = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      const show = ![...seen.values()].some(Boolean);
      sticky.classList.toggle("is-visible", show);
      sticky.setAttribute("aria-hidden", String(!show));
      sticky.tabIndex = show ? 0 : -1;
    }, { threshold: 0.05 });
    watch.forEach((el) => so.observe(el));
  }

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
