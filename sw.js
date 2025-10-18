
const VERSION = 'v1.0.0';
const CACHE_SHELL = 'apm-shell-' + VERSION;
const SHELL_FILES = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './assets/data.json',
  './manifest.webmanifest'
];
self.addEventListener('install', (e)=> {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_SHELL).then(c=>c.addAll(SHELL_FILES)));
});
self.addEventListener('activate', (e)=> {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k.startsWith('apm-shell-') && k !== CACHE_SHELL ? caches.delete(k) : null)))
      .then(()=> self.clients.claim())
  );
});
// Network-first for data.json; cache-first for shell.
self.addEventListener('fetch', (e)=>{
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/assets/data.json')) {
    e.respondWith(
      fetch(e.request).then(r=>{
        const clone = r.clone();
        caches.open(CACHE_SHELL).then(c=>c.put('./assets/data.json', clone));
        return r;
      }).catch(()=> caches.match('./assets/data.json'))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
