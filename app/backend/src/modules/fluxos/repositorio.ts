/**
 * Gestao dos fluxos decisorios (RP03).
 *
 * Carrega o menu e os fluxos do diretorio `fluxos/` do repositorio, valida a
 * integridade do grafo e expoe consultas. O motor de conversa nunca le arquivo:
 * fala so com este modulo.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CatalogoFluxos, Fluxo, ItemMenu, Menu, No } from './tipos.js';

/** Arquivos do diretorio `fluxos/` que nao sao um fluxo. */
const NAO_SAO_FLUXOS = new Set(['menu.json', 'fluxo.schema.json']);

export class ErroCarregamentoFluxos extends Error {
  constructor(public readonly problemas: string[]) {
    super(`Fluxos invalidos:\n- ${problemas.join('\n- ')}`);
    this.name = 'ErroCarregamentoFluxos';
  }
}

function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(caminho, 'utf-8')) as T;
}

/**
 * Verifica o que o JSON Schema sozinho nao alcanca: integridade do grafo.
 * Roda no boot, para o servidor nao subir com um fluxo que trava a conversa.
 * Espelha as checagens de `fluxos/validar_fluxos.py`.
 */
function validarFluxo(fluxo: Fluxo, arquivo: string): string[] {
  const problemas: string[] = [];
  const p = (msg: string) => problemas.push(`${arquivo}: ${msg}`);

  if (fluxo.id !== arquivo.replace(/\.json$/, '')) {
    p(`o campo "id" ("${fluxo.id}") nao bate com o nome do arquivo`);
  }
  if (!fluxo.nos[fluxo.no_inicial]) {
    p(`no_inicial "${fluxo.no_inicial}" nao existe em "nos"`);
  }

  const ids = Object.keys(fluxo.nos);
  let temOrientacao = false;

  for (const [noId, no] of Object.entries(fluxo.nos)) {
    if (no.tipo === 'pergunta') {
      if (!no.opcoes?.length) {
        p(`no "${noId}" e do tipo pergunta mas nao tem opcoes`);
        continue;
      }
      if (no.opcoes.length > 3) {
        p(`no "${noId}" tem ${no.opcoes.length} opcoes (o WhatsApp permite no maximo 3)`);
      }
      for (const opcao of no.opcoes) {
        if (!fluxo.nos[opcao.proximo]) {
          p(`opcao "${opcao.id}" do no "${noId}" aponta para "${opcao.proximo}", que nao existe`);
        }
        if (opcao.rotulo.length > 20) {
          p(`rotulo "${opcao.rotulo}" tem ${opcao.rotulo.length} caracteres (o limite do WhatsApp e 20)`);
        }
      }
    } else {
      temOrientacao = true;
      if (!no.encaminhamento) {
        p(`no de orientacao "${noId}" nao tem encaminhamento`);
      }
    }
  }

  if (!temOrientacao) {
    p('o fluxo nao tem nenhum no de orientacao, entao a conversa nunca termina');
  }

  // Nos inalcancaveis a partir do no inicial sao conteudo morto: alguem escreveu
  // uma orientacao que o cidadao nunca vai ver.
  const alcancaveis = new Set<string>();
  const fila = [fluxo.no_inicial];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    if (alcancaveis.has(atual)) continue;
    const no: No | undefined = fluxo.nos[atual];
    if (!no) continue;
    alcancaveis.add(atual);
    if (no.tipo === 'pergunta') {
      for (const opcao of no.opcoes) fila.push(opcao.proximo);
    }
  }
  for (const noId of ids) {
    if (!alcancaveis.has(noId)) p(`no "${noId}" e inalcancavel a partir de "${fluxo.no_inicial}"`);
  }

  return problemas;
}

/** Le `fluxos/` do disco, valida tudo e devolve o catalogo em memoria. */
export function carregarCatalogo(diretorio: string): CatalogoFluxos {
  const menu = lerJson<Menu>(join(diretorio, 'menu.json'));
  const fluxos = new Map<string, Fluxo>();
  const problemas: string[] = [];

  const arquivos = readdirSync(diretorio).filter(
    (nome) => nome.endsWith('.json') && !NAO_SAO_FLUXOS.has(nome),
  );

  for (const arquivo of arquivos) {
    const fluxo = lerJson<Fluxo>(join(diretorio, arquivo));
    problemas.push(...validarFluxo(fluxo, arquivo));
    if (fluxos.has(fluxo.id)) problemas.push(`id de fluxo duplicado: "${fluxo.id}"`);
    fluxos.set(fluxo.id, fluxo);
  }

  // O menu e a porta de entrada: um item apontando para um fluxo inexistente
  // deixa o cidadao clicando em uma opcao que nao leva a lugar nenhum.
  for (const item of menu.itens) {
    if (!fluxos.has(item.fluxo)) {
      problemas.push(`menu.json: item "${item.rotulo}" aponta para o fluxo "${item.fluxo}", que nao existe`);
    }
  }
  for (const id of fluxos.keys()) {
    if (!menu.itens.some((item) => item.fluxo === id)) {
      problemas.push(`fluxo "${id}" existe mas nao esta no menu.json`);
    }
  }

  if (problemas.length > 0) throw new ErroCarregamentoFluxos(problemas);

  return { menu, fluxos };
}

/** Normaliza texto livre para comparacao: minusculas, sem acento e sem pontuacao. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export class RepositorioFluxos {
  constructor(private readonly catalogo: CatalogoFluxos) {}

  get menu(): Menu {
    return this.catalogo.menu;
  }

  get itensMenu(): ItemMenu[] {
    return this.catalogo.menu.itens;
  }

  buscarFluxo(id: string): Fluxo | undefined {
    return this.catalogo.fluxos.get(id);
  }

  listarFluxos(): Fluxo[] {
    return [...this.catalogo.fluxos.values()];
  }

  buscarNo(fluxoId: string, noId: string): No | undefined {
    return this.catalogo.fluxos.get(fluxoId)?.nos[noId];
  }

  /**
   * Roteamento por texto livre usando `palavras_chave` (previsto no schema como
   * opcional na Sprint 1). Devolve o fluxo com mais termos em comum, ou undefined
   * quando nada casa - caso em que o motor reapresenta o menu.
   */
  rotearPorTexto(texto: string): Fluxo | undefined {
    const entrada = normalizar(texto);
    if (entrada.length < 3) return undefined;

    let melhor: { fluxo: Fluxo; pontos: number } | undefined;
    for (const fluxo of this.catalogo.fluxos.values()) {
      const termos = fluxo.palavras_chave ?? [];
      let pontos = 0;
      for (const termo of termos) {
        const alvo = normalizar(termo);
        if (alvo.length >= 3 && entrada.includes(alvo)) pontos += 1;
      }
      if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { fluxo, pontos };
    }
    return melhor?.fluxo;
  }
}
