const splash = document.getElementById("splash");
    PTHelix(document.getElementById("helix"), { bars: 44 });

    // Duplo toque (funciona em telemóvel e rato); ignora arrastos
    let lastTap = 0, sx = 0, sy = 0, moved = false;
    splash.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; moved = false; });
    splash.addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) moved = true; });
    splash.addEventListener("pointerup", (e) => {
      if (moved || e.target.closest("a")) return;
      const now = Date.now();
      if (now - lastTap < 420) enter(); else lastTap = now;
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });

    function enter() {
      splash.classList.add("leaving");
      setTimeout(() => (location.href = "home.html"), 550);
    }
