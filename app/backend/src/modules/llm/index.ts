/**
 * Integracao com modelos de linguagem locais (RP03, RF05, RNF05, RP05).
 *
 * Diretrizes arquiteturais deste modulo:
 * - RP05 proibe APIs externas de LLM (como OpenAI/Anthropic), mesmo gratuitas,
 *   por restricao de custos e protecao de dados (LGPD). Utiliza-se Ollama local.
 * - A LLM NAO decide o direito do consumidor. Quem decide o desfecho e o fluxo
 *   JSON do PROCON. A LLM atua exclusivamente em tres pontos de apoio:
 *   1. `explicar()`: Reescrever/detalhar de forma clara e acolhedora a orientacao
 *      final ja decidida pelo fluxo do PROCON (RF05 / US03).
 *   2. `identificarFluxo()`: Quando o cidadao digita livremente seu relato no menu,
 *      ajudar a classificar qual dos 9 fluxos oficiais do PROCON corresponde ao caso.
 *   3. `identificarOpcao()`: Quando o cidadao responde uma pergunta do fluxo com texto
 *      livre, identificar qual das opcoes da pergunta corresponde a resposta.
 * - RNF05 exige identificar claramente quando houve auxilio de LLM (`geradoPorLlm: true`).
 * - Resiliencia (RNF02): Se o servidor Ollama local estiver desligado ou demorar,
 *   o provedor faz fallback imediato para o texto original do PROCON sem derrubar a conversa.
 */

import type { ItemMenu } from '../fluxos/tipos.js';

export interface TextoExplicativo {
  texto: string;
  /** RNF05: o frontend e o WhatsApp usam isto para exibir o selo/aviso de uso de LLM. */
  geradoPorLlm: boolean;
}

export interface ProvedorLlm {
  /**
   * Reformula/detalha uma orientacao ja decidida pelo fluxo, sem alterar o desfecho.
   * @param textoOriginal texto vindo do JSON do PROCON, unica fonte de verdade.
   */
  explicar(textoOriginal: string): Promise<TextoExplicativo>;

  /**
   * Identifica qual fluxo do menu melhor atende ao relato livre digitado pelo cidadao.
   * Devolve o `id` de um fluxo existente no catalogo ou `undefined` se nenhum se encaixar.
   */
  identificarFluxo?(relatoCidadao: string, itensMenu: ItemMenu[]): Promise<string | undefined>;

  /**
   * Identifica qual opcao de uma pergunta do fluxo corresponde a resposta em texto livre do cidadao.
   */
  identificarOpcao?(
    pergunta: string,
    respostaCidadao: string,
    opcoes: { id: string; rotulo: string }[],
  ): Promise<string | undefined>;
}

/**
 * Implementacao padrao quando nenhum LLM local esta configurado:
 * devolve o texto do PROCON intacto (`geradoPorLlm: false`).
 */
export class ProvedorLlmDesativado implements ProvedorLlm {
  async explicar(textoOriginal: string): Promise<TextoExplicativo> {
    return { texto: textoOriginal, geradoPorLlm: false };
  }

  async identificarFluxo(): Promise<string | undefined> {
    return undefined;
  }

  async identificarOpcao(): Promise<string | undefined> {
    return undefined;
  }
}

export interface OpcoesOllama {
  /** URL base do servidor Ollama local (padrao: http://localhost:11434) */
  urlBase?: string;
  /** Nome do modelo local instalado no Ollama (padrao: llama3.2:3b) */
  modelo?: string;
  /** Tempo limite em milissegundos para nao travar o atendimento em tempo real (RNF02) */
  timeoutMs?: number;
  /** Injecao de fetch para testes automatizados */
  fetchFn?: typeof fetch;
}

export const PROMPT_SISTEMA_EXPLICACAO = [
  'Você é o assistente virtual de orientação ao consumidor do PROCON de Jacareí-SP.',
  'Sua única tarefa é reescrever e explicar a orientação oficial abaixo de forma clara, acolhedora, empática e acessível ao cidadão comum.',
  'REGRAS OBRIGATÓRIAS (RP05 / RNF01):',
  '1. Mantenha 100% das informações, prazos e instruções do texto original.',
  '2. NÃO invente leis, artigos do Código de Defesa do Consumidor, links, telefones ou prazos que não estejam no texto original.',
  '3. NÃO dê parecer jurídico definitivo nem prometa ganho de causa.',
  '4. Responda apenas em português do Brasil, diretamente com o texto explicativo para o consumidor, sem introduções como "Aqui está a reescrita:".',
].join('\n');

/**
 * Provedor de LLM local via Ollama (RF05, RNF05, RP05).
 */
export class ProvedorLlmOllama implements ProvedorLlm {
  private readonly urlBase: string;
  private modelo: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(opcoes: OpcoesOllama = {}) {
    this.urlBase = (opcoes.urlBase ?? 'http://localhost:11434').replace(/\/+$/, '');
    this.modelo = opcoes.modelo ?? 'llama3.2:3b';
    this.timeoutMs = opcoes.timeoutMs ?? 12000;
    this.fetchFn = opcoes.fetchFn ?? fetch;
  }

