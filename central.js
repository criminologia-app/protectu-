import * as api from "./community-api.js";
import { firebaseConfig } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, get, set, remove, push, onValue, query, limitToLast, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const $ = (id) => document.getElementById(id);
const IDLE_MS = 15 * 60 * 1000;
const D = { comms: {}, members: {}, alerts: {}, police: {}, presence: {} };
let unsubs = [], seen = {}, idleAt = 0, timersOn = false, sel = null, afil = "all", cur = "home", adminMail = "";
let S = { un: 0, wt: 0, pts: [] }, placing = false, draft = null, WAIT = +PT.get("protecttu_wait", 10), allAl = [];
let connected = false, lastData = 0; const errs = {}, MAPS = {};
let aRows = [], aHead = [];

const dt = (t) => (t ? new Date(t).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—");
const cname = (cid) => (D.comms[cid] || {}).name || cid;
const nAcks = (a) => (a.acks ? Object.keys(a.acks).length : 0);
const abbr = (n) => String(n || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase().padEnd(3, "-");
const hav = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const tel = (n) => String(n).replace(/[^\d+]/g, "");
const isUn = (a) => a.type === "sos" && !nAcks(a) && !a.handled && Date.now() - a.ts >= WAIT * 60e3 && Date.now() - a.ts < 864e5;
const nameOf = (cid, uid) => ((D.members[cid] || []).find((m) => m.uid === uid) || {}).name || "Membro";

function msg(e) {
  const c = String((e && e.code) || e);
  if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return "E-mail ou palavra-passe incorretos.";
  if (/too-many-requests/.test(c)) return "Demasiadas tentativas. Aguarde alguns minutos.";
  if (/operation-not-allowed/.test(c)) return "Ative 'E-mail/Senha' em Authentication → Sign-in method.";
  if (/not-admin/.test(c)) return "Esta conta não está na lista de administradores (admins).";
  return "Não foi possível entrar.";
}
async function isAdmin(u) {
  if (!u || u.isAnonymous) return false;
  try { return (await get(ref(api.db, "admins/" + u.uid))).val() === true; } catch { return false; }
}

/* ---------- Sessão ---------- */
$("login").addEventListener("submit", async (e) => {
  e.preventDefault(); $("err").textContent = ""; $("go").disabled = true;
  try {
    const { user } = await signInWithEmailAndPassword(api.auth, $("em").value.trim(), $("pw").value);
    $("pw").value = "";
    if (!(await isAdmin(user))) { await signOut(api.auth); throw { code: "not-admin" }; }
    open(user);
  } catch (err) { $("err").textContent = msg(err); } finally { $("go").disabled = false; }
});
$("out").onclick = lock;
function lock() {
  unsubs.forEach((f) => f()); unsubs = []; seen = {}; Object.assign(D, { comms: {}, members: {}, alerts: {}, police: {}, presence: {} });
  signOut(api.auth).catch(() => {});
  $("hud").classList.add("hidden"); $("lock").classList.remove("hidden");
}
const bump = () => { idleAt = Date.now() + IDLE_MS; };
const lis = (path, r, fn) => unsubs.push(onValue(r, (s) => { delete errs[path]; lastData = Date.now(); fn(s); }, (e) => { errs[path] = String(e.code || e.message); render(); }));

function open(user) {
  adminMail = user.email || user.uid; $("opsId").textContent = "OPS." + user.uid.slice(0, 6).toUpperCase();
  $("lock").classList.add("hidden"); $("hud").classList.remove("hidden");
  bump(); $("wait").value = String(WAIT);
  if (!timersOn) {
    timersOn = true;
    ["pointerdown", "keydown", "pointermove"].forEach((ev) => addEventListener(ev, bump, { passive: true }));
    setInterval(() => {
      $("clock").textContent = new Date().toLocaleString("pt-PT");
      const left = Math.max(0, Math.ceil((idleAt - Date.now()) / 1000));
      $("idle").textContent = "BLOQ. " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
      if (left === 0 && !$("hud").classList.contains("hidden")) lock();
    }, 1000);
    setInterval(() => { if (!$("hud").classList.contains("hidden")) render(); }, 20000);
  }
  mk("map"); mk("map2"); go("home");
  lis("config/police", ref(api.db, "config/police"), (s) => { D.police = s.val() || {}; render(); });
  lis("presence", ref(api.db, "presence"), (s) => { D.presence = s.val() || {}; render(); });
  unsubs.push(onValue(ref(api.db, ".info/connected"), (s) => { connected = !!s.val(); $("link").classList.toggle("off", !connected); $("link").textContent = connected ? "Ligado" : "Sem ligação"; }));
  lis("index", ref(api.db, "index"), (s) => {
    D.comms = s.val() || {};
    Object.keys(D.comms).forEach((cid) => {
      if (seen[cid]) return; seen[cid] = true;
      lis(`communities/${cid}/members`, ref(api.db, `communities/${cid}/members`), (m) => {
        const l = []; m.forEach((c) => { const v = c.val(); l.push({ uid: c.key, cid, name: v.name, phone: v.phone || "", joined: v.joined }); }); D.members[cid] = l; render();
      });
      lis(`communities/${cid}/alerts`, query(ref(api.db, `communities/${cid}/alerts`), limitToLast(100)), (a) => {
        const l = []; a.forEach((c) => { l.push({ id: c.key, cid, ...c.val() }); }); D.alerts[cid] = l; render();
      });
    });
    render();
  });
}

/* ---------- Abas ---------- */
function go(v) {
  cur = v;
  document.querySelectorAll(".view").forEach((x) => x.classList.toggle("on", x.id === "v-" + v));
  document.querySelectorAll(".side .tb").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  setTimeout(() => Object.values(MAPS).forEach((o) => o.m.invalidateSize()), 80);   // corrige mapas criados em abas escondidas
  render();
}
document.querySelectorAll(".side .tb").forEach((b) => b.addEventListener("click", () => go(b.dataset.v)));
document.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { afil = b.dataset.f; document.querySelectorAll("[data-f]").forEach((x) => x.classList.toggle("on", x === b)); render(); }));
$("mapF").onchange = render;

