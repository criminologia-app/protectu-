import * as api from "./community-api.js";

const $ = (id) => document.getElementById(id);
const show = (id, on = true) => $(id).classList.toggle("hidden", !on);
let indexed = false, mode = "create", session = PT.get("protecttu_session", null), stop = null, isAdmin = false;
let state = { alerts: [], members: [], meta: null, info: null };

/* ---------- Vistas ---------- */
function view(name) {
  ["vChoose", "vForm", "vMain"].forEach((v) => show(v, v === name));
  if (name === "vChoose") show("backMain", !!session);
  if (name === "vChoose") show("backMain", !!session);
}
function friendly(e) {
  const m = String((e && (e.code || e.message)) || e);
  if (/PERMISSION_DENIED|permission/i.test(m)) return mode === "create"
    ? "Sem permissão para criar. O nome pode já existir ou as regras do Realtime Database não estão publicadas."
    : "Senha incorreta ou comunidade inexistente.";
  if (/network|offline/i.test(m)) return "Sem ligação à internet. Tente novamente quando tiver rede.";
  if (/operation-not-allowed|admin-restricted/i.test(m)) return "Ative o login Anónimo no Firebase (Authentication → Sign-in method).";
  if (/unauthorized-domain/i.test(m)) return "Domínio não autorizado: adicione-o em Authentication → Settings → Domínios autorizados.";
  return (e && e.message ? e.message : "Erro inesperado.") + (e && e.code ? " (" + e.code + ")" : "");
}

/* ---------- Escolha / formulário ---------- */
$("goCreate").onclick = () => openForm("create");
$("goJoin").onclick = () => openForm("join");
$("back").onclick = () => view("vChoose");
$("other").onclick = () => view("vChoose");
$("backMain").onclick = () => view("vMain");
function here() {
  return new Promise((res) => {
    const last = PT.get("protecttu_lastpos", null);
    if (!navigator.geolocation) return res(last);
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(last), { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 });
  });
}
$("other").onclick = () => view("vChoose");
$("backMain").onclick = () => view("vMain");
function openForm(m) {
  mode = m; $("fErr").textContent = "";
  $("formTitle").textContent = m === "create" ? "Criar comunidade" : "Entrar numa comunidade";
  $("fSubmit").textContent = m === "create" ? "Criar e entrar" : "Entrar";
  $("fPass").autocomplete = m === "create" ? "new-password" : "current-password";
  $("fUser").value = (PT.get("protecttu_perfil", {}) || {}).nome || $("fUser").value;
  view("vForm");
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const userName = $("fUser").value.trim(), name = $("fComm").value.trim(), password = $("fPass").value;
  const perfil = PT.get("protecttu_perfil", {}) || {};
  const phone = $("fShare").checked && perfil.telefone ? perfil.telefone : "";
  if ($("fShare").checked && !perfil.telefone) { $("fErr").textContent = "Guarde o seu telefone no Cadastro para o partilhar."; return; }
  if (!userName || !name || !password) { $("fErr").textContent = "Preencha todos os campos."; return; }
  $("fSubmit").disabled = true; $("fErr").textContent = "";
  try {
    const s = await (mode === "create" ? api.createCommunity : api.joinCommunity)({ name, password, userName, phone });
    session = s; PT.set("protecttu_session", s);
    if (s.indexOk === false) PT.toast("Criada, mas a Central não a vê: republique as regras do Firebase.", "err");
    $("fPass").value = "";
    enter();
  } catch (err) { $("fErr").textContent = friendly(err); }
  finally { $("fSubmit").disabled = false; }
});

/* ---------- Painel ---------- */
function enter() {
  indexed = false; view("vMain");
  $("mTitle").textContent = session.communityName;
  $("mUser").textContent = "Membro: " + session.userName;
  const cache = PT.get("protecttu_cache_" + session.cid, null);   // mostra já o que temos offline
  if (cache) { state = cache; renderAll(); }
  if (stop) stop();
  stop = api.watchCommunity(session.cid, {
    meta: (v) => { state.meta = v; renderAll(); },
    info: (v) => { state.info = v; renderAll(); },
    members: (v) => { state.members = v; renderAll(); },
    alerts: (v) => { state.alerts = v; renderAll(); },
    connected: (on) => { const p = $("sync"); p.textContent = on ? "Sincronizado" : "Offline"; p.classList.toggle("off", !on); },
    error: (err) => {
      if (/permission/i.test(String(err && (err.code || err.message)))) {
        PT.toast("Já não faz parte desta comunidade", "err"); doLeave(true);
      }
    },
  });
  api.ensureAuth().catch(() => {});
}

function renderAll() {
  PT.set("protecttu_cache_" + session.cid, state);
  api.ensureAuth().then((u) => { isAdmin = !!(state.meta && state.meta.adminUid === u.uid); if (isAdmin && !indexed) { indexed = true; api.ensureIndex(session.cid, state.meta.name); } paint(u.uid); }).catch(() => paint(null));
}

