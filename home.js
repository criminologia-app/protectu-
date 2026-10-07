document.addEventListener("DOMContentLoaded", () => {
      const contactos = PT.getContacts();
      const box = document.getElementById("contactos");
      const estado = document.getElementById("estado");

      if (contactos.length) {
        estado.textContent = "Pronto para alerta";
        contactos.forEach((c) => box.append(
          PT.el("div", { class: "item" },
            PT.el("div", {}, PT.el("strong", { text: c.nome || "Contacto" }), PT.el("div", { class: "meta", text: c.telefone })),
            PT.el("span", { class: "meta", text: "Registado" }))));
      } else {
        estado.textContent = "Sem contactos — configure";
        box.append(PT.el("p", { class: "notice", text: "Nenhum contacto guardado. O S.O.S não pode enviar mensagens sem eles." }),
          PT.el("a", { class: "btn-primary", href: "cadastro.html", text: "Configurar agora" }));
      }

      // QR aponta para a pasta do site (funciona em subpastas do GitHub Pages)
      const base = location.href.replace(/[^/]*$/, "");
      const qr = document.getElementById("qr");
      qr.onerror = () => { document.getElementById("qrErro").textContent = "QR indisponível offline. Link: " + base; };
      qr.src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + encodeURIComponent(base);
    });

document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("policia"); if (!box) return;
  const p = PT.get("protecttu_policia", null);
  if (p && p.numero) box.append(PT.el("div", { class: "item" },
    PT.el("div", {}, PT.el("strong", { text: p.nome || "Unidade policial" }), PT.el("div", { class: "meta", text: p.numero + " · aviso se ninguém responder em " + (p.espera || 10) + " min" })),
    PT.el("span", { class: "meta", text: p.consent ? "Autorizado" : "Sem autorização" })));
  else box.append(PT.el("p", { class: "notice", text: "Ainda não definiu o número da polícia. Peça-o na esquadra da sua zona." }),
    PT.el("a", { class: "btn-primary", href: "cadastro.html#policia", text: "Definir número da polícia" }));
});