/* ---------- Mapas (Leaflet local) ---------- */
function mk(id) {
  if (MAPS[id]) return MAPS[id];
  if (!window.L) { $("cap").textContent = "MAPA INDISPONÍVEL (vendor/leaflet em falta)"; return null; }
  const m = L.map(id, { zoomControl: id === "map2", attributionControl: false }).setView([-8.839, 13.289], 12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);
  const o = (MAPS[id] = { m, LA: L.layerGroup().addTo(m), LU: L.layerGroup().addTo(m), LD: L.layerGroup().addTo(m), sig: -1 });
  m.on("click", (e) => {
    if (!placing) return;
    placing = false; draft = { lat: e.latlng.lat, lng: e.latlng.lng };
    $("ucoord").textContent = draft.lat.toFixed(4) + ", " + draft.lng.toFixed(4); go("pol");
  });
  return o;
}
const dot = (cls) => L.divIcon({ className: "", html: `<span class="${cls}"></span>`, iconSize: [14, 14] });
function drawMap(id, pts) {
  const o = MAPS[id]; if (!o) return;
  o.LA.clearLayers(); o.LU.clearLayers();
  pts.forEach((a) => L.marker([a.lat, a.lng], { icon: dot("rdot" + (isUn(a) ? " un" : "")) })
    .bindTooltip(PT.el("div", {}, PT.el("b", { text: `${a.user} · ${cname(a.cid)}` }), PT.el("div", { text: a.text }), PT.el("div", { text: dt(a.ts) }))).addTo(o.LA));
  Object.values(D.police).forEach((u) => { if (typeof u.lat === "number") L.marker([u.lat, u.lng], { icon: dot("udot") })
    .bindTooltip(PT.el("div", {}, PT.el("b", { text: u.name }), PT.el("div", { text: u.number }))).addTo(o.LU); });
  if (pts.length !== o.sig) { o.sig = pts.length; if (pts.length) o.m.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [30, 30], maxZoom: 15 }); }
}

