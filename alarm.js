/* PROTECTTÚ — sirene e ecrã de alarme (partilhado por todas as páginas) */
(function () {
  let ctx, osc, lfo, on = false, vibT, overlay;
  const audio = () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  function beep() {
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = 880; g.gain.value = 0.5; o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.25);
  }
  function siren(v) {
    if (v === on) return; on = v;
    if (v) {
      const c = audio(); if (!c) return;
      osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 950;
      lfo = c.createOscillator(); lfo.frequency.value = 1.6;
      const depth = c.createGain(); depth.gain.value = 450;
      const g = c.createGain(); g.gain.value = 0.9;
      lfo.connect(depth); depth.connect(osc.frequency); osc.connect(g); g.connect(c.destination);
      osc.start(); lfo.start();
      document.body.classList.add("alarm-flash");
      const vib = () => navigator.vibrate && navigator.vibrate([600, 200, 600]); vib(); vibT = setInterval(vib, 2500);
    } else {
      try { osc.stop(); lfo.stop(); } catch {}
      clearInterval(vibT); navigator.vibrate && navigator.vibrate(0);
      document.body.classList.remove("alarm-flash");
    }
  }
  function close() { siren(false); if (overlay) { overlay.remove(); overlay = null; } }
  /* o = { title, text, lat, lng, siren, primary:{label,run}, stopLabel } */
  function show(o) {
    if (overlay) overlay.remove();
    overlay = PT.el("div", { class: "gd-overlay", role: "alertdialog", "aria-live": "assertive" },
      PT.el("h2", { text: o.title }), PT.el("p", { class: "muted", text: o.text || "" }),
      o.lat != null ? PT.el("a", { class: "btn-secondary", target: "_blank", rel: "noopener noreferrer", href: `https://maps.google.com/?q=${o.lat},${o.lng}`, text: "📍 Ver localização" }) : null,
      o.primary ? PT.el("button", { class: "btn-primary", text: o.primary.label, onclick: o.primary.run }) : null,
      PT.el("button", { class: "btn-danger", text: o.stopLabel || "Parar alarme", onclick: close }));
    document.body.append(overlay);
    if (o.siren) siren(true);
  }
  addEventListener("pointerdown", audio, { once: true });   // desbloqueia o som (política dos navegadores)
  window.PTAlarm = { audio, beep, siren, show, close, unlocked: () => !!ctx && ctx.state === "running" };
})();