  async explicar(textoOriginal: string): Promise<TextoExplicativo> {
    if (!textoOriginal.trim()) {
      return { texto: textoOriginal, geradoPorLlm: false };
    }

    const prompt = `Orientação oficial do PROCON:\n"""\n${textoOriginal}\n"""\n\nReescreva a orientação acima de forma clara, acolhedora e fácil de entender, mantendo todos os fatos e instruções originais:`;

    try {
      const resposta = await this.gerar(PROMPT_SISTEMA_EXPLICACAO, prompt);
      const textoLimpo = resposta?.trim();

      if (!textoLimpo || textoLimpo.length < 20) {
        return { texto: textoOriginal, geradoPorLlm: false };
      }

      return {
        texto: textoLimpo,
        geradoPorLlm: true,
      };
    } catch (erro) {
      console.warn('[llm] Falha ao consultar Ollama local (usando texto original do PROCON):', erro);
      return { texto: textoOriginal, geradoPorLlm: false };
    }
  }

  async identificarFluxo(relatoCidadao: string, itensMenu: ItemMenu[]): Promise<string | undefined> {
    const relato = relatoCidadao.trim();
    if (relato.length < 3 || itensMenu.length === 0) return undefined;

    const catalogoFormatado = itensMenu
      .map((item) => `- ${item.fluxo}: ${item.rotulo} (${item.descricao})`)
      .join('\n');

    const sistema = [
      'Você é um classificador de triagem do PROCON de Jacareí-SP.',
      'Analise a mensagem do cidadão e escolha qual dos fluxos abaixo corresponde ao problema relatado.',
      'Responda APENAS com o identificador exato do fluxo (ex.: garantia-produto) ou com a palavra "nenhum" caso não tenha relação com nenhum item.',
      'Não escreva nenhuma explicação adicional.',
    ].join('\n');

    const prompt = `Fluxos disponíveis:\n${catalogoFormatado}\n\nMensagem do cidadão: "${relato}"\n\nIdentificador do fluxo:`;

    try {
      const resposta = await this.gerar(sistema, prompt);
      if (!resposta) return undefined;

      const token = resposta
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '');

      const encontrado = itensMenu.find((item) => item.fluxo.toLowerCase() === token);
      return encontrado?.fluxo;
    } catch (erro) {
      console.warn('[llm] Falha ao classificar fluxo no Ollama local:', erro);
      return undefined;
    }
  }

  async identificarOpcao(
    pergunta: string,
    respostaCidadao: string,
    opcoes: { id: string; rotulo: string }[],
  ): Promise<string | undefined> {
    const relato = respostaCidadao.trim();
    if (relato.length < 2 || opcoes.length === 0) return undefined;

    const listaOpcoes = opcoes.map((o) => `- ${o.id}: ${o.rotulo}`).join('\n');
    const sistema = [
      'Você é o classificador de respostas do chatbot do PROCON de Jacareí-SP.',
      'Dado a pergunta feita pelo bot e a resposta livre do cidadão, escolha qual das opções abaixo representa o que o cidadão respondeu.',
      'Responda APENAS com o id exato da opção (ex.: sim) ou "nenhuma" se não for possível identificar.',
      'Não explique nada.',
    ].join('\n');

    const prompt = `Pergunta do bot: "${pergunta}"\n\nOpções disponíveis:\n${listaOpcoes}\n\nResposta do cidadão: "${relato}"\n\nId da opção escolhida:`;

    try {
      const resposta = await this.gerar(sistema, prompt);
      if (!resposta) return undefined;

      const token = resposta
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, '');

      const encontrada = opcoes.find((o) => o.id.toLowerCase() === token);
      return encontrada?.id;
    } catch {
      return undefined;
    }
  }

  private async gerar(system: string, prompt: string): Promise<string | undefined> {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), this.timeoutMs);

    try {
      let resposta = await this.chamarApiGenerate(this.modelo, system, prompt, controlador.signal);

      // Se retornou 404, o modelo configurado ainda nao foi baixado (ollama pull) ou tem outro nome
      if (resposta.status === 404) {
        const modeloAlternativo = await this.descobrirModeloInstalado(controlador.signal);
        if (modeloAlternativo && modeloAlternativo !== this.modelo) {
          console.log(`[llm] Modelo "${this.modelo}" nao encontrado; usando modelo instalado "${modeloAlternativo}".`);
          this.modelo = modeloAlternativo;
          resposta = await this.chamarApiGenerate(this.modelo, system, prompt, controlador.signal);
        } else {
          throw new Error(
            `Ollama retornou HTTP 404 (modelo "${this.modelo}" ainda nao foi baixado no Ollama! Rode no terminal: docker exec -it ollama ollama pull ${this.modelo} ou ollama pull ${this.modelo})`,
          );
        }
      }

      if (!resposta.ok) {
        throw new Error(`Ollama retornou HTTP ${resposta.status}`);
      }

      const dados = (await resposta.json()) as { response?: unknown };
      return typeof dados.response === 'string' ? dados.response : undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private async chamarApiGenerate(
    modelo: string,
    system: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<Response> {
    return this.fetchFn(`${this.urlBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        system,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
      signal,
    });
  }

  private async descobrirModeloInstalado(signal: AbortSignal): Promise<string | undefined> {
    try {
      const resp = await this.fetchFn(`${this.urlBase}/api/tags`, { signal });
      if (!resp.ok) return undefined;
      const dados = (await resp.json()) as { models?: Array<{ name?: string }> };
      return dados.models?.[0]?.name;
    } catch {
      return undefined;
    }
  }
}