/* ---------- Render ---------- */
function render() {
  if ($("hud").classList.contains("hidden")) return;
  const now = Date.now();
  let al = Object.values(D.alerts).flat().map((a) => ({ ...a, ts: a.ts || now })).sort((a, b) => b.ts - a.ts);
  if (sel) al = al.filter((a) => a.cid === sel);
  allAl = al;
  const sos24 = al.filter((a) => a.type === "sos" && now - a.ts < 864e5);
  const un = sos24.filter(isUn), wt = sos24.filter((a) => !nAcks(a) && !a.handled && now - a.ts < WAIT * 60e3), resp = sos24.filter(nAcks).length;
  const members = Object.values(D.members).reduce((s, l) => s + l.length, 0), online = Object.keys(D.presence).length;
  S = { un: un.length, wt: wt.length, pts: al.filter((a) => typeof a.lat === "number") };

  $("nums").replaceChildren(...[[Object.keys(D.comms).length, "COMUNIDADES"], [members, "MEMBROS"], [online, "ONLINE"], [al.filter((a) => now - a.ts < 864e5).length, "ALERTAS 24H"],
    [sos24.length, "S.O.S 24H"], [un.length, "SEM RESPOSTA", un.length > 0]].map(([v, k, dg]) => PT.el("div", { class: dg ? "dg" : "" }, PT.el("b", { text: String(v) }), PT.el("span", { text: k }))));
  const l = al[0];
  $("last").replaceChildren(...(l ? [["TIPO", l.type === "sos" ? "S.O.S" : "ALERTA"], ["COMUNIDADE", cname(l.cid)], ["UTILIZADOR", l.user], ["HORA", dt(l.ts)],
    ["POSIÇÃO", typeof l.lat === "number" ? l.lat.toFixed(5) + ", " + l.lng.toFixed(5) : "—"], ["RESPOSTAS", String(nAcks(l))], ["TEXTO", l.text]].map(([k, v]) => PT.el("div", {}, PT.el("b", { text: k + " // " }), v))
    : [PT.el("div", { text: Object.keys(D.comms).length ? "SEM EVENTOS REGISTADOS" : "SEM COMUNIDADES NO ÍNDICE — ver aba Sistema" })]));
  const bins = Array.from({ length: 24 }, () => [0, 0]);
  al.forEach((a) => { const k = 23 - Math.floor((now - a.ts) / 3600e3); if (k >= 0 && k < 24) bins[k][a.type === "sos" ? 1 : 0]++; });
  const mx = Math.max(1, ...bins.map((b) => b[0] + b[1]));
  $("eq").replaceChildren(...bins.map((b) => { const i = document.createElement("i"); i.style.height = Math.max(5, ((b[0] + b[1]) / mx) * 100) + "%"; if (b[1]) i.className = "s"; return i; }));
  const pct = sos24.length ? Math.round((resp / sos24.length) * 100) : 100;
  $("gauge").style.setProperty("--p", pct); $("gv").textContent = pct + "%"; $("gsub").textContent = `${resp} DE ${sos24.length} (24H)`;
  const b = $("banner"); b.classList.toggle("hidden", !un.length);
  if (un.length) b.textContent = `⚠ ${un.length} S.O.S SEM RESPOSTA DA COMUNIDADE HÁ MAIS DE ${WAIT} MIN — AÇÃO NECESSÁRIA`;

  renderQueue(un); renderComms(); renderUnits(); renderTags(al);
  const mf = $("mapF").value, mp = S.pts.filter((a) => mf === "all" || (mf === "sos" && a.type === "sos") || (mf === "un" && isUn(a)));
  drawMap("map", S.pts); drawMap("map2", mp); $("mapInfo").textContent = `${mp.length} no mapa`;
  $("cap").textContent = `${S.pts.length} ALERTAS NO MAPA · ${un.length} SEM RESPOSTA · © OPENSTREETMAP`;
  if (cur === "comms") tableComms(); if (cur === "alerts") tableAlerts(); if (cur === "act") timeline(); if (cur === "sys") system();
}

