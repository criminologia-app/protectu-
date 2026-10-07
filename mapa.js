const $ = (id) => document.getElementById(id);
    let map, marker, circle;
    function draw(p) {
      const { latitude: lat, longitude: lng, accuracy } = p.coords;
      PT.set("protecttu_lastpos", { lat, lng, acc: Math.round(accuracy), ts: Date.now() });
      $("gps").textContent = "GPS sintonizado (±" + Math.round(accuracy) + " m)";
      $("coords").innerHTML = "";
      $("coords").append("Lat: " + lat.toFixed(6), document.createElement("br"), "Lng: " + lng.toFixed(6));
      if (!window.L || window.noMap) return;
      if (!map) { map = L.map("map", { zoomControl: true }).setView([lat, lng], 16);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map); }
      marker ? marker.setLatLng([lat, lng]) : (marker = L.circleMarker([lat, lng], { radius: 9, color: "#00f2fe", fillColor: "#00f2fe", fillOpacity: .9 }).addTo(map));
      circle ? circle.setLatLng([lat, lng]).setRadius(accuracy) : (circle = L.circle([lat, lng], { radius: accuracy, color: "#00f2fe", weight: 1, fillOpacity: .08 }).addTo(map));
      map.setView([lat, lng]);
    }
    function locate() {
      if (!navigator.geolocation) { $("gps").textContent = "Este aparelho não tem GPS."; return; }
      $("gps").textContent = "A procurar sinal GPS…";
      navigator.geolocation.getCurrentPosition(draw, (e) => {
        $("gps").textContent = e.code === 1 ? "Permissão de localização negada. Ative-a nas definições do browser." : "Sinal de GPS indisponível.";
        const last = PT.get("protecttu_lastpos", null);
        if (last) $("coords").textContent = `Última posição: ${last.lat.toFixed(6)}, ${last.lng.toFixed(6)} (${PT.fmtDate(last.ts)})`;
      }, { enableHighAccuracy: true, timeout: 10000 });
    }
    $("btn").onclick = locate;
    window.addEventListener("load", locate);
