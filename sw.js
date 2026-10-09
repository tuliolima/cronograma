// Service worker: rede primeiro, cache como reserva. Quem está online sempre vê
// a versão mais nova; offline (ou com a rede lenta demais) usa a última cópia.

const CACHE = 'cronograma-v1';
const TEMPO_LIMITE_DA_REDE = 4000;
const ARQUIVOS = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'lib/cronograma.js',
  'vendor/js-yaml.min.mjs',
  'cronograma.yaml',
  'manifest.webmanifest',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const daRede = fetch(request).then(async (resposta) => {
    if (resposta.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, resposta.clone());
    }
    return resposta;
  });
  // Mesmo que a resposta do cache vença a corrida, a cópia da rede ainda atualiza o cache.
  evento.waitUntil(daRede.catch(() => {}));
  evento.respondWith(redePrimeiro(request, daRede));
});

async function redePrimeiro(request, daRede) {
  const tempoEsgotado = new Promise((_, rejeitar) =>
    setTimeout(() => rejeitar(new Error('tempo esgotado')), TEMPO_LIMITE_DA_REDE),
  );
  try {
    return await Promise.race([daRede, tempoEsgotado]);
  } catch {
    const salvo = await caches.match(request, { ignoreSearch: true });
    return salvo ?? daRede;
  }
}