function fill(t, head, rows, o = {}) {
  t.replaceChildren(PT.el("tr", {}, head.map((h) => PT.el("th", { text: h }))),
    ...rows.slice(0, 300).map((r, i) => PT.el("tr", { class: (o.cls ? o.cls(r) : "") + (o.click ? " cl" : ""), onclick: o.click ? () => o.click(i) : null }, r.map((v) => PT.el("td", { text: String(v), title: String(v) })))));
  if (!rows.length) t.append(PT.el("tr", {}, PT.el("td", { colspan: head.length, text: "Sem dados." })));
}
function tableComms() {
  const now = Date.now(), ids = Object.keys(D.comms), on = Object.values(D.presence);
  const rows = ids.map((cid) => { const al = D.alerts[cid] || [], s = al.filter((a) => a.type === "sos");
    return [cname(cid), (D.members[cid] || []).length, on.filter((p) => p.cid === cid).length, al.length, s.length, s.filter((a) => !nAcks(a) && !a.handled && now - (a.ts || now) >= WAIT * 60e3).length, dt(D.comms[cid].created), dt(Math.max(0, ...al.map((a) => a.ts || 0)) || null)]; });
  fill($("tComms"), ["COMUNIDADE", "MEMBROS", "ONLINE", "ALERTAS", "S.O.S", "SEM RESPOSTA", "CRIADA", "ÚLTIMA ATIVIDADE"], rows, { click: (i) => { sel = sel === ids[i] ? null : ids[i]; render(); }, cls: (r) => (r[5] ? "sosr" : "") });
  const ms = Object.values(D.members).flat().filter((m) => !sel || m.cid === sel);
  $("mHd").textContent = sel ? `Membros — ${cname(sel)} (clique na comunidade para limpar)` : "Membros (todas as comunidades)";
  fill($("tMembers"), ["COMUNIDADE", "NOME", "TELEFONE", "ENTROU", "ESTADO"], ms.map((m) => [cname(m.cid), m.name, m.phone || "não partilhado", dt(m.joined), D.presence[m.uid] ? "ONLINE" : "offline"]));
}
function estado(a) { return a.handled ? "TRATADO" : nAcks(a) ? "RESPONDIDO" : a.type === "sos" ? (isUn(a) ? "SEM RESPOSTA" : "A AGUARDAR") : "—"; }
function tableAlerts() {
  const list = allAl.filter((a) => afil === "all" || (afil === "sos" && a.type === "sos") || (afil === "un" && isUn(a)));
  aHead = ["HORA", "COMUNIDADE", "UTILIZADOR", "TIPO", "TEXTO", "POSIÇÃO", "RESP.", "POLÍCIA INDICADA", "ESTADO"];
  aRows = list.map((a) => [dt(a.ts), cname(a.cid), a.user, a.type === "sos" ? "S.O.S" : "ALERTA", a.text, typeof a.lat === "number" ? a.lat.toFixed(5) + ", " + a.lng.toFixed(5) : "—", nAcks(a), a.pol ? `${a.polNome || ""} ${a.pol}`.trim() : "—", estado(a)]);
  fill($("tAlerts"), aHead, aRows, { cls: (r) => (r[3] === "S.O.S" ? "sosr" : "") });
}
$("csv").onclick = () => {
  const esc = (v) => { v = String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + [aHead, ...aRows].map((r) => r.map(esc).join(";")).join("\r\n")], { type: "text/csv" }));
  a.download = `protecttu-alertas-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
function timeline() {
  const ev = [];
  allAl.forEach((a) => {
    ev.push({ t: a.ts, k: a.type === "sos" ? "S.O.S" : "ALERTA", s: `${a.user} @ ${cname(a.cid)}: ${a.text}`, h: a.type === "sos" });
    if (a.acks) Object.entries(a.acks).forEach(([uid, t]) => ev.push({ t, k: "RESPOSTA", s: `${nameOf(a.cid, uid)} respondeu ao S.O.S de ${a.user}` }));
    if (a.handled) ev.push({ t: a.handled, k: "TRATADO", s: `Central tratou o S.O.S de ${a.user}` });
  });
  Object.values(D.members).flat().filter((m) => !sel || m.cid === sel).forEach((m) => ev.push({ t: m.joined, k: "ENTRADA", s: `${m.name} entrou em ${cname(m.cid)}` }));
  ev.sort((x, y) => (y.t || 0) - (x.t || 0));
  $("tl").replaceChildren(...(ev.length ? ev.slice(0, 200).map((e) => PT.el("div", { class: e.h ? "h" : "" }, PT.el("b", { text: `[${dt(e.t)}] ${e.k} // ` }), e.s)) : [PT.el("div", { text: "Sem atividade registada." })]));
}
function system() {
  const E = Object.entries(errs), lines = [
    ["LIGAÇÃO À BASE DE DADOS", connected ? "ONLINE" : "SEM LIGAÇÃO"], ["PROJETO FIREBASE", firebaseConfig.projectId], ["ADMINISTRADOR", adminMail],
    ["COMUNIDADES NO ÍNDICE", Object.keys(D.comms).length], ["MEMBROS LIDOS", Object.values(D.members).reduce((s, l) => s + l.length, 0)],
    ["ALERTAS LIDOS", Object.values(D.alerts).reduce((s, l) => s + l.length, 0)], ["MEMBROS ONLINE AGORA", Object.keys(D.presence).length],
    ["UNIDADES DE POLÍCIA", Object.keys(D.police).length], ["ÚLTIMA ATUALIZAÇÃO", dt(lastData)], ["TEMPO DE ESPERA ATUAL", WAIT + " min"]];
  $("sys").replaceChildren(...lines.map(([k, v]) => PT.el("div", {}, PT.el("b", { text: k + " // " }), String(v))),
    PT.el("div", { class: E.length ? "h" : "" }, PT.el("b", { text: "ERROS DE LEITURA // " }), E.length ? E.map(([p, c]) => `${p}: ${c}`).join(" · ") + " → republique as regras do Firebase e confirme o seu UID em admins." : "nenhum"));
}
function renderTags(al) {
  $("tags").replaceChildren(...Array.from({ length: 18 }, (_, i) => { const a = al[i]; return PT.el("div", { class: "tg" + (a && a.type === "sos" ? " sos" : ""), text: a ? abbr(cname(a.cid)) + "·" + (a.type === "sos" ? "SOS" : "ALR") : "—" }); }));
}
function renderComms() {
  const c = $("commBtns"); c.replaceChildren(); const all = Object.entries(D.comms);
  if (!all.length) c.append(PT.el("p", { class: "lines", text: "Nenhuma comunidade no índice. Abra a aba Sistema → «Adicionar comunidade existente»." }));
  all.forEach(([cid, v]) => c.append(PT.el("button", { type: "button", class: "tb" + ((D.alerts[cid] || []).some(isUn) ? " sos" : "") + (sel === cid ? " sel" : ""), onclick: () => { sel = sel === cid ? null : cid; render(); } },
    PT.el("span", { class: "sq" }), v.name, PT.el("em", { text: (D.members[cid] || []).length + " 👤" }))));
}

