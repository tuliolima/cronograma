// Lógica pura do cronograma: interpretação do YAML, tempo no Fuso do Evento,
// Estado da Atividade e posicionamento dos cards. Sem acesso ao DOM, para
// poder ser testada no Node.

import { load, CORE_SCHEMA, YAMLException } from '../vendor/js-yaml.min.mjs';

// Todos os instantes são "minutos de relógio" no Fuso do Evento: minutos desde
// 1970-01-01 00:00 como se o relógio da parede fosse UTC. Assim, comparar uma
// Atividade com o horário atual é só comparar números.

const MINUTOS_POR_DIA = 24 * 60;
const MARGEM_DA_FAIXA = 30;
const FAIXA_PADRAO = { inicio: 8 * 60, fim: 18 * 60 };
const CAMPOS_DA_ATIVIDADE = ['nome', 'inicio', 'fim', 'local', 'descricao'];

export class ErroCronograma extends Error {
  constructor(erros) {
    super(erros.join('\n'));
    this.name = 'ErroCronograma';
    this.erros = erros;
  }
}

/**
 * Lê o texto YAML do cronograma e devolve o Evento já validado:
 * { nome, fuso, dias: [{ data, atividades: [{ id, nome, local, descricao, inicio, fim }] }] }
 * onde `inicio` e `fim` são minutos desde a meia-noite do Dia (`fim` pode passar de 1440).
 * Lança ErroCronograma com a lista de problemas encontrados.
 */
export function interpretarCronograma(texto) {
  let doc;
  try {
    // CORE_SCHEMA evita que `2026-11-20` vire um objeto Date.
    doc = load(texto, { schema: CORE_SCHEMA });
  } catch (e) {
    if (e instanceof YAMLException) {
      const linha = e.mark ? ` (linha ${e.mark.line + 1})` : '';
      throw new ErroCronograma([`Erro de sintaxe no YAML${linha}: ${e.reason}`]);
    }
    throw e;
  }

  const erros = [];
  if (!ehObjeto(doc)) {
    throw new ErroCronograma(['O arquivo deve ter os campos "nome", "fuso" e "dias".']);
  }

  const nome = comoTexto(doc.nome);
  if (!nome) erros.push('Campo "nome" do Evento ausente.');

  const fuso = comoTexto(doc.fuso);
  if (!fuso) erros.push('Campo "fuso" do Evento ausente (ex.: America/Sao_Paulo).');
  else if (!fusoValido(fuso)) erros.push(`Fuso "${fuso}" desconhecido (ex.: America/Sao_Paulo).`);

  const dias = [];
  if (!ehObjeto(doc.dias) || Object.keys(doc.dias).length === 0) {
    erros.push('Campo "dias" ausente ou vazio.');
  } else {
    for (const [data, lista] of Object.entries(doc.dias)) {
      const dia = interpretarDia(data, lista, erros);
      if (dia) dias.push(dia);
    }
  }

  if (erros.length > 0) throw new ErroCronograma(erros);

  dias.sort((a, b) => a.data.localeCompare(b.data));
  return { nome, fuso, dias };
}

function interpretarDia(data, lista, erros) {
  if (!dataValida(data)) {
    erros.push(`Dia "${data}" inválido: use o formato AAAA-MM-DD.`);
    return null;
  }
  if (lista == null) return { data, atividades: [] };
  if (!Array.isArray(lista)) {
    erros.push(`Dia ${data}: as atividades devem ser uma lista (cada uma começando com "-").`);
    return null;
  }

  const atividades = [];
  lista.forEach((item, i) => {
    const onde = `Dia ${data}, atividade ${i + 1}${ehObjeto(item) && item.nome ? ` ("${item.nome}")` : ''}`;
    if (!ehObjeto(item)) {
      erros.push(`${onde}: formato inválido.`);
      return;
    }
    const errosAntes = erros.length;

    for (const campo of Object.keys(item)) {
      if (!CAMPOS_DA_ATIVIDADE.includes(campo)) erros.push(`${onde}: campo desconhecido "${campo}".`);
    }
    const nome = comoTexto(item.nome);
    if (!nome) erros.push(`${onde}: campo "nome" ausente.`);
    const inicio = interpretarHorario(item.inicio, 'inicio', onde, erros);
    let fim = interpretarHorario(item.fim, 'fim', onde, erros);

    if (inicio != null && fim != null) {
      if (fim === inicio) erros.push(`${onde}: termina no mesmo horário em que começa.`);
      // Fim antes do início significa que a Atividade termina no dia seguinte.
      if (fim < inicio) fim += MINUTOS_POR_DIA;
    }

    if (erros.length > errosAntes) return;
    atividades.push({
      id: `${data}-${i}`,
      nome,
      local: comoTexto(item.local),
      descricao: comoTexto(item.descricao),
      inicio,
      fim,
    });
  });

  atividades.sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);
  return { data, atividades };
}

