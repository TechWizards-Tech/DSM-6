import { describe, expect, it } from 'vitest';

import {
  hojeSaoPaulo,
  interpretarData,
  proximoDiaUtilBr,
} from '../src/modules/agendamento/datas.js';

// 2026-11-22 e domingo.
const HOJE = '2026-11-22';
const ok = (iso: string) => ({ tipo: 'ok', iso });

describe('hojeSaoPaulo', () => {
  it('usa a data de Sao Paulo, nao a do UTC (21h-24h BRT)', () => {
    // 23:30 em Sao Paulo = 02:30 UTC do dia seguinte
    expect(hojeSaoPaulo(new Date('2026-11-23T02:30:00Z'))).toBe('2026-11-22');
    expect(hojeSaoPaulo(new Date('2026-11-23T03:00:00Z'))).toBe('2026-11-23');
  });
});

describe('interpretarData', () => {
  it.each([
    ['amanhã', '2026-11-23'],
    ['Amanha!', '2026-11-23'],
    ['pode ser amanhã de manhã?', '2026-11-23'],
    ['depois de amanhã', '2026-11-24'],
    ['hoje', '2026-11-22'],
    ['daqui a 3 dias', '2026-11-25'],
    ['em 10 dias', '2026-12-02'],
    ['segunda', '2026-11-23'],
    ['terça-feira', '2026-11-24'],
    ['quarta que vem', '2026-11-25'],
    ['domingo', '2026-11-29'],
    ['semana que vem', '2026-11-23'],
    ['dia 25', '2026-11-25'],
    ['25', '2026-11-25'],
    ['dia 10', '2026-12-10'],
    ['25 de novembro', '2026-11-25'],
    ['5 de janeiro', '2027-01-05'],
    ['25 de novembro de 2026', '2026-11-25'],
    ['25/11', '2026-11-25'],
    ['05/01', '2027-01-05'],
    ['25/11/2026', '2026-11-25'],
    ['25-11-26', '2026-11-25'],
    ['2026-11-25', '2026-11-25'],
  ])('"%s" -> %s', (texto, esperado) => {
    expect(interpretarData(texto, HOJE)).toEqual(ok(esperado));
  });

  it('reconhece datas passadas', () => {
    expect(interpretarData('10/11/2026', HOJE)).toEqual({ tipo: 'passado', iso: '2026-11-10' });
  });

  it('rejeita datas inexistentes', () => {
    expect(interpretarData('31/02/2027', HOJE)).toEqual({ tipo: 'invalida' });
    expect(interpretarData('32/01', HOJE)).toEqual({ tipo: 'invalida' });
    expect(interpretarData('dia 31 de abril', HOJE)).toEqual({ tipo: 'invalida' });
  });

  it('29/02 vai para o proximo ano bissexto', () => {
    expect(interpretarData('29/02', HOJE)).toEqual(ok('2028-02-29'));
  });

  it('devolve desconhecida para texto sem data', () => {
    expect(interpretarData('quero falar com atendente', HOJE)).toEqual({ tipo: 'desconhecida' });
    expect(interpretarData('', HOJE)).toEqual({ tipo: 'desconhecida' });
  });
});

describe('proximoDiaUtilBr', () => {
  it('pula o fim de semana', () => {
    expect(proximoDiaUtilBr('2026-11-20')).toBe('23/11/2026'); // sexta -> segunda
    expect(proximoDiaUtilBr('2026-11-22')).toBe('23/11/2026');
  });
});
