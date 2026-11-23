/**
 * Interpretacao deterministica de datas escritas pelo cidadao ("amanha",
 * "segunda", "dia 25", "25 de novembro", "25/11"). Nao usa LLM de proposito:
 * data errada vira atendimento marcado no dia errado, entao a regra tem de ser
 * previsivel e testavel. Tudo e calculado sobre a data de Sao Paulo, nao a do
 * servidor (containers rodam em UTC e viram o dia 3h antes do Brasil).
 */

export type ResultadoData =
  | { tipo: 'ok'; iso: string }
  | { tipo: 'passado'; iso: string }
  | { tipo: 'invalida' }
  | { tipo: 'desconhecida' };

const FUSO = 'America/Sao_Paulo';

/** Data de hoje em Sao Paulo, como AAAA-MM-DD. */
export function hojeSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
const NOMES_DIA_SEMANA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
const MESES = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function paraUtc(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!));
}

function paraIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function somarDias(iso: string, dias: number): string {
  const d = paraUtc(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraIso(d);
}

/** 0 = domingo ... 6 = sabado. */
export function diaDaSemana(iso: string): number {
  return paraUtc(iso).getUTCDay();
}

export function nomeDiaSemana(iso: string): string {
  return NOMES_DIA_SEMANA[diaDaSemana(iso)]!;
}

function dataExiste(ano: number, mes: number, dia: number): boolean {
  if (ano < 1900 || ano > 2200 || mes < 1 || mes > 12 || dia < 1) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function montar(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Proxima ocorrencia (hoje ou depois) de dia/mes; vira o ano se ja passou. */
function proximaOcorrencia(hoje: string, mes: number, dia: number): ResultadoData {
  const anoHoje = Number(hoje.slice(0, 4));
  for (const ano of [anoHoje, anoHoje + 1, anoHoje + 2]) {
    // 29/02 so existe em ano bissexto: segue procurando.
    if (!dataExiste(ano, mes, dia)) continue;
    const iso = montar(ano, mes, dia);
    if (iso >= hoje) return { tipo: 'ok', iso };
  }
  return { tipo: 'invalida' };
}

function limpar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[!?.,;:()"']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classificar(iso: string, hoje: string): ResultadoData {
  return iso < hoje ? { tipo: 'passado', iso } : { tipo: 'ok', iso };
}

export function interpretarData(texto: string, hoje: string = hojeSaoPaulo()): ResultadoData {
  const t = limpar(texto);
  if (!t) return { tipo: 'desconhecida' };

  // AAAA-MM-DD (formato do painel)
  let m = t.match(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/);
  if (m) {
    const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return dataExiste(a, mes, d) ? classificar(montar(a, mes, d), hoje) : { tipo: 'invalida' };
  }

  // DD/MM/AAAA, DD/MM/AA, DD/MM (aceita / - . como separador)
  m = t.match(/\b(\d{1,2})[/\-. ]+(\d{1,2})(?:[/\-. ]+(\d{4}|\d{2}))?\b/);
  if (m && /[/\-.]/.test(m[0])) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    if (m[3] === undefined) {
      return dataExiste(2000, mes, dia) || (mes === 2 && dia === 29)
        ? proximaOcorrencia(hoje, mes, dia)
        : { tipo: 'invalida' };
    }
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return dataExiste(ano, mes, dia) ? classificar(montar(ano, mes, dia), hoje) : { tipo: 'invalida' };
  }

  // "25 de novembro [de 2026]" / "25 novembro"
  const nomesMes = MESES.join('|');
  m = t.match(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${nomesMes})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`));
  if (m) {
    const dia = Number(m[1]);
    const mes = MESES.indexOf(m[2]!) + 1;
    if (m[3]) {
      const ano = Number(m[3]);
      return dataExiste(ano, mes, dia) ? classificar(montar(ano, mes, dia), hoje) : { tipo: 'invalida' };
    }
    return dataExiste(2000, mes, dia) || (mes === 2 && dia === 29)
      ? proximaOcorrencia(hoje, mes, dia)
      : { tipo: 'invalida' };
  }

  if (/\bdepois de amanha\b/.test(t)) return { tipo: 'ok', iso: somarDias(hoje, 2) };
  if (/\bamanha\b/.test(t)) return { tipo: 'ok', iso: somarDias(hoje, 1) };
  if (/\bhoje\b/.test(t)) return { tipo: 'ok', iso: hoje };

  m = t.match(/\b(?:daqui a|daqui|em)\s+(\d{1,3})\s+dias?\b/);
  if (m) return { tipo: 'ok', iso: somarDias(hoje, Number(m[1])) };

  // "semana que vem" / "proxima semana" -> segunda-feira da semana seguinte
  if (/\bsemana que vem\b|\bproxima semana\b/.test(t)) {
    const dow = diaDaSemana(hoje);
    return { tipo: 'ok', iso: somarDias(hoje, dow === 0 ? 1 : 8 - dow) };
  }

  // dias da semana: sempre a proxima ocorrencia depois de hoje
  const idxSemana = DIAS_SEMANA.findIndex((nome) => new RegExp(`\\b${nome}\\b`).test(t));
  if (idxSemana >= 0) {
    const falta = (idxSemana - diaDaSemana(hoje) + 7) % 7 || 7;
    return { tipo: 'ok', iso: somarDias(hoje, falta) };
  }

  // "dia 25": neste mes, ou no proximo se ja passou
  m = t.match(/\bdia\s+(\d{1,2})\b/);
  if (m || /^\d{1,2}$/.test(t)) {
    const dia = Number(m ? m[1] : t);
    let [ano, mes] = [Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7))];
    for (let i = 0; i < 14; i++) {
      if (dataExiste(ano, mes, dia) && montar(ano, mes, dia) >= hoje) {
        return { tipo: 'ok', iso: montar(ano, mes, dia) };
      }
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
    }
    return { tipo: 'invalida' };
  }

  return { tipo: 'desconhecida' };
}

/** Proximo dia util depois de `hoje`, no formato DD/MM/AAAA. */
export function proximoDiaUtilBr(hoje: string = hojeSaoPaulo()): string {
  let iso = somarDias(hoje, 1);
  while (diaDaSemana(iso) === 0 || diaDaSemana(iso) === 6) iso = somarDias(iso, 1);
  const [a, mes, d] = iso.split('-');
  return `${d}/${mes}/${a}`;
}

/** Segunda-feira seguinte a uma data de fim de semana (ou a propria data util). */
export function proximoDiaUtilIso(iso: string): string {
  let r = iso;
  while (diaDaSemana(r) === 0 || diaDaSemana(r) === 6) r = somarDias(r, 1);
  return r;
}