function interpretarHorario(valor, campo, onde, erros) {
  if (valor == null) {
    erros.push(`${onde}: campo "${campo}" ausente.`);
    return null;
  }
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(valor).trim());
  if (!m) {
    erros.push(`${onde}: "${campo}" deve ser um horário como "09:30" (recebido: ${JSON.stringify(valor)}).`);
    return null;
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

function ehObjeto(valor) {
  return valor != null && typeof valor === 'object' && !Array.isArray(valor);
}

function comoTexto(valor) {
  if (valor == null) return '';
  return String(valor).trim();
}

function fusoValido(fuso) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: fuso });
    return true;
  } catch {
    return false;
  }
}

function dataValida(data) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

// ---------------------------------------------------------------------------
// Tempo

/** Minutos de relógio da meia-noite de uma data "AAAA-MM-DD". */
export function inicioDoDia(data) {
  const [a, m, d] = data.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 60000;
}

/** Converte um instante real (Date) em minutos de relógio no Fuso do Evento. */
export function agoraNoFuso(instante, fuso) {
  const partes = {};
  const formato = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });
  for (const p of formato.formatToParts(instante)) partes[p.type] = Number(p.value);
  return (
    Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute, partes.second) / 60000
  );
}

/** Formata minutos desde a meia-noite como "HH:MM" (passando da meia-noite, volta a 00:00). */
export function formatarHorario(minutos) {
  const m = ((minutos % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Estado da Atividade e Dias

/** 'futura' | 'em-andamento' | 'encerrada' */
export function estadoDaAtividade(atividade, dia, agora) {
  const base = inicioDoDia(dia.data);
  if (agora < base + atividade.inicio) return 'futura';
  if (agora < base + atividade.fim) return 'em-andamento';
  return 'encerrada';
}

/** Faixa de horas exibida no Dia, em minutos desde a meia-noite, arredondada para a hora cheia. */
export function faixaDoDia(dia) {
  if (dia.atividades.length === 0) return { ...FAIXA_PADRAO };
  const menorInicio = Math.min(...dia.atividades.map((a) => a.inicio));
  const maiorFim = Math.max(...dia.atividades.map((a) => a.fim));
  return {
    inicio: Math.max(0, Math.floor((menorInicio - MARGEM_DA_FAIXA) / 60) * 60),
    fim: Math.ceil((maiorFim + MARGEM_DA_FAIXA) / 60) * 60,
  };
}

/** Posição da Linha do agora no Dia (minutos desde a meia-noite), ou null se estiver fora da faixa. */
export function posicaoDoAgora(dia, agora) {
  const faixa = faixaDoDia(dia);
  const relativo = agora - inicioDoDia(dia.data);
  return relativo >= faixa.inicio && relativo <= faixa.fim ? relativo : null;
}

/** O Dia cuja faixa contém o horário atual, se houver. */
export function diaDoAgora(dias, agora) {
  return dias.find((dia) => posicaoDoAgora(dia, agora) != null) ?? null;
}

/** Dia que deve aparecer ao abrir o site. */
export function diaInicial(dias, agora) {
  const comAgora = diaDoAgora(dias, agora);
  if (comAgora) return comAgora;

  const hoje = dias.find((dia) => {
    const base = inicioDoDia(dia.data);
    return agora >= base && agora < base + MINUTOS_POR_DIA;
  });
  if (hoje) return hoje;

  const proximo = dias.find((dia) => inicioDoDia(dia.data) + faixaDoDia(dia).inicio > agora);
  return proximo ?? dias[dias.length - 1];
}

// ---------------------------------------------------------------------------
// Layout

/**
 * Distribui Atividades sobrepostas em colunas lado a lado, como no Google Calendar.
 * `duracaoMinima` (em minutos) reflete a altura mínima do card, para que cards
 * curtos que se encostariam visualmente também sejam postos lado a lado.
 * Devolve [{ atividade, coluna, colunas }].
 */
export function layoutDoDia(atividades, duracaoMinima = 0) {
  const ordenadas = [...atividades].sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
  const resultado = [];
  let grupo = [];
  let fimDasColunas = [];
  let fimDoGrupo = -Infinity;

  const fecharGrupo = () => {
    for (const item of grupo) item.colunas = fimDasColunas.length;
    resultado.push(...grupo);
    grupo = [];
    fimDasColunas = [];
  };

  for (const atividade of ordenadas) {
    const fimVisual = Math.max(atividade.fim, atividade.inicio + duracaoMinima);
    if (atividade.inicio >= fimDoGrupo) fecharGrupo();

    let coluna = fimDasColunas.findIndex((fim) => fim <= atividade.inicio);
    if (coluna === -1) coluna = fimDasColunas.length;
    fimDasColunas[coluna] = fimVisual;

    grupo.push({ atividade, coluna, colunas: 0 });
    fimDoGrupo = grupo.length === 1 ? fimVisual : Math.max(fimDoGrupo, fimVisual);
  }
  fecharGrupo();
  return resultado;
}
