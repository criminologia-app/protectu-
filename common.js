/* PROTECTTÚ — utilitários comuns (script clássico, carregado em todas as páginas) */
(function () {
  const ICONS = {
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    sos: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z",
    map: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
    group: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
    log: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  };
  const NAV = [
    ["home.html", "Início", "home"],
    ["sos.html", "S.O.S", "sos"],
    ["mapa.html", "Mapa", "map"],
    ["comunidade.html", "Comunidade", "group"],
    ["observatorio.html", "Histórico", "log"],
  ];

  const PT = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch {} },

    /* Cria elementos sem innerHTML → impede XSS. Texto sempre via textContent. */
    el(tag, props, ...kids) {
      const n = document.createElement(tag);
      for (const [k, v] of Object.entries(props || {})) {
        if (v == null || v === false) continue;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
      }
      for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      return n;
    },

    toast(msg, kind) {
      let t = document.getElementById("toast");
      if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
      t.textContent = msg;
      t.className = "show" + (kind === "err" ? " err" : "");
      clearTimeout(PT._tt);
      PT._tt = setTimeout(() => (t.className = ""), 3500);
    },

    /* Telefones: aceita 9XXXXXXXX (Angola) e +CCC... */
    normPhone(p) {
      let s = String(p || "").replace(/[\s\-().]/g, "");
      if (/^9\d{8}$/.test(s)) s = "+244" + s;
      return s;
    },
    validPhone(p) { return /^\+?\d{7,15}$/.test(PT.normPhone(p)); },

    getContacts() {
      const list = PT.get("protecttu_contatos", []);
      return Array.isArray(list) ? list.filter((c) => c && c.telefone) : [];
    },

    smsLink(numbers, body) {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      return `sms:${numbers.join(",")}${ios ? "&" : "?"}body=${encodeURIComponent(body)}`;
    },

    fmtDate(ts) {
      const d = new Date(typeof ts === "number" ? ts : Date.now());
      return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    },
  };
  window.PT = PT;
  addEventListener("error", (e) => {
    if (e.target && e.target.tagName === "SCRIPT") PT.toast("Falha a carregar " + (e.target.src || "").split("/").pop(), "err");
    else if (e.message) console.error("[PROTECTTÚ]", e.message);
  }, true);
  addEventListener("unhandledrejection", (e) => console.error("[PROTECTTÚ]", e.reason));
  PT.banner = function (text) {
    let b = document.getElementById("jsErr");
    if (!b) { b = document.createElement("div"); b.id = "jsErr"; b.setAttribute("role", "alert"); document.body.prepend(b); }
    b.textContent = text;
  };
  addEventListener("error", (e) => {
    const t = e.target;
    if (t && t.tagName === "SCRIPT") PT.banner("Falhou ao carregar " + (t.src || "").split("/").pop() + " — envie TODOS os ficheiros da pasta.");
    else if (e.message && !/ResizeObserver/.test(e.message)) PT.banner("Erro: " + e.message);
  }, true);
  addEventListener("unhandledrejection", (e) => { const r = e.reason; PT.banner("Erro: " + ((r && (r.code || r.message)) || r)); });

  function renderNav() {
    const host = document.getElementById("nav");
    if (!host) return;
    const page = location.pathname.split("/").pop() || "index.html";
    const nav = document.createElement("nav");
    nav.className = "nav-bar";
    nav.setAttribute("aria-label", "Navegação principal");
    nav.innerHTML = NAV.map(([href, label, icon]) =>
      `<a href="${href}" class="nav-item${href === page ? " active" : ""}"${href === page ? ' aria-current="page"' : ""}>` +
      `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[icon]}"/></svg><span>${label}</span></a>`
    ).join("");
    host.replaceWith(nav);
  }

  function bindOnline() {
    const upd = () =>
      document.querySelectorAll("[data-online]").forEach((n) => {
        const on = navigator.onLine;
        n.textContent = on ? "Online" : "Offline (SMS ativo)";
        n.classList.toggle("off", !on);
      });
    addEventListener("online", upd);
    addEventListener("offline", upd);
    upd();
  }

  document.addEventListener("DOMContentLoaded", () => { renderNav(); bindOnline(); });

  if ("serviceWorker" in navigator) {
    addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch((e) => console.warn("[PWA]", e)));
  }
})();
