import {
  interpretarCronograma,
  ErroCronograma,
  agoraNoFuso,
  formatarHorario,
  estadoDaAtividade,
  faixaDoDia,
  posicaoDoAgora,
  diaDoAgora,
  diaInicial,
  layoutDoDia,
} from './lib/cronograma.js';

const ARQUIVO_DO_CRONOGRAMA = 'cronograma.yaml';
const CHAVE_ULTIMO_VALIDO = 'cronograma:ultimo-valido';
const PX_POR_MINUTO = 1.6;
const ALTURA_MINIMA_DO_CARD = 30;
const ALTURA_CARD_COMPACTO = 48;
const INTERVALO_DE_ATUALIZACAO = 30_000;

const el = {
  titulo: document.getElementById('titulo'),
  abas: document.getElementById('abas'),
  aviso: document.getElementById('aviso'),
  linhaDoTempo: document.getElementById('linha-do-tempo'),
  botaoAgora: document.getElementById('botao-agora'),
  detalhes: document.getElementById('detalhes'),
  detalhesNome: document.getElementById('detalhes-nome'),
  detalhesHorario: document.getElementById('detalhes-horario'),
  detalhesLocal: document.getElementById('detalhes-local'),
  detalhesPalestrante: document.getElementById('detalhes-palestrante'),
  detalhesResponsavel: document.getElementById('detalhes-responsavel'),
  detalhesDescricao: document.getElementById('detalhes-descricao'),
};

let cronograma = null;
let dataSelecionada = null;

// ---------------------------------------------------------------------------
// Carregamento

async function carregar() {
  let texto = null;
  try {
    const resposta = await fetch(ARQUIVO_DO_CRONOGRAMA, { cache: 'no-cache' });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    texto = await resposta.text();
  } catch {
    // Sem rede e sem cache do service worker: cai para a última versão válida abaixo.
  }

  if (texto != null) {
    try {
      cronograma = interpretarCronograma(texto);
      salvarUltimoValido(texto);
      mostrarAviso(null);
      return;
    } catch (e) {
      if (!(e instanceof ErroCronograma)) throw e;
      const anterior = lerUltimoValido();
      mostrarAviso(e.erros, anterior != null);
      if (anterior) cronograma = anterior;
      else el.linhaDoTempo.replaceChildren();
      return;
    }
  }

  const anterior = lerUltimoValido();
  if (anterior) cronograma = anterior;
  else el.linhaDoTempo.replaceChildren(mensagem('Não foi possível carregar o cronograma. Verifique a conexão.'));
}

function salvarUltimoValido(texto) {
  try {
    localStorage.setItem(CHAVE_ULTIMO_VALIDO, texto);
  } catch {}
}

function lerUltimoValido() {
  try {
    const texto = localStorage.getItem(CHAVE_ULTIMO_VALIDO);
    return texto ? interpretarCronograma(texto) : null;
  } catch {
    return null;
  }
}

function mostrarAviso(erros, usandoVersaoAnterior = false) {
  if (!erros) {
    el.aviso.hidden = true;
    return;
  }
  const titulo = document.createElement('p');
  titulo.textContent = usandoVersaoAnterior
    ? 'Erro no cronograma. Mostrando a última versão válida.'
    : 'Erro no cronograma:';
  const lista = document.createElement('ul');
  for (const erro of erros) {
    const item = document.createElement('li');
    item.textContent = erro;
    lista.append(item);
  }
  el.aviso.replaceChildren(titulo, lista);
  el.aviso.hidden = false;
}

// ---------------------------------------------------------------------------
// Renderização

function agora() {
  return agoraNoFuso(new Date(), cronograma.fuso);
}

function diaSelecionado() {
  return cronograma.dias.find((d) => d.data === dataSelecionada) ?? null;
}

