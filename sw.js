/* VetroReport — service worker: guarda a aplicação para abrir sem rede.
   A versão vem de js/config.js (APP_VERSION): ao mudar, a cache muda de nome e a app avisa
   «Nova versão disponível — atualizar». Os dados (Supabase) vão sempre à rede. */
importScripts("js/config.js");
const VERSAO = "vetroreport-" + self.APP_VERSION;
const FICHEIROS = [
  "./", "index.html", "app.css", "manifest.webmanifest",
  "vendor/supabase.js",
  "js/config.js", "js/core.js", "js/changelog.js", "js/store.js", "js/services.js",
  "js/export.js", "js/ui.js", "js/auth.js", "js/importar.js", "js/boot.js",
  "fonts/outfit.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (ev) => {
  // cache: "reload" evita ficheiros antigos da cache HTTP do navegador
  ev.waitUntil(caches.open(VERSAO).then(c => c.addAll(FICHEIROS.map(u => new Request(u, { cache: "reload" })))));
  // Primeira instalação: ativa já. Atualização: espera que o utilizador carregue em «atualizar».
});

self.addEventListener("message", (ev) => {
  if (ev.data === "ATUALIZAR") self.skipWaiting();
  if (ev.data === "VERSAO" && ev.source) ev.source.postMessage({ versao: self.APP_VERSION });
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
    // Página: a da versão instalada (coerente com os scripts em cache); sem cache, rede.
    ev.respondWith(caches.open(VERSAO).then(c => c.match("index.html")).then(hit => hit || fetch(req)));
    return;
  }
  ev.respondWith(
    caches.open(VERSAO).then(c => c.match(req, { ignoreSearch: true })).then(hit => hit || fetch(req).then(r => {
      if (r.ok && r.type === "basic") { const c = r.clone(); caches.open(VERSAO).then(x => x.put(req, c)); }
      return r;
    }))
  );
});
