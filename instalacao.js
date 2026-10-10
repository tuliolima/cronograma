// Aviso convidando a instalar o app na tela inicial, mostrado só no celular e
// só enquanto o app não estiver instalado nem o aviso tiver sido dispensado.
//
// - Android (Chrome e afins): o navegador dispara `beforeinstallprompt`; guardamos
//   o evento e o botão "Instalar" abre a janela nativa de instalação.
// - iPhone/iPad: não há API de instalação, então o aviso mostra as instruções.

const CHAVE_DISPENSADO = 'cronograma:instalacao-dispensada';

const el = {
  aviso: document.getElementById('instalar'),
  texto: document.getElementById('instalar-texto'),
  botaoInstalar: document.getElementById('instalar-botao'),
  botaoFechar: document.getElementById('instalar-fechar'),
};

export function configurarAvisoDeInstalacao() {
  if (jaInstalado() || foiDispensado() || !ehCelular()) return;

  el.botaoFechar.addEventListener('click', () => {
    esconder();
    lembrarDispensa();
  });

  if (ehIOS()) {
    mostrarInstrucoesDoIOS();
    mostrar();
    return;
  }

  window.addEventListener('beforeinstallprompt', (evento) => {
    // Impede a mini-barra do Chrome; a instalação passa a ser pelo nosso botão.
    evento.preventDefault();
    el.botaoInstalar.hidden = false;
    el.botaoInstalar.onclick = async () => {
      evento.prompt();
      const { outcome } = await evento.userChoice;
      esconder();
      if (outcome === 'accepted') lembrarDispensa();
    };
    mostrar();
  });

  window.addEventListener('appinstalled', () => {
    esconder();
    lembrarDispensa();
  });
}

function mostrarInstrucoesDoIOS() {
  const icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icone.setAttribute('viewBox', '0 0 24 24');
  icone.setAttribute('class', 'icone-compartilhar');
  icone.setAttribute('aria-label', 'Compartilhar');
  icone.innerHTML =
    '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  el.texto.replaceChildren(
    'Toque em ',
    icone,
    ' e depois em “Adicionar à Tela de Início”.',
  );
}

function mostrar() {
  el.aviso.hidden = false;
  // O botão "Agora" e o fim da linha do tempo sobem para não ficarem atrás do aviso.
  document.documentElement.style.setProperty('--altura-instalar', `${el.aviso.offsetHeight}px`);
}

function esconder() {
  el.aviso.hidden = true;
  document.documentElement.style.removeProperty('--altura-instalar');
}

function jaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function ehCelular() {
  return window.matchMedia('(pointer: coarse)').matches;
}

function ehIOS() {
  // iPadOS se apresenta como Mac, mas com tela de toque.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function foiDispensado() {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) != null;
  } catch {
    return false;
  }
}

function lembrarDispensa() {
  try {
    localStorage.setItem(CHAVE_DISPENSADO, new Date().toISOString());
  } catch {}
}
