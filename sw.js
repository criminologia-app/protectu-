/* PROTECTTÚ — service worker. Ao publicar alterações, aumente CACHE_VERSION. */
const CACHE_VERSION = "v8";
const CACHE = "protecttu-" + CACHE_VERSION;
const ASSETS = [
  "./", "./index.html", "./home.html", "./sos.html", "./cadastro.html", "./mapa.html",
  "./comunidade.html", "./observatorio.html", "./offline.html",
  "./style.css", "./common.js", "./effects.js", "./sos.js", "./guardian.js", "./alarm.js", "./alarmwatch.js", "./vendor/leaflet/leaflet.js", "./vendor/leaflet/leaflet.css", "./central.html", "./central.js", "./central.css", "./index.js", "./home.js", "./cadastro.js", "./mapa.js", "./observatorio.js",
  "./comunidade.js", "./community-api.js", "./firebase-config.js",
  "./manifest.json", "./images/icon-192.png", "./images/icon-512.png",
];

self.addEventListener("install", (e) => {
  // allSettled: um ficheiro em falta NÃO impede a instalação (com addAll impedia)
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(new Request(a, { cache: "reload" }))))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("protecttu-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;     // Firebase, mapas, etc. vão direto à rede
  // Rede primeiro para TUDO (nunca mistura HTML novo com JS antigo); cache só se estiver offline
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("./offline.html") : undefined)))
  );
});