/* ---------- Fila de ação (só quando ninguém respondeu) ---------- */
function nearest(a) {
  const us = Object.values(D.police); if (!us.length) return null;
  if (typeof a.lat !== "number") return { u: us[0], km: null };
  const g = us.filter((u) => typeof u.lat === "number").map((u) => ({ u, km: hav(a.lat, a.lng, u.lat, u.lng) })).sort((x, y) => x.km - y.km);
  return g[0] || { u: us[0], km: null };
}
function renderQueue(un) {
  const q = $("queue"); q.replaceChildren();
  if (!un.length) { q.append(PT.el("p", { class: "lines", text: "Nenhuma ocorrência a exigir ação. A Central só intervém quando ninguém da comunidade responde." })); return; }
  un.forEach((a) => {
    const n = nearest(a), pos = typeof a.lat === "number" ? `https://maps.google.com/?q=${a.lat},${a.lng}` : "sem posição";
    const body = `[PROTECTTÚ CENTRAL] S.O.S sem resposta. ${a.user} (${cname(a.cid)}). Posição: ${pos}. Hora: ${dt(a.ts)}.`;
    const card = PT.el("div", { class: "q" }, PT.el("div", { class: "lines" }, PT.el("b", { text: `${a.user} · ${cname(a.cid)}` }),
      PT.el("div", { text: `Há ${Math.floor((Date.now() - a.ts) / 60000)} min · ${a.text}` })));
    const call = (label, num) => { card.append(PT.el("div", { class: "lines", text: label }), PT.el("a", { class: "call", href: "tel:" + tel(num), text: "📞 Ligar" }), PT.el("a", { href: PT.smsLink([tel(num)], body), text: "✉ SMS" })); };
    if (a.pol) call(`Polícia indicada pelo utilizador: ${a.polNome || ""} ${a.pol}`, a.pol);
    if (n) call(`Mais próxima (Central): ${n.u.name} ${n.u.number}${n.km != null ? " · " + n.km.toFixed(1) + " km" : ""}`, n.u.number);
    else if (!a.pol) card.append(PT.el("div", { class: "lines", text: "Sem polícia registada — aba Polícia." }));
    if (typeof a.lat === "number") card.append(PT.el("button", { type: "button", text: "Ver no mapa", onclick: () => { go("map"); const o = MAPS.map2; o && o.m.setView([a.lat, a.lng], 16); } }));
    card.append(PT.el("button", { type: "button", text: "Tratado", onclick: () => set(ref(api.db, `communities/${a.cid}/alerts/${a.id}/handled`), serverTimestamp()).catch(() => PT.toast("Sem permissão — republique as regras", "err")) }));
    q.append(card);
  });
}

