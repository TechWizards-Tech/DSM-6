/**
 * Tipos dos fluxos decisorios do PROCON.
 *
 * Espelham o contrato de `fluxos/fluxo.schema.json` e `fluxos/menu.json`, que sao
 * a entrega da frente "Fluxos do PROCON" (Pessoa 3). Nenhum texto de orientacao ao
 * cidadao mora no codigo: tudo vem dos JSON.
 */

export type TipoNo = 'pergunta' | 'orientacao';

/** Define o que o motor faz depois de entregar uma orientacao final. */
export type ChaveEncaminhamento =
  | 'agendamento_presencial'
  | 'procon_online'
  | 'informativo'
  | 'fora_de_competencia';

export interface Opcao {
  id: string;
  /** Rotulo do botao. Max. 20 caracteres (limite de reply button do WhatsApp). */
  rotulo: string;
  /** Chave do no de destino dentro do mesmo fluxo. */
  proximo: string;
}

export interface BaseLegal {
  norma: string;
  dispositivo: string;
  /** Alguns arquivos usam `resumo`, o schema previa `sintese`. Ambos sao aceitos. */
  resumo?: string;
  sintese?: string;
}

/** No que coleta uma escolha do cidadao. */
export interface NoPergunta {
  tipo: 'pergunta';
  texto: string;
  opcoes: Opcao[];
}

/** No terminal: entrega a resposta orientadora (RF04). */
export interface NoOrientacao {
  tipo: 'orientacao';
  texto: string;
  documentos?: string[];
  ressalvas?: string[];
  /** Metadado interno. NAO e enviado ao cidadao (ver `dto.ts`). */
  base_legal?: BaseLegal[];
  encaminhamento: ChaveEncaminhamento;
}

export type No = NoPergunta | NoOrientacao;

export interface Fluxo {
  id: string;
  versao: string;
  titulo: string;
  categoria: string;
  palavras_chave?: string[];
  resumo?: string;
  fonte: string;
  no_inicial: string;
  nos: Record<string, No>;
}

export interface ItemMenu {
  fluxo: string;
  rotulo: string;
  descricao: string;
}

export interface TextosGlobais {
  saudacao: string;
  aviso_orientativo: string;
  aviso_llm: string;
  texto_menu: string;
  opcao_invalida: string;
  encerramento: string;
}

export interface Encaminhamento {
  rotulo: string;
  texto: string;
}

export interface OpcaoOutro {
  rotulo: string;
  descricao: string;
  texto: string;
  encaminhamento: ChaveEncaminhamento;
}

export interface Menu {
  versao: string;
  atualizado_em: string;
  fonte: string;
  textos_globais: TextosGlobais;
  /** Palavras que funcionam em qualquer ponto da conversa. */
  comandos_globais: Record<ComandoGlobal, string[]>;
  encaminhamentos: Record<ChaveEncaminhamento, Encaminhamento>;
  itens: ItemMenu[];
  opcao_outro: OpcaoOutro;
}

export type ComandoGlobal = 'menu' | 'voltar' | 'atendente' | 'encerrar';

/** Catalogo carregado em memoria: o menu mais todos os fluxos, indexados por id. */
export interface CatalogoFluxos {
  menu: Menu;
  fluxos: Map<string, Fluxo>;
}
