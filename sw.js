/* VetroReport v3.0 — service worker: guarda a aplicação para abrir sem rede.
   Os dados (Supabase) vão sempre à rede; nunca são guardados aqui. */
const VERSAO = "vetroreport-3.0";
const FICHEIROS = [
  "./", "index.html", "app.css?v=3.0", "manifest.webmanifest",
  "vendor/supabase.js?v=2.119.0",
  "js/config.js?v=3.0", "js/core.js?v=3.0", "js/store.js?v=3.0", "js/services.js?v=3.0",
  "js/export.js?v=3.0", "js/ui.js?v=3.0", "js/auth.js?v=3.0", "js/importar.js?v=3.0", "js/boot.js?v=3.0",
  "fonts/outfit.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(VERSAO).then(c => c.addAll(FICHEIROS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("vetroreport-") && k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase e outros: sempre rede
  if (req.mode === "navigate") {
    // Página: rede primeiro (para apanhar versões novas), cache se não houver rede
    ev.respondWith(
      fetch(req).then(r => { const c = r.clone(); caches.open(VERSAO).then(x => x.put("index.html", c)); return r; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }
  ev.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok && r.type === "basic") { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); }
      return r;
    }))
  );
});
