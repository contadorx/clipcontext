/* Service worker do Walkstamp.
   Rede primeiro para documentos: uma ferramenta que abre a versão de ontem
   depois de um deploy é pior do que uma que não instala. O cache existe para o
   caso de a rede cair no meio do trabalho, e para os arquivos estáticos.
   Ele NÃO guarda vídeo, áudio, transcrição nem documento gerado: nada disso
   passa por aqui, porque nada disso é uma requisição de rede. */
/* A versão tem duas partes: a dos ícones e a DO PRÓPRIO service worker. Elas
   mudam por motivos diferentes — a segunda subiu quando /conta e /api saíram do
   cache, e ela precisa subir para que o cache velho, que ainda guarda o e-mail
   do cliente, seja apagado pelo `activate`. Um conserto que não invalida o
   cache antigo não conserta a máquina de ninguém. */
const CACHE = 'walkstamp-v3.2';
const ESSENCIAIS = ['/app', '/site.css', '/favicon.svg', '/logo.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESSENCIAIS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ns =>
    Promise.all(ns.filter(n => n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // CDN e modelo não passam por aqui
  /* A CONTA E AS APIs NÃO ENTRAM NO CACHE.
     O produto manda `no-store` nessas respostas — e o cache aqui apagava esse
     pedido, porque `caches.put()` não olha `Cache-Control`. O efeito é o pior
     possível numa máquina compartilhada: o e-mail do cliente e a linha da
     fatura sobrevivem ao logout, e voltam para a próxima pessoa quando a rede
     cai. Nada aqui é estático; nada aqui deve ser servido de ontem. */
  if (url.pathname.startsWith('/conta') || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('/app')))
  );
});