function paint(myUid) {
  /* Alertas */
  const list = $("aList"); list.replaceChildren();
  if (!state.alerts.length) list.append(PT.el("p", { class: "muted", text: "Ainda não há alertas. Envie o primeiro." }));
  state.alerts.forEach((a) => {
    const sos = a.type === "sos";
    list.append(PT.el("div", { class: "item" + (sos ? " sos" : "") },
      PT.el("div", { class: "grow" },
        PT.el("div", { class: "meta", text: `${sos ? "🚨 S.O.S · " : ""}${a.user} · ${PT.fmtDate(a.ts)}` }),
        PT.el("div", { class: "body", text: a.text }),
        typeof a.lat === "number" ? PT.el("a", { class: "meta", target: "_blank", rel: "noopener noreferrer",
          href: `https://maps.google.com/?q=${a.lat},${a.lng}`, text: "Ver localização" }) : null,
        PT.el("div", { class: "meta", text: `✋ ${Object.keys(a.acks || {}).length} resposta(s)` }),
        a.uid !== myUid && !(a.acks && myUid in a.acks) ? PT.el("button", { class: "btn-primary btn-sm", style: "width:auto;margin-top:6px", text: "Já vi / vou ajudar",
          onclick: () => api.ackAlert(session.cid, a.id).then(() => PT.toast("Resposta enviada")).catch((e) => PT.toast(friendly(e), "err")) }) : null),
      isAdmin ? PT.el("button", { class: "btn-secondary btn-sm", "aria-label": "Apagar alerta", text: "✕",
        onclick: () => api.deleteAlert(session.cid, a.id).catch((e) => PT.toast(friendly(e), "err")) }) : null));
  });

  /* Membros */
  $("mCount").textContent = state.members.length;
  const ml = $("mList"); ml.replaceChildren();
  const phones = [];
  state.members.forEach((m) => {
    const admin = state.meta && m.uid === state.meta.adminUid;
    if (m.phone && m.uid !== myUid) phones.push(m.phone);
    ml.append(PT.el("div", { class: "item" },
      PT.el("div", { class: "avatar", text: (m.name || "?").charAt(0).toUpperCase() }),
      PT.el("div", { class: "grow" },
        PT.el("strong", { text: m.name + (m.uid === myUid ? " (você)" : "") + (admin ? " · admin" : "") }),
        PT.el("div", { class: "meta", text: m.phone || "telefone não partilhado" })),
      m.phone && m.uid !== myUid ? PT.el("a", { class: "btn-secondary btn-sm", href: PT.smsLink([m.phone], "[PROTECTTÚ] "), text: "SMS" }) : null,
      isAdmin && m.uid !== myUid ? PT.el("button", { class: "btn-secondary btn-sm", "aria-label": "Remover membro", text: "✕",
        onclick: () => confirm(`Remover ${m.name}?`) && api.removeMember(session.cid, m.uid).catch((e) => PT.toast(friendly(e), "err")) }) : null));
  });
  show("smsAll", phones.length > 0);
  if (phones.length) $("smsAll").href = PT.smsLink(phones, "[PROTECTTÚ COMUNIDADE] ");

  /* Sobre */
  $("iText").textContent = (state.info && state.info.description) || "Sem descrição.";
  show("iForm", isAdmin);
  if (isAdmin && document.activeElement !== $("iEdit")) $("iEdit").value = (state.info && state.info.description) || "";
}

/* ---------- Ações ---------- */
$("aForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("aText").value.trim(); if (!text) return;
  try {
    const extra = {};
    if ($("aLoc") && $("aLoc").checked && navigator.geolocation) {
      const p = await new Promise((r) => navigator.geolocation.getCurrentPosition((x) => r(x.coords), () => r(null), { timeout: 5000, maximumAge: 60000 }));
      if (p) { extra.lat = p.latitude; extra.lng = p.longitude; }
    }
    const pol = PT.get("protecttu_policia", null);
    if (pol && pol.consent && pol.numero) { extra.pol = pol.numero; extra.polNome = pol.nome || ""; }
    await api.sendAlert(session, text, extra); $("aText").value = ""; PT.toast("Alerta enviado");
  }
  catch (err) { PT.toast(friendly(err), "err"); }
});
$("iForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await api.saveInfo(session.cid, $("iEdit").value.trim()); PT.toast("Guardado"); }
  catch (err) { PT.toast(friendly(err), "err"); }
});
$("leave").onclick = () => confirm("Sair desta comunidade?") && doLeave(false);
async function doLeave(silent) {
  try { if (!silent) await api.leaveCommunity(session); } catch (e) { if (!silent) PT.toast(friendly(e), "err"); }
  if (stop) stop(); stop = null;
  PT.remove("protecttu_session"); if (session) PT.remove("protecttu_cache_" + session.cid);
  session = null; view("vChoose");
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
  document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("hidden", p.id !== t.dataset.tab));
}));

/* ---------- Arranque ---------- */
if (!api.configured) { show("cfgNotice"); }
if (session && api.configured) enter();
else if (session && !api.configured) { state = PT.get("protecttu_cache_" + session.cid, state); view("vMain"); $("mTitle").textContent = session.communityName; paint(null); }
else view("vChoose");
if (!api.configured) ["goCreate", "goJoin"].forEach((id) => ($(id).disabled = true));
