/**
 * Espelho do contrato HTTP do backend (`backend/src/http/dto.ts`).
 *
 * Mantido a mao de proposito: e um arquivo pequeno e explicito, que serve de
 * documentacao do contrato para quem estiver trabalhando so no frontend.
 */

export type AutorMensagem = 'bot' | 'cidadao';

export type TipoMensagem =
  | 'texto'
  | 'menu'
  | 'pergunta'
  | 'orientacao'
  | 'encaminhamento'
  | 'aviso';

export interface Opcao {
  id: string;
  rotulo: string;
  descricao?: string;
}

export interface Mensagem {
  id: string;
  autor: AutorMensagem;
  tipo: TipoMensagem;
  texto: string;
  opcoes?: Opcao[];
  documentos?: string[];
  ressalvas?: string[];
  encaminhamento?: { chave: string; rotulo: string };
  /** RNF05: quando true, a interface exibe o selo de conteudo gerado por LLM. */
  geradoPorLlm: boolean;
  criadaEm: string;
}

export type EtapaSessao = 'menu' | 'em_fluxo' | 'finalizada';

export interface EstadoSessao {
  sessaoId: string;
  usuario: string;
  etapa: EtapaSessao;
  fluxoId?: string;
  tituloFluxo?: string;
  noAtual?: string;
  podeVoltar: boolean;
  passos: string[];
}

export interface Turno {
  sessao: EstadoSessao;
  mensagens: Mensagem[];
}