/* ---------- Polícia + espera + índice ---------- */
$("wait").onchange = () => { WAIT = +$("wait").value; PT.set("protecttu_wait", WAIT); render(); };
$("mark").onclick = () => { placing = true; PT.toast("Clique no mapa para marcar a unidade"); go("map"); };
function renderUnits() {
  const u = $("units"); u.replaceChildren(); const e = Object.entries(D.police);
  if (!e.length) u.append(PT.el("p", { class: "lines", text: "Nenhuma unidade registada." }));
  e.forEach(([id, v]) => u.append(PT.el("div", { class: "u" }, PT.el("div", {}, PT.el("b", { text: v.name }), PT.el("small", { text: v.number + (typeof v.lat === "number" ? ` · ${v.lat.toFixed(3)}, ${v.lng.toFixed(3)}` : " · sem posição") })),
    PT.el("button", { type: "button", "aria-label": "Apagar", text: "✕", onclick: () => confirm("Apagar " + v.name + "?") && remove(ref(api.db, "config/police/" + id)) }))));
}
$("uform").addEventListener("submit", async (e) => {
  e.preventDefault(); $("uerr").textContent = "";
  const name = $("un").value.trim(), number = $("unum").value.replace(/\s/g, "");
  if (name.length < 2 || !/^\+?\d{3,15}$/.test(number)) { $("uerr").textContent = "Indique o nome e um número válido."; return; }
  const u = { name, number, ts: serverTimestamp() }; if (draft) { u.lat = draft.lat; u.lng = draft.lng; }
  try { await push(ref(api.db, "config/police"), u); $("un").value = ""; $("unum").value = ""; draft = null; $("ucoord").textContent = "sem posição"; PT.toast("Unidade guardada"); }
  catch { $("uerr").textContent = "Sem permissão — republique as regras do Firebase e confirme que é administrador."; }
});
$("addc").addEventListener("submit", async (e) => {
  e.preventDefault(); $("adderr").textContent = "";
  const cid = api.slug($("addn").value);
  try {
    const m = (await get(ref(api.db, `communities/${cid}/meta`))).val(); if (!m) throw 0;
    await set(ref(api.db, `index/${cid}`), { name: m.name, adminUid: m.adminUid, created: serverTimestamp() }); $("addn").value = ""; PT.toast("Comunidade adicionada");
  } catch { $("adderr").textContent = "Não encontrada, já está no índice ou sem permissão (republique as regras)."; }
});

