/* PROTECTTÚ — efeito "Xylophone Helix" em canvas 2D (sem dependências).
   Barras metálicas em hélice; passar o dedo/rato faz a barra balançar e
   deixa um rasto de cor (arco-íris). Arrastar roda a hélice. */
(function () {
  const RAINBOW = [[255,0,0],[255,153,0],[255,238,0],[51,255,0],[0,153,255],[153,0,255]];
  const ramp = (u) => {
    const n = RAINBOW.length, t = (((u % 1) + 1) % 1) * n, k = Math.floor(t), f = t - k;
    const a = RAINBOW[k % n], b = RAINBOW[(k + 1) % n];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };

  window.PTHelix = function (canvas, opts) {
    const bars = (opts && opts.bars) || 44;
    const ctx = canvas.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const strike = new Float32Array(bars).fill(-1e9);
    const ptr = { x: 0, y: 0, active: false, down: false };
    let W = 0, H = 0, rot = 0, spin = 0, t = 0, last = performance.now(), raf = 0, stopped = false;

    function resize() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const toLocal = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const onMove = (e) => {
      const [x, y] = toLocal(e);
      if (ptr.down) spin += (x - ptr.x) * 0.012;
      ptr.x = x; ptr.y = y; ptr.active = true;
    };
    const onDown = (e) => { ptr.down = true; [ptr.x, ptr.y] = toLocal(e); ptr.active = true; };
    const onUp = () => { ptr.down = false; };
    const onLeave = () => { ptr.active = false; ptr.down = false; };
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerdown", onDown, { passive: true });
    addEventListener("pointerup", onUp, { passive: true });
    addEventListener("pointercancel", onLeave, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    new ResizeObserver(resize).observe(canvas);
    resize();

    function frame(now) {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now; t += dt;
      spin *= Math.pow(0.04, dt);              // inércia do arrasto
      rot += (reduce ? 0 : dt * 0.35) + spin * dt * 8;

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.24, L = R * 0.62, f = R * 5;
      const rise = (H * 0.8) / bars, thick = Math.max(4, rise * 0.62);

      // ponteiro virtual quando ninguém toca (efeito "autoplay")
      let px = ptr.x, py = ptr.y, live = ptr.active;
      if (!live && !reduce) { px = cx + Math.cos(t * 0.6) * W * 0.25; py = cy + Math.sin(t * 0.9) * H * 0.3; live = true; }

      const list = [];
      for (let i = 0; i < bars; i++) {
        const th = i * 0.36 + rot;
        const age = t - strike[i];
        const env = age >= 0 ? Math.exp(-age * 4.5) : 0;
        const swing = reduce ? 0 : env * 0.58 * Math.sin(age * 16);
        const bx = R * Math.cos(th), bz = R * Math.sin(th), by = (i - (bars - 1) / 2) * rise;
        const phi = th + Math.PI / 2 + swing;
        const dx = Math.cos(phi) * L, dz = Math.sin(phi) * L;
        const proj = (x, y, z) => { const s = f / (f - z); return [cx + x * s, cy + (y + z * 0.28) * s, s]; };
        const a = proj(bx - dx, by, bz - dz), b = proj(bx + dx, by, bz + dz), m = proj(bx, by, bz);
        list.push({ i, th, swing, z: bz, a, b, m, age });
      }
      list.sort((p, q) => p.z - q.z);

      for (const p of list) {
        const w = thick * p.m[2];
        if (live && t - strike[p.i] > 0.4 && Math.hypot(p.m[0] - px, p.m[1] - py) < Math.max(18, w * 1.6)) strike[p.i] = t;

        const depth = (p.z / R) * 0.5 + 0.5;
        const spec = Math.pow(Math.max(0, Math.cos(p.th + p.swing - 0.6)), 18);
        let g = 60 + 110 * depth + 85 * spec;
        let col = [g * 0.95, g, g * 1.08];
        const wake = Math.exp(-Math.max(0, p.age) * 1.5);
        if (p.age >= 0 && wake > 0.02) {
          const c = ramp(p.i / bars);
          const k = Math.min(1, wake * 0.95);
          col = col.map((v, j) => v + (c[j] - v) * k);
          ctx.shadowColor = `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
          ctx.shadowBlur = 18 * wake;
        } else ctx.shadowBlur = 0;

        ctx.lineCap = "round";
        ctx.lineWidth = w;
        ctx.strokeStyle = `rgb(${Math.min(255, col[0])|0},${Math.min(255, col[1])|0},${Math.min(255, col[2])|0})`;
        ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1]); ctx.lineTo(p.b[0], p.b[1]); ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, w * 0.3);
        ctx.strokeStyle = `rgba(255,255,255,${0.14 + 0.4 * spec})`;
        ctx.beginPath(); ctx.moveTo(p.a[0], p.a[1] - w * 0.22); ctx.lineTo(p.b[0], p.b[1] - w * 0.22); ctx.stroke();
      }
    }
    raf = requestAnimationFrame(frame);

    const vis = () => {
      if (document.hidden) { cancelAnimationFrame(raf); }
      else if (!stopped) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener("visibilitychange", vis);

    return {
      destroy() {
        stopped = true; cancelAnimationFrame(raf);
        removeEventListener("pointermove", onMove); removeEventListener("pointerdown", onDown);
        removeEventListener("pointerup", onUp); removeEventListener("pointercancel", onLeave);
        document.removeEventListener("visibilitychange", vis);
      },
    };
  };
})();
