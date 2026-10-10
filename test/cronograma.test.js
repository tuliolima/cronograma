import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  interpretarCronograma,
  ErroCronograma,
  agoraNoFuso,
  inicioDoDia,
  formatarHorario,
  estadoDaAtividade,
  faixaDoDia,
  posicaoDoAgora,
  diaInicial,
  layoutDoDia,
} from '../lib/cronograma.js';

const YAML_VALIDO = `
nome: Formação de Líderes
fuso: America/Sao_Paulo
dias:
  2026-11-21:
    - nome: Encerramento
      inicio: "17:00"
      fim: "18:00"
  2026-11-20:
    - nome: Festa
      inicio: "22:00"
      fim: "01:00"
    - nome: Abertura
      inicio: "09:00"
      fim: "10:00"
      local: Auditório
      palestrante: Maria Souza
      responsavel: João Lima
      descricao: |
        Boas-vindas.
        Mais em https://exemplo.com
`;

function erros(texto) {
  try {
    interpretarCronograma(texto);
  } catch (e) {
    assert.ok(e instanceof ErroCronograma, `esperava ErroCronograma, veio ${e}`);
    return e.erros;
  }
  assert.fail('esperava erro');
}

function cronogramaCom(atividadesYaml) {
  return `nome: X\nfuso: America/Sao_Paulo\ndias:\n  2026-11-20:\n${atividadesYaml}`;
}

/** Minutos de relógio para "AAAA-MM-DD HH:MM". */
function em(data, horario) {
  const [h, m] = horario.split(':').map(Number);
  return inicioDoDia(data) + h * 60 + m;
}

describe('interpretarCronograma', () => {
  test('lê Evento, Dias ordenados e Atividades ordenadas', () => {
    const c = interpretarCronograma(YAML_VALIDO);
    assert.equal(c.nome, 'Formação de Líderes');
    assert.equal(c.fuso, 'America/Sao_Paulo');
    assert.deepEqual(c.dias.map((d) => d.data), ['2026-11-20', '2026-11-21']);
    assert.deepEqual(c.dias[0].atividades.map((a) => a.nome), ['Abertura', 'Festa']);

    const abertura = c.dias[0].atividades[0];
    assert.equal(abertura.inicio, 9 * 60);
    assert.equal(abertura.fim, 10 * 60);
    assert.equal(abertura.local, 'Auditório');
    assert.equal(abertura.palestrante, 'Maria Souza');
    assert.equal(abertura.responsavel, 'João Lima');
    assert.equal(c.dias[0].atividades[1].palestrante, '');
    assert.equal(abertura.descricao, 'Boas-vindas.\nMais em https://exemplo.com');
  });

  test('fim antes do início termina no dia seguinte', () => {
    const festa = interpretarCronograma(YAML_VALIDO).dias[0].atividades[1];
    assert.equal(festa.inicio, 22 * 60);
    assert.equal(festa.fim, 25 * 60);
  });

  test('aceita horários sem aspas e com uma casa na hora', () => {
    const c = interpretarCronograma(cronogramaCom('    - nome: A\n      inicio: 9:00\n      fim: 09:30\n'));
    assert.equal(c.dias[0].atividades[0].inicio, 9 * 60);
    assert.equal(c.dias[0].atividades[0].fim, 9 * 60 + 30);
  });

  test('Dia sem atividades é aceito', () => {
    const c = interpretarCronograma('nome: X\nfuso: America/Sao_Paulo\ndias:\n  2026-11-20:\n');
    assert.deepEqual(c.dias[0].atividades, []);
  });

  test('erro de sintaxe informa a linha', () => {
    const [msg] = erros('nome: X\ndias:\n  - a\n b: [');
    assert.match(msg, /Erro de sintaxe no YAML \(linha \d+\)/);
  });

  test('fim igual ao início é erro', () => {
    const [msg] = erros(cronogramaCom('    - nome: Abertura\n      inicio: "09:00"\n      fim: "09:00"\n'));
    assert.match(msg, /atividade 1 \("Abertura"\): termina no mesmo horário/);
  });

  test('horário inválido é erro', () => {
    const [msg] = erros(cronogramaCom('    - nome: A\n      inicio: "25:00"\n      fim: "10:00"\n'));
    assert.match(msg, /"inicio" deve ser um horário/);
  });

  test('campo desconhecido é erro (pega erros de digitação)', () => {
    const [msg] = erros(cronogramaCom('    - nome: A\n      incio: "09:00"\n      inicio: "09:00"\n      fim: "10:00"\n'));
    assert.match(msg, /campo desconhecido "incio"/);
  });

  test('campos obrigatórios ausentes', () => {
    const lista = erros(cronogramaCom('    - local: Sala\n'));
    assert.equal(lista.length, 3);
  });

  test('fuso e data inválidos', () => {
    const lista = erros('nome: X\nfuso: Marte/Olympus\ndias:\n  2026-02-30:\n');
    assert.ok(lista.some((m) => m.includes('Fuso "Marte/Olympus"')));
    assert.ok(lista.some((m) => m.includes('Dia "2026-02-30" inválido')));
  });

  test('junta todos os erros', () => {
    const lista = erros(
      cronogramaCom('    - nome: A\n      inicio: "09:00"\n      fim: "09:00"\n    - nome: B\n      inicio: "x"\n      fim: "10:00"\n'),
    );
    assert.equal(lista.length, 2);
  });
});

