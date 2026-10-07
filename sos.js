/* PROTECTTÚ — botão S.O.S (pressão longa de 1,5 s) */
(function () {
  const HOLD_MS = 1500, CIRC = 628;
  const btn = document.getElementById("sos-magic-btn");
  if (!btn) return;
  const bar = document.getElementById("sosBar");
  const status = document.getElementById("sosStatus");
  const $ = (id) => document.getElementById(id);

  let t0 = 0, raf = 0, holding = false, busy = false;

  const setStatus = (txt, color) => { status.textContent = txt; status.style.color = color || ""; };
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  function refreshContacts() {
    const none = PT.getContacts().length === 0;
    $("semContactos").classList.toggle("hidden", !none);
    return !none;
  }
  refreshContacts();
  const sw = $("selfSiren");
  if (sw) { sw.checked = PT.get("protecttu_siren_self", true) !== false; sw.onchange = () => PT.set("protecttu_siren_self", sw.checked); }

  function tick(now) {
    if (!holding) return;
    const p = Math.min(1, (now - t0) / HOLD_MS);
    bar.style.strokeDashoffset = CIRC * (1 - p);
    if (p >= 1) { stop(false); fire(); return; }
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (busy || holding) return;
    if (!refreshContacts()) { setStatus("Sem contactos — configure primeiro", "#ff6b8f"); vibrate([80, 60, 80]); return; }
    holding = true; t0 = performance.now();
    btn.classList.add("holding"); setStatus("Continue a premir…", "var(--warn)"); vibrate(20);
    raf = requestAnimationFrame(tick);
  }
  function stop(cancelled) {
    holding = false; cancelAnimationFrame(raf);
    btn.classList.remove("holding"); bar.style.strokeDashoffset = CIRC;
    if (cancelled && !busy) setStatus("Cancelado — mantenha premido para enviar");
  }

  btn.addEventListener("pointerdown", (e) => { e.preventDefault(); btn.setPointerCapture?.(e.pointerId); start(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => btn.addEventListener(ev, () => holding && stop(true)));
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
  // Teclado: manter Espaço/Enter premido
  btn.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } });
  btn.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") holding && stop(true); });

  function getPos() {
    return new Promise((resolve) => {
      const fallback = () => {
        const last = PT.get("protecttu_lastpos", null);
        resolve(last ? { ...last, antiga: true } : null);
      };
      if (!navigator.geolocation) return fallback();
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), ts: Date.now() };
          PT.set("protecttu_lastpos", pos); resolve(pos);
        },
        fallback,
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    });
  }

  async function avisarComunidade(pos) {
    const sessao = PT.get("protecttu_session", null);
    if (!sessao || !navigator.onLine) return false;
    try {
      const api = await import("./community-api.js");
      if (!api.configured) return false;
      const extra = { type: "sos", for: PT.getContacts().map((c) => c.telefone) };
      const pol = PT.get("protecttu_policia", null);
      if (pol && pol.consent && pol.numero) { extra.pol = pol.numero; extra.polNome = pol.nome || ""; }
      if (pos) { extra.lat = pos.lat; extra.lng = pos.lng; }
      const key = await Promise.race([
        api.sendAlert(sessao, "🚨 S.O.S — preciso de ajuda!", extra),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
      ]);
      return key || true;
    } catch (e) { console.warn("[SOS] comunidade:", e); return false; }
  }

  // Se ninguém da comunidade responder no tempo definido, prepara o SMS para a polícia (só com consentimento)
  function agendarEscalada(key, msg) {
    const pol = PT.get("protecttu_policia", null);
    if (!pol || !pol.consent || !pol.numero) return;
    setTimeout(async () => {
      const sessao = PT.get("protecttu_session", null);
      if (key && key !== true && sessao) {
        try { const api = await import("./community-api.js"); if ((await api.countAcks(sessao.cid, key)) > 0) { PT.toast("Alguém da comunidade respondeu"); return; } } catch {}
      }
      PT.toast("Ninguém respondeu — a abrir SMS para a polícia", "err");
      location.href = PT.smsLink([pol.numero], msg + "\n(Sem resposta da comunidade.)");
    }, (pol.espera || 10) * 60000);
  }

  async function fire(opts) {
    busy = true; vibrate([200, 100, 200]);
    setStatus("A obter localização…", "#ff6b8f");
    const contactos = PT.getContacts();
    const pos = await getPos();
    const perfil = PT.get("protecttu_perfil", {});

    let local = "localização indisponível (GPS desligado)";
    if (pos) local = `https://maps.google.com/?q=${pos.lat},${pos.lng}` + (pos.antiga ? " (última posição conhecida)" : ` (±${pos.acc} m)`);
    const msg =
      `[EMERGÊNCIA PROTECTTÚ] ${perfil.nome ? perfil.nome + " precisa" : "Preciso"} de ajuda imediata!\n` +
      `Localização: ${local}\nHora: ${PT.fmtDate(Date.now())}`;

    // Histórico (lido pelo Observatório)
    const hist = PT.get("protecttu_historico", []);
    hist.unshift({ ts: Date.now(), lat: pos ? pos.lat : null, lng: pos ? pos.lng : null, antiga: !!(pos && pos.antiga), para: contactos.map((c) => c.telefone) });
    PT.set("protecttu_historico", hist.slice(0, 100));

    const link = PT.smsLink(contactos.map((c) => c.telefone), msg);
    $("resMsg").textContent = msg;
    $("resSms").href = link;
    $("resCopy").onclick = () => navigator.clipboard?.writeText(msg).then(() => PT.toast("Mensagem copiada"), () => PT.toast("Não foi possível copiar", "err"));
    $("resNote").textContent = "A app de SMS vai abrir. Carregue em Enviar para concluir — a web não consegue enviar SMS sozinha.";
    $("resultado").classList.remove("hidden");
    $("resStop").onclick = () => window.PTAlarm && PTAlarm.siren(false);
    if (PT.get("protecttu_siren_self", true) !== false && window.PTAlarm) PTAlarm.siren(true);

    setStatus("Abra o SMS e carregue em Enviar", "var(--warn)");
    if (!opts || opts.sms !== false) setTimeout(() => (location.href = link), 300);

    const ok = await avisarComunidade(pos);
    if (ok) PT.toast("Comunidade avisada");
    agendarEscalada(ok, msg);
    busy = false;
  }
  window.PTSOS = { fire: (o) => { if (busy) return; if (!PT.getContacts().length) { PT.toast("Sem contactos de emergência", "err"); return; } fire(o); } };
})();
