/**
 * Estado da conversa (RP01: "identificacao do usuario e controle de sessoes").
 *
 * O estado guardado e deliberadamente minimo: id do fluxo, no atual e o caminho
 * percorrido. Nada de variaveis ou logica condicional - a decisao mora nos JSON
 * dos fluxos, nao aqui.
 */
import type { ChaveEncaminhamento } from '../fluxos/tipos.js';

export type EtapaSessao = 'menu' | 'em_fluxo' | 'finalizada';

export type AutorMensagem = 'bot' | 'cidadao';

export type TipoMensagem =
  | 'texto'
  | 'menu'
  | 'pergunta'
  | 'orientacao'
  | 'encaminhamento'
  | 'aviso';

export interface OpcaoApresentada {
  id: string;
  rotulo: string;
  descricao?: string;
}

export interface Mensagem {
  id: string;
  sessaoId: string;
  autor: AutorMensagem;
  tipo: TipoMensagem;
  texto: string;
  opcoes?: OpcaoApresentada[];
  documentos?: string[];
  ressalvas?: string[];
  encaminhamento?: ChaveEncaminhamento;
  /** RNF05. Na Sprint 1 e sempre false: nenhum texto passa por LLM. */
  geradoPorLlm: boolean;
  /** Rastreabilidade para o registro de interacoes (RF06). */
  fluxoId?: string;
  noId?: string;
  criadaEm: string;
}

/** Um passo do cidadao dentro de um fluxo. Sustenta o comando "voltar" e o RF06. */
export interface PassoHistorico {
  fluxoId: string;
  /** No em que a pergunta foi feita (nao o no de destino). */
  noId: string;
  opcaoId: string;
  rotulo: string;
  em: string;
}

export interface Sessao {
  id: string;
  /** Identificacao do usuario. No simulador, o telefone digitado na tela de entrada. */
  usuario: string;
  etapa: EtapaSessao;
  fluxoId?: string;
  noAtual?: string;
  historico: PassoHistorico[];
  mensagens: Mensagem[];
  criadaEm: string;
  atualizadaEm: string;
}

/**
 * Contrato de persistencia das sessoes.
 *
 * A Sprint 1 roda com a implementacao em memoria. A frente de banco de dados
 * (Pessoa 4) troca isto por uma implementacao SQL sem tocar no motor: basta
 * mapear `Sessao` para a tabela `conversations` e `Mensagem` para `messages`.
 */
export interface RepositorioSessoes {
  criar(usuario: string): Promise<Sessao>;
  buscar(id: string): Promise<Sessao | undefined>;
  salvar(sessao: Sessao): Promise<void>;
  listar(): Promise<Sessao[]>;
}

export class RepositorioSessoesMemoria implements RepositorioSessoes {
  private readonly sessoes = new Map<string, Sessao>();

  async criar(usuario: string): Promise<Sessao> {
    const agora = new Date().toISOString();
    const sessao: Sessao = {
      id: crypto.randomUUID(),
      usuario,
      etapa: 'menu',
      historico: [],
      mensagens: [],
      criadaEm: agora,
      atualizadaEm: agora,
    };
    this.sessoes.set(sessao.id, sessao);
    return sessao;
  }

  async buscar(id: string): Promise<Sessao | undefined> {
    return this.sessoes.get(id);
  }

  async salvar(sessao: Sessao): Promise<void> {
    sessao.atualizadaEm = new Date().toISOString();
    this.sessoes.set(sessao.id, sessao);
  }

  async listar(): Promise<Sessao[]> {
    return [...this.sessoes.values()];
  }
}
