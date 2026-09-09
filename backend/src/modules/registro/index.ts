/**
 * Registro das interacoes (RF06).
 *
 * "O sistema deve registrar as interacoes realizadas, permitindo a analise
 * posterior dos fluxos mais utilizados."
 *
 * Na Sprint 1 os eventos ficam em memoria e podem ser espelhados em um arquivo
 * JSONL, o que ja da evidencia concreta para a Review. Quando a frente de banco
 * entrar, basta uma implementacao de `RepositorioInteracoes` que escreva na
 * tabela correspondente.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type TipoEvento =
  | 'conversa_iniciada'
  | 'fluxo_escolhido'
  | 'opcao_escolhida'
  | 'orientacao_entregue'
  | 'entrada_invalida'
  | 'comando_global'
  | 'conversa_encerrada';

export interface Interacao {
  id: string;
  sessaoId: string;
  usuario: string;
  evento: TipoEvento;
  fluxoId?: string;
  noId?: string;
  opcaoId?: string;
  encaminhamento?: string;
  detalhe?: string;
  em: string;
}

export interface RepositorioInteracoes {
  registrar(interacao: Omit<Interacao, 'id' | 'em'>): Promise<void>;
  listar(): Promise<Interacao[]>;
}

export class RepositorioInteracoesMemoria implements RepositorioInteracoes {
  private readonly interacoes: Interacao[] = [];

  /** @param arquivoJsonl caminho opcional para espelhar os eventos em disco. */
  constructor(private readonly arquivoJsonl?: string) {
    if (arquivoJsonl) mkdirSync(dirname(arquivoJsonl), { recursive: true });
  }

  async registrar(dados: Omit<Interacao, 'id' | 'em'>): Promise<void> {
    const interacao: Interacao = { ...dados, id: crypto.randomUUID(), em: new Date().toISOString() };
    this.interacoes.push(interacao);
    if (this.arquivoJsonl) {
      // Falha de escrita nao pode derrubar a conversa do cidadao.
      try {
        appendFileSync(this.arquivoJsonl, `${JSON.stringify(interacao)}\n`, 'utf-8');
      } catch (erro) {
        console.error('[registro] nao foi possivel gravar o evento em disco:', erro);
      }
    }
  }

  async listar(): Promise<Interacao[]> {
    return [...this.interacoes];
  }
}

export interface EstatisticaFluxo {
  fluxoId: string;
  vezesEscolhido: number;
  orientacoesEntregues: number;
}

export interface Estatisticas {
  conversasIniciadas: number;
  orientacoesEntregues: number;
  entradasInvalidas: number;
  fluxosMaisUtilizados: EstatisticaFluxo[];
}

/** Agregacao que responde diretamente ao RF06: quais fluxos sao mais usados. */
export function calcularEstatisticas(interacoes: Interacao[]): Estatisticas {
  const porFluxo = new Map<string, EstatisticaFluxo>();
  let conversasIniciadas = 0;
  let orientacoesEntregues = 0;
  let entradasInvalidas = 0;

  const acumular = (fluxoId: string): EstatisticaFluxo => {
    let atual = porFluxo.get(fluxoId);
    if (!atual) {
      atual = { fluxoId, vezesEscolhido: 0, orientacoesEntregues: 0 };
      porFluxo.set(fluxoId, atual);
    }
    return atual;
  };

  for (const interacao of interacoes) {
    switch (interacao.evento) {
      case 'conversa_iniciada':
        conversasIniciadas += 1;
        break;
      case 'fluxo_escolhido':
        if (interacao.fluxoId) acumular(interacao.fluxoId).vezesEscolhido += 1;
        break;
      case 'orientacao_entregue':
        orientacoesEntregues += 1;
        if (interacao.fluxoId) acumular(interacao.fluxoId).orientacoesEntregues += 1;
        break;
      case 'entrada_invalida':
        entradasInvalidas += 1;
        break;
      default:
        break;
    }
  }

  return {
    conversasIniciadas,
    orientacoesEntregues,
    entradasInvalidas,
    fluxosMaisUtilizados: [...porFluxo.values()].sort((a, b) => b.vezesEscolhido - a.vezesEscolhido),
  };
}