/* ---------- Anel decorativo ---------- */
const cv = $("ringc"), c = cv.getContext("2d"); let T = 0;
const rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(11);
const GL = Array.from({ length: 36 }, () => Array.from({ length: 4 }, () => [rnd(), rnd()]));
function frame() {
  requestAnimationFrame(frame);
  const W = cv.clientWidth; if (!W) return; const d = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(W * d)) cv.width = cv.height = Math.round(W * d);
  c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, W); c.translate(W / 2, W / 2);
  T += 0.01; const R = W * 0.46, hot = S.un > 0, col = hot ? "#ff2e63" : "#19d3f3", gl = hot ? "#ff9d2e" : "#3be04a";
  c.lineWidth = 5; c.strokeStyle = "#0a5fff"; c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke();
  c.lineWidth = 2; c.strokeStyle = col; c.beginPath(); c.arc(0, 0, R * 0.955, 0, 7); c.stroke();
  for (let i = 0; i < 9; i++) { c.save(); c.rotate((i * Math.PI * 2) / 9 - Math.PI / 2); c.fillStyle = col; c.beginPath(); c.moveTo(R * 1.03, -R * 0.06); c.lineTo(R * 1.03, R * 0.06); c.lineTo(R * 0.88, 0); c.closePath(); c.fill(); c.restore(); }
  const r1 = R * 0.76, r2 = R * 0.93, w = (Math.PI * 2) / 36;
  c.save(); c.rotate(T * 0.04);
  for (let i = 0; i < 36; i++) {
    const a0 = i * w + 0.02, a1 = (i + 1) * w - 0.02;
    c.beginPath(); c.arc(0, 0, r2, a0, a1); c.arc(0, 0, r1, a1, a0, true); c.closePath(); c.fillStyle = "rgba(2,16,32,.92)"; c.fill(); c.lineWidth = 1; c.strokeStyle = col; c.stroke();
    c.beginPath(); GL[i].forEach(([u, v], k) => { const a = a0 + u * (a1 - a0), r = r1 + (0.15 + v * 0.7) * (r2 - r1); k ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); });
    c.lineWidth = 1.6; c.strokeStyle = gl; c.stroke();
  }
  c.restore();
  c.save(); c.setLineDash([6, 9]); c.lineDashOffset = -T * 60; c.lineWidth = 1.5; c.strokeStyle = col; c.beginPath(); c.arc(0, 0, R * 0.72, 0, 7); c.stroke(); c.restore();
  const sw = T * 1.4;
  for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(25,211,243,${0.14 * (1 - i / 30)})`; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R * 0.7, sw - i * 0.04 - 0.04, sw - i * 0.04); c.fill(); }
}
frame();

(async () => {
  if (!api.configured) { $("err").textContent = "Firebase não configurado."; $("go").disabled = true; return; }
  await api.auth.authStateReady();
  if (await isAdmin(api.auth.currentUser)) open(api.auth.currentUser);
})();
