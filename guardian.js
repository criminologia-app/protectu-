/* PROTECTTÚ — Modo Guardião: movimento brusco → "está bem?" → alarme + S.O.S */
(function () {
  const KEY = "protecttu_guardian", THRESH = 30;   // m/s² (~3 g)
  const cfg = Object.assign({ on: false, timeout: 30, consent: false }, PT.get(KEY, {}));
  const $ = (id) => document.getElementById(id), { audio, beep, siren } = PTAlarm;
  let beepT, tickT, overlay, lastTrig = 0, wake = null, motion = false, dark = null;
  const save = () => PT.set(KEY, cfg);

  function closePrompt() { clearInterval(tickT); clearInterval(beepT); siren(false); if (overlay) { overlay.remove(); overlay = null; } }
  function escalate() {
    clearInterval(tickT); clearInterval(beepT); siren(true);
    if (overlay) overlay.replaceChildren(PT.el("h2", { text: "🚨 ALARME ATIVO" }),
      PT.el("p", { class: "muted", text: "S.O.S disparado e comunidade avisada (se houver internet). Os seus contactos na comunidade ouvem o alarme." }),
      PT.el("button", { class: "btn-primary", text: "Parar alarme", onclick: closePrompt }));
    if (window.PTSOS) window.PTSOS.fire({ sms: false });
  }
  function ask(reason) {
    if (overlay) return;
    const p = PT.get("protecttu_perfil", {}) || {}, trat = p.tratamento === "senhora" ? "Senhora" : "Senhor";
    const end = Date.now() + cfg.timeout * 1000, fmt = (s) => (s >= 60 ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : s + " s");
    const cd = PT.el("div", { class: "gd-count", text: fmt(cfg.timeout) });
    overlay = PT.el("div", { class: "gd-overlay", role: "alertdialog", "aria-live": "assertive" },
      PT.el("h2", { text: p.nome ? `${trat} ${p.nome}, está bem?` : "Está tudo bem?" }),
      PT.el("p", { class: "muted", text: `Detetámos ${reason}. Sem resposta, o S.O.S dispara.` }), cd,
      PT.el("button", { class: "btn-primary", text: "✅ Estou bem", onclick: closePrompt }),
      PT.el("button", { class: "btn-danger", text: "🚨 Preciso de ajuda", onclick: escalate }));
    document.body.append(overlay);
    beep(); beepT = setInterval(() => { beep(); navigator.vibrate && navigator.vibrate(300); }, 1000);
    tickT = setInterval(() => { const left = Math.ceil((end - Date.now()) / 1000); if (left <= 0) escalate(); else cd.textContent = fmt(left); }, 500);
  }
  function onMotion(e) {
    const a = e.accelerationIncludingGravity; if (!a) return;
    if (Math.hypot(a.x || 0, a.y || 0, a.z || 0) > THRESH && Date.now() - lastTrig > 60000) { lastTrig = Date.now(); ask("um movimento muito brusco"); }
  }
  async function startMotion() {
    if (motion) return true;
    if (typeof DeviceMotionEvent === "undefined") return false;
    if (typeof DeviceMotionEvent.requestPermission === "function") { try { if ((await DeviceMotionEvent.requestPermission()) !== "granted") return false; } catch { return false; } }
    addEventListener("devicemotion", onMotion); motion = true; return true;
  }
  async function keepAwake() { try { if ("wakeLock" in navigator) wake = await navigator.wakeLock.request("screen"); } catch {} }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && cfg.on) keepAwake(); });

  /* Modo discreto: ecrã preto (continua "ligado" para o sensor funcionar). Premir 2 s para sair. */
  function discreet(on) {
    if (!on) { if (dark) { dark.remove(); dark = null; } return; }
    if (dark) return; let t;
    dark = PT.el("div", { class: "dark-mode" }, PT.el("span", { text: "Guardião ativo · mantenha premido 2 s para sair" }));
    dark.addEventListener("pointerdown", () => { t = setTimeout(() => discreet(false), 2000); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => dark.addEventListener(ev, () => clearTimeout(t)));
    document.body.append(dark);
  }
  function paint() {
    const t = $("gdToggle"); if (!t) return;
    t.textContent = cfg.on ? "Desativar Guardião" : "Ativar Guardião";
    $("gdState").textContent = cfg.on ? (motion ? "🟢 Ativo — ecrã ligado (use o modo discreto para ecrã preto)." : "⚠️ Sensor de movimento indisponível neste aparelho/navegador.") : "Desativado.";
  }
  window.PTGuardian = { ask };

  document.addEventListener("DOMContentLoaded", () => {
    if (!$("gdToggle")) return;
    $("gdTimeout").value = String(cfg.timeout);
    $("gdTimeout").onchange = () => { cfg.timeout = +$("gdTimeout").value; save(); };
    $("gdToggle").onclick = async () => {
      if (cfg.on) { cfg.on = false; removeEventListener("devicemotion", onMotion); motion = false; wake && wake.release().catch(() => {}); discreet(false); }
      else {
        if (!cfg.consent && !confirm("Autoriza o PROTECTTÚ a usar o sensor de movimento e a manter o ecrã ligado enquanto o Guardião estiver ativo?\n\nCom o ecrã desligado ou o telemóvel bloqueado o navegador suspende os sensores. Para poupar atenção use o 'Modo discreto' (ecrã preto).")) return;
        cfg.consent = true; audio(); cfg.on = true; await startMotion(); keepAwake();
      }
      save(); paint();
    };
    $("gdDark").onclick = () => { if (!cfg.on) { PT.toast("Ative o Guardião primeiro", "err"); return; } discreet(true); };
    $("gdTest").onclick = () => { audio(); siren(true); setTimeout(() => siren(false), 3000); };
    if (cfg.on) startMotion().then(paint);
    paint();
  });
})();
