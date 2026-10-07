/* PROTECTTÚ — escuta S.O.S da comunidade. Toca o alarme se eu for contacto de quem pediu ajuda. */
import * as api from "./community-api.js";
const s = PT.get("protecttu_session", null);
let ov = null;

async function start() {
  api.announcePresence(s).catch(() => {});
  let me; try { me = await api.ensureAuth(); } catch { return; }
  const perfil = PT.get("protecttu_perfil", {}) || {};
  const myH = perfil.telefone ? await api.phoneHash(s.cid, PT.normPhone(perfil.telefone)) : null;
  const seen = new Set(PT.get("protecttu_seen_alerts", []));
  api.watchAlerts(s.cid, (a) => {
    if (a.type !== "sos" || a.uid === me.uid || seen.has(a.id)) return;
    if (Date.now() - (a.ts || Date.now()) > 180000) return;            // ignora alertas antigos
    seen.add(a.id); PT.set("protecttu_seen_alerts", [...seen].slice(-30));
    show(a, !!(myH && a.for && a.for[myH]));
  });
}
function show(a, loud) {
  if (ov) ov.remove();
  const close = () => { PTAlarm.siren(false); ov && ov.remove(); ov = null; };
  ov = PT.el("div", { class: "gd-overlay", role: "alertdialog", "aria-live": "assertive" },
    PT.el("h2", { text: "🚨 S.O.S — " + a.user }),
    PT.el("p", { class: "muted", text: `Pede ajuda${loud ? " (é um dos seus contactos)" : ""} · ${PT.fmtDate(a.ts)}` }),
    typeof a.lat === "number" ? PT.el("a", { class: "btn-secondary", target: "_blank", rel: "noopener noreferrer", href: `https://maps.google.com/?q=${a.lat},${a.lng}`, text: "📍 Ver localização" }) : null,
    PT.el("button", { class: "btn-primary", text: "✋ Já vi / vou ajudar", onclick: () => { api.ackAlert(s.cid, a.id).catch(() => {}); close(); } }),
    PT.el("button", { class: "btn-secondary", text: "Silenciar", onclick: close }));
  document.body.append(ov);
  navigator.vibrate && navigator.vibrate([400, 150, 400]);
  loud ? PTAlarm.siren(true) : PTAlarm.beep();
}
if (s && api.configured) start();
