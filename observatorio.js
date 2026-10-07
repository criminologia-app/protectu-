document.addEventListener("DOMContentLoaded", () => {
      const $ = (id) => document.getElementById(id);
      const sessao = PT.get("protecttu_session", null);
      const linhas = [
        ["Contactos de emergência", PT.getContacts().length ? PT.getContacts().length + " guardado(s)" : "nenhum — configure no Cadastro", PT.getContacts().length > 0],
        ["Comunidade", sessao ? sessao.communityName : "sem sessão", !!sessao],
        ["Ligação", navigator.onLine ? "online" : "offline (SMS disponível)", navigator.onLine],
      ];
      linhas.forEach(([k, v, ok]) => $("estado").append(PT.el("div", { class: "item" },
        PT.el("span", { text: k }), PT.el("strong", { style: "color:" + (ok ? "var(--ok)" : "var(--warn)"), text: v }))));
      $("estado").append(PT.el("p", { class: "muted", text: "Proteções: o conteúdo escrito pelos utilizadores é sempre mostrado como texto (nunca como código) e as regras da base de dados só deixam membros ler e escrever na sua comunidade." }));

      function hist() {
        const h = PT.get("protecttu_historico", []);
        $("hist").replaceChildren();
        if (!h.length) return $("hist").append(PT.el("p", { class: "muted", text: "Nenhum S.O.S disparado." }));
        h.forEach((r) => $("hist").append(PT.el("div", { class: "item sos" },
          PT.el("div", { class: "grow" },
            PT.el("div", { class: "meta", text: PT.fmtDate(r.ts) + " · " + (r.para || []).length + " contacto(s)" }),
            r.lat != null
              ? PT.el("a", { class: "body", target: "_blank", rel: "noopener noreferrer", href: `https://maps.google.com/?q=${r.lat},${r.lng}`, text: `${(+r.lat).toFixed(5)}, ${(+r.lng).toFixed(5)}${r.antiga ? " (posição antiga)" : ""}` })
              : PT.el("div", { class: "body", text: "Sem localização" })))));
      }
      hist();
      $("limpar").onclick = () => confirm("Apagar o histórico deste aparelho?") && (PT.remove("protecttu_historico"), hist());

      const cache = sessao ? PT.get("protecttu_cache_" + sessao.cid, null) : null;
      if (!cache || !cache.alerts || !cache.alerts.length) $("com").append(PT.el("p", { class: "muted", text: "Sem alertas guardados." }));
      else cache.alerts.slice(0, 15).forEach((a) => $("com").append(PT.el("div", { class: "item" + (a.type === "sos" ? " sos" : "") },
        PT.el("div", { class: "grow" }, PT.el("div", { class: "meta", text: `${a.user} · ${PT.fmtDate(a.ts)}` }), PT.el("div", { class: "body", text: a.text })))));
    });