describe('tempo', () => {
  test('agoraNoFuso usa o Fuso do Evento, não o do aparelho', () => {
    const instante = new Date('2026-11-20T12:00:00Z');
    assert.equal(agoraNoFuso(instante, 'America/Sao_Paulo'), em('2026-11-20', '09:00'));
    assert.equal(agoraNoFuso(instante, 'Asia/Tokyo'), em('2026-11-20', '21:00'));
  });

  test('formatarHorario volta a 00:00 depois da meia-noite', () => {
    assert.equal(formatarHorario(9 * 60 + 5), '09:05');
    assert.equal(formatarHorario(25 * 60), '01:00');
  });
});

describe('estadoDaAtividade', () => {
  const dia = { data: '2026-11-20', atividades: [] };
  const atividade = { inicio: 9 * 60, fim: 10 * 60 };

  test('futura, em andamento e encerrada', () => {
    assert.equal(estadoDaAtividade(atividade, dia, em('2026-11-20', '08:59')), 'futura');
    assert.equal(estadoDaAtividade(atividade, dia, em('2026-11-20', '09:00')), 'em-andamento');
    assert.equal(estadoDaAtividade(atividade, dia, em('2026-11-20', '09:59')), 'em-andamento');
    assert.equal(estadoDaAtividade(atividade, dia, em('2026-11-20', '10:00')), 'encerrada');
  });

  test('Atividade que passa da meia-noite segue em andamento no dia seguinte', () => {
    const festa = { inicio: 22 * 60, fim: 25 * 60 };
    assert.equal(estadoDaAtividade(festa, dia, em('2026-11-21', '00:30')), 'em-andamento');
    assert.equal(estadoDaAtividade(festa, dia, em('2026-11-21', '01:00')), 'encerrada');
  });
});

describe('faixaDoDia e posicaoDoAgora', () => {
  const dia = {
    data: '2026-11-20',
    atividades: [
      { inicio: 9 * 60 + 15, fim: 10 * 60 },
      { inicio: 14 * 60, fim: 17 * 60 + 40 },
    ],
  };

  test('arredonda para a hora cheia com 30 min de margem', () => {
    assert.deepEqual(faixaDoDia(dia), { inicio: 8 * 60, fim: 19 * 60 });
  });

  test('não começa antes da meia-noite', () => {
    assert.equal(faixaDoDia({ data: '2026-11-20', atividades: [{ inicio: 10, fim: 60 }] }).inicio, 0);
  });

  test('Linha do agora só aparece dentro da faixa', () => {
    assert.equal(posicaoDoAgora(dia, em('2026-11-20', '12:00')), 12 * 60);
    assert.equal(posicaoDoAgora(dia, em('2026-11-20', '07:59')), null);
    assert.equal(posicaoDoAgora(dia, em('2026-11-20', '19:01')), null);
  });
});

describe('diaInicial', () => {
  const d1 = { data: '2026-11-20', atividades: [{ inicio: 22 * 60, fim: 25 * 60 }] };
  const d2 = { data: '2026-11-21', atividades: [{ inicio: 9 * 60, fim: 10 * 60 }] };
  const d3 = { data: '2026-11-23', atividades: [{ inicio: 9 * 60, fim: 10 * 60 }] };
  const dias = [d1, d2, d3];

  test('antes do Evento abre no primeiro Dia', () => {
    assert.equal(diaInicial(dias, em('2026-11-01', '12:00')), d1);
  });

  test('depois do Evento abre no último Dia', () => {
    assert.equal(diaInicial(dias, em('2026-12-01', '12:00')), d3);
  });

  test('madrugada de Atividade que passou da meia-noite fica no Dia em que ela começou', () => {
    assert.equal(diaInicial(dias, em('2026-11-21', '00:30')), d1);
  });

  test('num Dia do Evento fora da faixa, abre no próprio Dia', () => {
    assert.equal(diaInicial(dias, em('2026-11-21', '06:00')), d2);
    assert.equal(diaInicial(dias, em('2026-11-21', '23:00')), d2);
  });

  test('num dia entre Dias do Evento, abre no próximo Dia', () => {
    assert.equal(diaInicial(dias, em('2026-11-22', '12:00')), d3);
  });
});

describe('layoutDoDia', () => {
  const a = (nome, inicio, fim) => ({ nome, inicio, fim });
  const resumo = (layout) =>
    Object.fromEntries(layout.map((l) => [l.atividade.nome, `${l.coluna}/${l.colunas}`]));

  test('Atividades sem sobreposição ocupam a largura toda', () => {
    const layout = layoutDoDia([a('A', 540, 600), a('B', 600, 660)]);
    assert.deepEqual(resumo(layout), { A: '0/1', B: '0/1' });
  });

  test('Atividades sobrepostas ficam lado a lado', () => {
    const layout = layoutDoDia([a('A', 540, 660), a('B', 570, 600), a('C', 600, 630), a('D', 700, 760)]);
    assert.deepEqual(resumo(layout), { A: '0/2', B: '1/2', C: '1/2', D: '0/1' });
  });

  test('grupo encadeado compartilha o mesmo número de colunas', () => {
    const layout = layoutDoDia([a('A', 540, 600), a('B', 570, 660), a('C', 630, 700)]);
    assert.deepEqual(resumo(layout), { A: '0/2', B: '1/2', C: '0/2' });
  });

  test('duração mínima separa cards curtos que se encostariam', () => {
    const layout = layoutDoDia([a('A', 540, 545), a('B', 550, 600)], 20);
    assert.deepEqual(resumo(layout), { A: '0/2', B: '1/2' });
  });
});
