/**
 * Integracao com modelos de linguagem (RP03 pede este modulo separado).
 *
 * Na Sprint 1 nada passa por LLM. Este arquivo existe para fixar o contrato e o
 * limite de responsabilidade antes da Sprint 2:
 *
 * - RP05 proibe APIs externas de LLM. Qualquer implementacao futura tem que ser
 *   um modelo local.
 * - O Plano da Sprint 1 (secao 12) e explicito: a LLM NAO decide o que o
 *   consumidor tem direito. Quem decide e o fluxo do PROCON. A LLM so pode
 *   reescrever um texto que ja foi definido pelo fluxo.
 * - RNF05 exige marcar o que foi gerado com apoio de LLM. Por isso o retorno
 *   carrega `geradoPorLlm`, e nao apenas a string.
 */

export interface TextoExplicativo {
  texto: string;
  /** RNF05: o frontend usa isto para exibir o aviso de uso de LLM. */
  geradoPorLlm: boolean;
}

export interface ProvedorLlm {
  /**
   * Reformula uma orientacao ja decidida pelo fluxo, sem alterar o desfecho.
   * @param textoOriginal texto vindo do JSON do PROCON, unica fonte de verdade.
   */
  explicar(textoOriginal: string): Promise<TextoExplicativo>;
}

/**
 * Implementacao usada na Sprint 1: devolve o texto do PROCON intacto.
 * Mantem o motor escrito contra a interface desde ja, sem violar o RP05.
 */
export class ProvedorLlmDesativado implements ProvedorLlm {
  async explicar(textoOriginal: string): Promise<TextoExplicativo> {
    return { texto: textoOriginal, geradoPorLlm: false };
  }
}
