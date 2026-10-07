const $ = (id) => document.getElementById(id);
const perfil = PT.get("protecttu_perfil", {}) || {}, contactos = PT.getContacts(), pol = PT.get("protecttu_policia", {}) || {};
const box = $("contacts");
for (let i = 0; i < 5; i++) {
  box.append(PT.el("div", { class: "form-group" },
    PT.el("input", { id: "cn" + i, class: "form-control", style: "margin-bottom:6px", maxlength: 40, placeholder: i ? `Contacto ${i + 1} — nome (opcional)` : "Contacto 1 — nome (ex: Mãe)", "aria-label": "Nome do contacto " + (i + 1) }),
    PT.el("input", { id: "ct" + i, class: "form-control", type: "tel", placeholder: "9XX XXX XXX ou +244…", "aria-label": "Telefone do contacto " + (i + 1) }),
    PT.el("div", { class: "field-error", id: "ce" + i })));
  if (contactos[i]) { $("cn" + i).value = contactos[i].nome || ""; $("ct" + i).value = contactos[i].telefone; }
}
$("nome").value = perfil.nome || ""; $("trat").value = perfil.tratamento || "senhor"; $("tel").value = perfil.telefone || ""; $("motivo").value = perfil.motivo || "";
$("consent").checked = !!perfil.consentimento;
$("polNome").value = pol.nome || ""; $("polNum").value = pol.numero || ""; $("polEspera").value = String(pol.espera || 10); $("polOk").checked = !!pol.consent;

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  [...Array(5).keys()].forEach((i) => ($("ce" + i).textContent = "")); ["errP", "errC"].forEach((i) => ($(i).textContent = ""));
  let ok = true; const lista = [], vistos = new Set(), meu = $("tel").value.trim() ? PT.normPhone($("tel").value) : "";
  for (let i = 0; i < 5; i++) {
    const t = $("ct" + i).value.trim();
    if (!t) { if (i === 0) { $("ce0").textContent = "Indique pelo menos um contacto."; ok = false; } continue; }
    const n = PT.normPhone(t);
    if (!PT.validPhone(t)) { $("ce" + i).textContent = "Número inválido."; ok = false; }
    else if (n === meu) { $("ce" + i).textContent = "Este é o seu próprio número."; ok = false; }
    else if (vistos.has(n)) { $("ce" + i).textContent = "Número repetido."; ok = false; }
    else { vistos.add(n); lista.push({ nome: $("cn" + i).value.trim() || "Contacto " + (i + 1), telefone: n }); }
  }
  if ($("polNum").value.trim() && (!PT.validPhone($("polNum").value) || !$("polOk").checked)) { $("errP").textContent = "Indique um número válido e marque a autorização."; ok = false; }
  if (!$("consent").checked) { $("errC").textContent = "É preciso aceitar para continuar."; ok = false; }
  if (!ok) return;
  PT.set("protecttu_contatos", lista);
  PT.set("protecttu_policia", $("polNum").value.trim() ? { nome: $("polNome").value.trim(), numero: PT.normPhone($("polNum").value), espera: +$("polEspera").value, consent: true } : null);
  PT.set("protecttu_perfil", { nome: $("nome").value.trim(), tratamento: $("trat").value, telefone: meu, motivo: $("motivo").value, consentimento: true });
  PT.toast("Guardado com sucesso");
  setTimeout(() => (location.href = "sos.html"), 700);
});
