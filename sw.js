// Service worker: rede primeiro, cache como reserva. Quem está online sempre vê
// a versão mais nova; offline (ou com a rede lenta demais) usa a última cópia.

// Ao mudar o código do site (não o cronograma.yaml), incremente esta versão:
// é a mudança neste arquivo que faz quem está com o app aberto recarregar.
const CACHE = 'cronograma-v3';
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
  // `reload` ignora o cache HTTP do navegador (o GitHub Pages manda guardar por 10 min).
  const requisicoes = ARQUIVOS.map((url) => new Request(url, { cache: 'reload' }));
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requisicoes)));
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

  // `no-cache` revalida com o servidor em vez de usar a cópia do cache HTTP do navegador.
  const daRede = fetch(request, { cache: 'no-cache' }).then(async (resposta) => {
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