function renderizar() {
  if (!cronograma) return;
  const momento = agora();

  if (!diaSelecionado()) dataSelecionada = diaInicial(cronograma.dias, momento).data;

  el.titulo.textContent = cronograma.nome;
  document.title = cronograma.nome;
  renderizarAbas();
  renderizarDia(diaSelecionado(), momento);
  el.botaoAgora.hidden = diaDoAgora(cronograma.dias, momento) == null;
}

const formatoDiaDaSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });

function rotuloDoDia(data) {
  const [, mes, dia] = data.split('-');
  const semana = formatoDiaDaSemana.format(new Date(`${data}T12:00:00Z`)).replace('.', '');
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${dia}/${mes}`;
}

function renderizarAbas() {
  el.abas.hidden = false;
  el.abas.setAttribute('role', 'tablist');
  const abas = cronograma.dias.map((dia) => {
    const aba = document.createElement('button');
    aba.type = 'button';
    aba.className = 'aba';
    aba.setAttribute('role', 'tab');
    aba.setAttribute('aria-selected', String(dia.data === dataSelecionada));
    aba.textContent = rotuloDoDia(dia.data);
    aba.addEventListener('click', () => {
      dataSelecionada = dia.data;
      renderizar();
      rolarParaAgora('instant');
    });
    return aba;
  });
  el.abas.replaceChildren(...abas);
  el.abas.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function renderizarDia(dia, momento) {
  if (dia.atividades.length === 0) {
    el.linhaDoTempo.replaceChildren(mensagem('Nenhuma atividade neste dia.'));
    return;
  }

  const faixa = faixaDoDia(dia);
  const y = (minutos) => (minutos - faixa.inicio) * PX_POR_MINUTO;

  const grade = document.createElement('div');
  grade.className = 'grade';
  grade.style.height = `${y(faixa.fim)}px`;

  for (let minutos = faixa.inicio; minutos <= faixa.fim; minutos += 60) {
    const hora = document.createElement('div');
    hora.className = 'hora';
    hora.style.top = `${y(minutos)}px`;
    const rotulo = document.createElement('span');
    rotulo.textContent = formatarHorario(minutos);
    hora.append(rotulo);
    grade.append(hora);
  }

  const cards = document.createElement('div');
  cards.className = 'cards';
  const duracaoMinima = ALTURA_MINIMA_DO_CARD / PX_POR_MINUTO;
  for (const { atividade, coluna, colunas } of layoutDoDia(dia.atividades, duracaoMinima)) {
    cards.append(criarCard(atividade, dia, momento, { y, coluna, colunas }));
  }
  grade.append(cards);

  const posicao = posicaoDoAgora(dia, momento);
  if (posicao != null) {
    const linha = document.createElement('div');
    linha.className = 'agora';
    linha.id = 'agora';
    linha.style.top = `${y(posicao)}px`;
    grade.append(linha);
  }

  el.linhaDoTempo.replaceChildren(grade);
}

function criarCard(atividade, dia, momento, { y, coluna, colunas }) {
  const altura = Math.max(ALTURA_MINIMA_DO_CARD, y(atividade.fim) - y(atividade.inicio)) - 2;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = `card ${estadoDaAtividade(atividade, dia, momento)}`;
  const compacto = altura < ALTURA_CARD_COMPACTO;
  if (compacto) card.classList.add('compacto');
  card.style.top = `${y(atividade.inicio) + 1}px`;
  card.style.height = `${altura}px`;
  card.style.left = `calc(${(coluna / colunas) * 100}% + 1px)`;
  card.style.width = `calc(${100 / colunas}% - 2px)`;

  const nome = document.createElement('span');
  nome.className = 'card-nome';
  nome.textContent = atividade.nome;

  const info = document.createElement('span');
  info.className = 'card-info';
  info.textContent = [horarioDaAtividade(atividade), atividade.local].filter(Boolean).join(' · ');

  // Nome e horário ficam juntos para que, no card compacto, o Responsável seja
  // o único item que pode ir para a linha escondida quando faltar espaço.
  const principal = document.createElement('span');
  principal.className = 'card-principal';
  principal.append(nome, info);
  card.append(principal);

  if (atividade.responsavel) {
    const responsavel = document.createElement('span');
    responsavel.className = 'card-info card-responsavel';
    responsavel.textContent = `${compacto ? 'Resp.' : 'Responsável'}: ${atividade.responsavel}`;
    card.append(responsavel);
  }
  card.addEventListener('click', () => abrirDetalhes(atividade));
  return card;
}

function horarioDaAtividade(atividade) {
  return `${formatarHorario(atividade.inicio)} – ${formatarHorario(atividade.fim)}`;
}

function mensagem(texto) {
  const p = document.createElement('p');
  p.className = 'mensagem';
  p.textContent = texto;
  return p;
}

// ---------------------------------------------------------------------------
// Popup de detalhes

function abrirDetalhes(atividade) {
  el.detalhesNome.textContent = atividade.nome;
  el.detalhesHorario.textContent = horarioDaAtividade(atividade);
  preencherInfo(el.detalhesLocal, atividade.local);
  preencherInfo(el.detalhesPalestrante, atividade.palestrante && `Palestrante: ${atividade.palestrante}`);
  preencherInfo(el.detalhesResponsavel, atividade.responsavel && `Responsável: ${atividade.responsavel}`);
  el.detalhesDescricao.replaceChildren(...textoComLinks(atividade.descricao));
  el.detalhesDescricao.hidden = !atividade.descricao;
  el.detalhes.showModal();
}

function preencherInfo(elemento, texto) {
  elemento.textContent = texto;
  elemento.hidden = !texto;
}

/** Quebra o texto em nós, transformando URLs em links clicáveis. */
function textoComLinks(texto) {
  const nos = [];
  let ultimo = 0;
  for (const m of texto.matchAll(/https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]/g)) {
    nos.push(document.createTextNode(texto.slice(ultimo, m.index)));
    const link = document.createElement('a');
    link.href = m[0];
    link.textContent = m[0];
    link.target = '_blank';
    link.rel = 'noopener';
    nos.push(link);
    ultimo = m.index + m[0].length;
  }
  nos.push(document.createTextNode(texto.slice(ultimo)));
  return nos;
}

// Tocar fora do popup fecha.
el.detalhes.addEventListener('click', (evento) => {
  if (evento.target === el.detalhes) el.detalhes.close();
});

// ---------------------------------------------------------------------------
// Rolagem e atualização

function rolarParaAgora(comportamento = 'smooth') {
  const linha = document.getElementById('agora');
  let destino = 0;
  if (linha) {
    destino = linha.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;
  } else if (cronograma && diaJaTerminou(diaSelecionado())) {
    destino = document.documentElement.scrollHeight;
  }
  window.scrollTo({ top: Math.max(0, destino), behavior: comportamento });
}

function diaJaTerminou(dia) {
  return dia.atividades.length > 0 && dia.atividades.every((a) => estadoDaAtividade(a, dia, agora()) === 'encerrada');
}

el.botaoAgora.addEventListener('click', () => {
  dataSelecionada = diaDoAgora(cronograma.dias, agora())?.data ?? dataSelecionada;
  renderizar();
  rolarParaAgora();
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  navigator.serviceWorker?.getRegistration().then((registro) => registro?.update());
  await carregar();
  renderizar();
});

setInterval(renderizar, INTERVALO_DE_ATUALIZACAO);

if ('serviceWorker' in navigator) {
  // Quando uma versão nova do site assume, recarrega para não seguir rodando o
  // código antigo (o app instalado pode ficar dias aberto em segundo plano).
  // Na primeira instalação não havia versão anterior, então não recarrega.
  let controladorAtual = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controladorAtual) location.reload();
    controladorAtual = navigator.serviceWorker.controller;
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

await carregar();
renderizar();
rolarParaAgora('instant');
